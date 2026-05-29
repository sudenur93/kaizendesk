package com.sau.kaizendesk.workflow;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.runtime.Execution;
import org.flowable.engine.runtime.ProcessInstance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Ticket yaşam döngüsünü Flowable BPMN engine üzerinden yönetir.
 *
 * BPMN süreci (ticket-flow.bpmn20.xml) akışı:
 *   start → calculateSla → waitInProgress → gatewayResolved → closeTicket → end
 *   waitInProgress üzerinde SLA timer: süre dolunca slaBreachDelegate tetiklenir
 *
 * Tasarım prensibi: tüm Flowable çağrıları try/catch ile korunur.
 * BPMN engine arıza yapsa bile ticket iş akışı kesilmez (best-effort orkestrasyon).
 * Hatalar log.error/warn ile kaydedilir; null dönerek graceful degradation sağlanır.
 */
@Service
public class TicketWorkflowService {

    private static final Logger log = LoggerFactory.getLogger(TicketWorkflowService.class);
    /** BPMN dosyasındaki process id — runtimeService.startProcessInstanceByKey() ile eşleşmeli. */
    private static final String PROCESS_KEY = "ticketFlow";
    /** BPMN'deki receiveTask id — statü değişiminde trigger edilecek bekleme noktası. */
    private static final String WAIT_TASK_ID = "waitInProgress";

    private final RuntimeService runtimeService;

    public TicketWorkflowService(RuntimeService runtimeService) {
        this.runtimeService = runtimeService;
    }

    /**
     * Bilet oluşturulduğunda yeni bir Flowable process instance başlatır.
     * Process değişkenleri: ticketId, priority, status, slaTargetAt (timer için Date).
     * Business key "ticket-{id}" formatındadır — Flowable'da tekil tanımlayıcı.
     * @return processInstanceId (başarısız olursa null)
     */
    public String startProcess(Ticket ticket) {
        try {
            Map<String, Object> vars = new HashMap<>();
            vars.put("ticketId", ticket.getId());
            vars.put("priority", ticket.getPriority() != null ? ticket.getPriority().name() : "MEDIUM");
            vars.put("status", ticket.getStatus() != null ? ticket.getStatus().name() : "NEW");
            vars.put("slaTargetAt", ticket.getSlaTargetAt() != null
                    ? Date.from(ticket.getSlaTargetAt())
                    : Date.from(java.time.Instant.now().plusSeconds(28800)));

            ProcessInstance pi = runtimeService.startProcessInstanceByKey(
                    PROCESS_KEY,
                    "ticket-" + ticket.getId(),
                    vars
            );
            log.info("BPMN process başlatıldı: ticketId={}, processInstanceId={}", ticket.getId(), pi.getId());
            return pi.getId();
        } catch (Exception ex) {
            log.error("BPMN process başlatılamadı (ticketId={}): {}", ticket.getId(), ex.getMessage());
            return null;
        }
    }

    /**
     * Bilet durumu değiştiğinde BPMN sürecini günceller.
     * Status değişkeni her zaman set edilir; RESOLVED/CLOSED ise waitInProgress receive task'ı
     * tetiklenerek süreç exclusiveGateway'e ve ardından closeTicket delegate'e ilerler.
     */
    public void onStatusChanged(String processInstanceId, TicketStatus newStatus) {
        if (processInstanceId == null) return;
        try {
            runtimeService.setVariable(processInstanceId, "status", newStatus.name());

            // Bilet tamamlandıysa (RESOLVED/CLOSED) bekleme noktasını ilerlet
            if (newStatus == TicketStatus.RESOLVED || newStatus == TicketStatus.CLOSED) {
                List<Execution> waiting = runtimeService.createExecutionQuery()
                        .processInstanceId(processInstanceId)
                        .activityId(WAIT_TASK_ID)
                        .list();
                for (Execution exec : waiting) {
                    runtimeService.trigger(exec.getId());
                }
            }
            log.info("BPMN status güncellendi: pi={}, status={}", processInstanceId, newStatus);
        } catch (Exception ex) {
            log.warn("BPMN status güncellenemedi (pi={}): {}", processInstanceId, ex.getMessage());
        }
    }
}
