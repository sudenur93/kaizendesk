package com.sau.kaizendesk.workflow;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import org.kie.kogito.Model;
import org.kie.kogito.auth.IdentityProvider;
import org.kie.kogito.process.Process;
import org.kie.kogito.process.ProcessInstance;
import org.kie.kogito.process.Processes;
import org.kie.kogito.services.identity.StaticIdentityProvider;
import org.kie.kogito.services.uow.UnitOfWorkExecutor;
import org.kie.kogito.uow.UnitOfWorkManager;
import org.kie.kogito.usertask.UserTaskService;
import org.kie.kogito.usertask.view.UserTaskTransitionView;
import org.kie.kogito.usertask.view.UserTaskView;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Ticket yaşam döngüsünü jBPM 10 / Apache KIE (Kogito) BPMN süreci üzerinden yönetir.
 *
 * Süreç tanımı: src/main/resources/ticketFlow.bpmn2 (process id = "ticketFlow").
 * Adımlar: Calculate SLA → Assign (Manager) → Investigate (Agent)
 *   → [Need Additional Info?] → (Request Info → Customer Response → Investigate) | Resolve → Close.
 * Investigate'e bağlı non-interrupting SLA timer süre dolunca "Mark SLA Breached" çalıştırır.
 *
 * Ticket statü geçişleri bu süreç üzerinden yönetilir: her durum değişikliğinde aktif user task'lar
 * (jBPM 10 UserTaskService ile claim+complete edilerek) tamamlanır ve süreç ilgili adıma ilerletilir.
 * SLA, müşteri beklenirken (WAITING_FOR_CUSTOMER) Investigate'ten çıkıldığı için durur; müşteri
 * cevaplayıp Investigate'e dönülünce yeniden başlar.
 *
 * Tüm motor mutasyonları bir UnitOfWork içinde çalıştırılır (Kogito yan etkilerini —user task
 * oluşturma vb.— commit etmek için gereklidir). Tasarım best-effort: bean yoksa/hata olursa
 * ticket akışı kesilmez.
 */
@Service
public class TicketWorkflowService {

    private static final Logger log = LoggerFactory.getLogger(TicketWorkflowService.class);
    private static final String PROCESS_ID = "ticketFlow";

    /** User task'ları programatik tamamlamak için tüm gruplara sahip sistem kimliği. */
    private static final IdentityProvider SYSTEM =
            new StaticIdentityProvider("system", List.of("Manager", "Agent", "Customer"));

    /** Sonsuz döngü koruması: tek bir durum değişikliğinde en fazla bu kadar adım ilerlet. */
    private static final int MAX_ADVANCE_STEPS = 8;

    private final ObjectProvider<Processes> processesProvider;
    private final ObjectProvider<UserTaskService> userTaskServiceProvider;
    private final ObjectProvider<UnitOfWorkManager> unitOfWorkManagerProvider;

    public TicketWorkflowService(ObjectProvider<Processes> processesProvider,
                                 ObjectProvider<UserTaskService> userTaskServiceProvider,
                                 ObjectProvider<UnitOfWorkManager> unitOfWorkManagerProvider) {
        this.processesProvider = processesProvider;
        this.userTaskServiceProvider = userTaskServiceProvider;
        this.unitOfWorkManagerProvider = unitOfWorkManagerProvider;
    }

    /** Bilet oluşturulduğunda yeni bir Kogito süreç örneği başlatır (Calculate SLA → Assign'da bekler). */
    public String startProcess(Ticket ticket) {
        Processes processes = processesProvider.getIfAvailable();
        if (processes == null) {
            return null;
        }
        try {
            UnitOfWorkManager uowm = unitOfWorkManagerProvider.getIfAvailable();
            return runInUnitOfWork(uowm, () -> {
                Process<? extends Model> process = processes.processById(PROCESS_ID);
                Model model = process.createModel();
                Map<String, Object> params = new HashMap<>();
                params.put("ticketId", ticket.getId());
                params.put("priority", ticket.getPriority() != null ? ticket.getPriority().name() : "MEDIUM");
                params.put("needMoreInfo", Boolean.FALSE);
                model.fromMap(params);
                ProcessInstance<? extends Model> pi = process.createInstance(model);
                pi.start();
                log.info("[Kogito] Süreç başlatıldı: ticketId={}, processInstanceId={}", ticket.getId(), pi.id());
                return pi.id();
            });
        } catch (Exception ex) {
            log.error("[Kogito] Süreç başlatılamadı (ticketId={}): {}", ticket.getId(), ex.getMessage());
            return null;
        }
    }

    /**
     * Bilet durumu değiştiğinde süreci ilgili adıma ilerletir.
     *  IN_PROGRESS          → Investigate
     *  WAITING_FOR_CUSTOMER  → Customer Response (needMoreInfo=true; SLA timer durur)
     *  RESOLVED              → Close (needMoreInfo=false; Investigate → Resolve → Close)
     *  CLOSED                → sürecin sonuna kadar ilerlet (Process Completed)
     */
    public void onStatusChanged(String processInstanceId, TicketStatus newStatus) {
        Processes processes = processesProvider.getIfAvailable();
        UserTaskService userTasks = userTaskServiceProvider.getIfAvailable();
        if (processes == null || userTasks == null || processInstanceId == null || newStatus == null) {
            return;
        }

        String targetKeyword;
        boolean needMoreInfo;
        switch (newStatus) {
            case IN_PROGRESS -> { targetKeyword = "investigate"; needMoreInfo = false; }
            case WAITING_FOR_CUSTOMER -> { targetKeyword = "customer response"; needMoreInfo = true; }
            case RESOLVED -> { targetKeyword = "close"; needMoreInfo = false; }
            case CLOSED -> { targetKeyword = null; needMoreInfo = false; }
            default -> { return; } // NEW: süreç zaten Assign'da bekliyor
        }

        try {
            UnitOfWorkManager uowm = unitOfWorkManagerProvider.getIfAvailable();
            Process<? extends Model> process = processes.processById(PROCESS_ID);

            // Gateway kararı için needMoreInfo değişkenini güncelle (UoW içinde commit edilir)
            runInUnitOfWork(uowm, () -> {
                setNeedMoreInfo(process, processInstanceId, needMoreInfo);
                return null;
            });

            for (int step = 0; step < MAX_ADVANCE_STEPS; step++) {
                if (!isActive(process, processInstanceId)) {
                    break;
                }
                List<UserTaskView> active = activeTasks(userTasks, processInstanceId);
                if (active.isEmpty()) {
                    break;
                }
                UserTaskView current = active.get(0);
                if (targetKeyword != null && normalize(current.getTaskName()).contains(targetKeyword)) {
                    break; // hedef adıma ulaşıldı
                }
                String taskId = current.getId();
                boolean[] ok = {false};
                runInUnitOfWork(uowm, () -> {
                    ok[0] = completeTask(userTasks, taskId);
                    return null;
                });
                if (!ok[0]) {
                    break;
                }
            }
            log.info("[Kogito] Süreç ilerletildi: pi={}, status={}, aktifAdim={}",
                    processInstanceId, newStatus, currentTaskName(userTasks, processInstanceId));
        } catch (Exception ex) {
            log.warn("[Kogito] Süreç güncellenemedi (pi={}): {}", processInstanceId, ex.getMessage());
        }
    }

    /** Verilen süreç örneğine ait, henüz tamamlanmamış user task'ları döndürür. */
    private List<UserTaskView> activeTasks(UserTaskService userTasks, String pid) {
        return userTasks.list(SYSTEM).stream()
                .filter(v -> v.getProcessInfo() != null
                        && pid.equals(v.getProcessInfo().getProcessInstanceId()))
                .filter(v -> v.getStatus() == null || !v.getStatus().isTerminate())
                .collect(Collectors.toList());
    }

    /** Bir user task'ı (gerekirse önce claim ederek) complete'e geçirir. */
    private boolean completeTask(UserTaskService userTasks, String taskId) {
        try {
            Set<String> allowed = userTasks.allowedTransitions(taskId, SYSTEM).stream()
                    .map(UserTaskTransitionView::getTransitionId)
                    .collect(Collectors.toSet());
            if (allowed.contains("claim")) {
                userTasks.transition(taskId, "claim", Map.of(), SYSTEM);
            }
            userTasks.transition(taskId, "complete", Map.of(), SYSTEM);
            return true;
        } catch (Exception ex) {
            log.warn("[Kogito] User task tamamlanamadı (taskId={}): {}", taskId, ex.getMessage());
            return false;
        }
    }

    /** Gateway kararı için süreç değişkeni needMoreInfo değerini günceller. */
    @SuppressWarnings({"rawtypes", "unchecked"})
    private void setNeedMoreInfo(Process<? extends Model> process, String pid, boolean value) {
        try {
            Optional<? extends ProcessInstance<? extends Model>> opt = process.instances().findById(pid);
            if (opt.isEmpty()) {
                return;
            }
            ProcessInstance pi = opt.get();
            Model vars = (Model) pi.variables();
            Map<String, Object> map = vars.toMap();
            map.put("needMoreInfo", value);
            vars.update(map);
            pi.updateVariables(vars);
        } catch (Exception ex) {
            log.debug("[Kogito] needMoreInfo güncellenemedi (pi={}): {}", pid, ex.getMessage());
        }
    }

    private boolean isActive(Process<? extends Model> process, String pid) {
        return process.instances().findById(pid)
                .map(pi -> pi.status() == ProcessInstance.STATE_ACTIVE)
                .orElse(false);
    }

    private String currentTaskName(UserTaskService userTasks, String pid) {
        List<UserTaskView> active = activeTasks(userTasks, pid);
        return active.isEmpty() ? "-" : active.get(0).getTaskName();
    }

    private static <T> T runInUnitOfWork(UnitOfWorkManager uowm, Supplier<T> action) {
        if (uowm == null) {
            return action.get();
        }
        return UnitOfWorkExecutor.executeInUnitOfWork(uowm, action);
    }

    private static String normalize(String name) {
        return name == null ? "" : name.toLowerCase().replace('_', ' ').trim();
    }
}
