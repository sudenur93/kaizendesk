package com.sau.kaizendesk.workflow;

import static org.assertj.core.api.Assertions.assertThat;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.enums.TicketPriority;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.kie.kogito.Model;
import org.kie.kogito.auth.IdentityProvider;
import org.kie.kogito.process.Process;
import org.kie.kogito.process.ProcessInstance;
import org.kie.kogito.process.Processes;
import org.kie.kogito.services.identity.StaticIdentityProvider;
import org.kie.kogito.usertask.UserTaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * jBPM/Kogito ticketFlow sürecinin uçtan uca ilerleyişini doğrular:
 * statü geçişleri TicketWorkflowService üzerinden sürecin user task'larını ilerletmeli.
 */
@SpringBootTest
@ActiveProfiles("local")
class TicketWorkflowFlowIT {

    private static final IdentityProvider SYSTEM =
            new StaticIdentityProvider("system", List.of("Manager", "Agent", "Customer"));

    @Autowired
    TicketWorkflowService workflowService;

    @Autowired
    Processes processes;

    @Autowired
    UserTaskService userTaskService;

    @Test
    void ticketLifecycleAdvancesThroughProcess() {
        Ticket ticket = new Ticket();
        ticket.setId(9999L);
        ticket.setPriority(TicketPriority.HIGH);

        // 1) Süreç başlar → Calculate SLA (auto) → Assign Ticket'ta bekler
        String pid = workflowService.startProcess(ticket);
        assertThat(pid).as("processInstanceId atanmalı").isNotBlank();
        assertThat(activeNode(pid)).containsIgnoringCase("assign");

        // 2) Atama yapıldı → Investigate Ticket
        workflowService.onStatusChanged(pid, TicketStatus.IN_PROGRESS);
        assertThat(activeNode(pid)).containsIgnoringCase("investigate");

        // 3) Müşteriden bilgi bekleniyor → Customer Response (SLA burada durur)
        workflowService.onStatusChanged(pid, TicketStatus.WAITING_FOR_CUSTOMER);
        assertThat(activeNode(pid)).containsIgnoringCase("customer response");

        // 4) Müşteri cevapladı → tekrar Investigate (SLA devam eder)
        workflowService.onStatusChanged(pid, TicketStatus.IN_PROGRESS);
        assertThat(activeNode(pid)).containsIgnoringCase("investigate");

        // 5) Çözüldü → Resolve (auto) → Close Ticket
        workflowService.onStatusChanged(pid, TicketStatus.RESOLVED);
        assertThat(activeNode(pid)).containsIgnoringCase("close");

        // 6) Kapatıldı → süreç tamamlanır (aktif örnek kalmaz)
        workflowService.onStatusChanged(pid, TicketStatus.CLOSED);
        assertThat(findInstance(pid)).as("kapatınca süreç sonlanmalı").isEmpty();
    }

    private String activeNode(String pid) {
        return userTaskService.list(SYSTEM).stream()
                .filter(v -> v.getProcessInfo() != null
                        && pid.equals(v.getProcessInfo().getProcessInstanceId()))
                .filter(v -> v.getStatus() == null || !v.getStatus().isTerminate())
                .map(v -> v.getTaskName())
                .findFirst()
                .orElse("");
    }

    private Optional<? extends ProcessInstance<? extends Model>> findInstance(String pid) {
        Process<? extends Model> process = processes.processById("ticketFlow");
        return process.instances().findById(pid);
    }
}
