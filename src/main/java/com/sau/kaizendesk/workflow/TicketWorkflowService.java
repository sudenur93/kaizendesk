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
 * Çağrı eden tarafta (TicketService) try/catch ile saralım — engine başarısız olursa
 * ticket akışı yine de kesilmesin (best-effort orkestrasyon).
 */
@Service
public class TicketWorkflowService {

    private static final Logger log = LoggerFactory.getLogger(TicketWorkflowService.class);
    private static final String PROCESS_KEY = "ticketFlow";
    private static final String WAIT_TASK_ID = "waitInProgress";

    private final RuntimeService runtimeService;

    public TicketWorkflowService(RuntimeService runtimeService) {
        this.runtimeService = runtimeService;
    }

    /** Ticket oluşturulduğunda yeni bir process instance başlatır, id'yi döner. */
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

    /** Statü değiştiğinde BPMN değişkenini günceller; çözüldü/kapatıldı ise wait state'i tetikler. */
    public void onStatusChanged(String processInstanceId, TicketStatus newStatus) {
        if (processInstanceId == null) return;
        try {
            runtimeService.setVariable(processInstanceId, "status", newStatus.name());

            // RESOLVED veya CLOSED ise receiveTask'ı tetikleyip gateway'e geç
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
