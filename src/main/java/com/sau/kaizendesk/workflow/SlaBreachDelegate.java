package com.sau.kaizendesk.workflow;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.repository.TicketRepository;
import java.time.Instant;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * BPMN timer event tetiklendiğinde çalışır: ticket hâlâ açıksa slaBreached=true yapar.
 */
@Component("slaBreachDelegate")
public class SlaBreachDelegate implements JavaDelegate {

    private static final Logger log = LoggerFactory.getLogger(SlaBreachDelegate.class);
    private final TicketRepository ticketRepository;

    public SlaBreachDelegate(TicketRepository ticketRepository) {
        this.ticketRepository = ticketRepository;
    }

    @Override
    public void execute(DelegateExecution execution) {
        Long ticketId = (Long) execution.getVariable("ticketId");
        if (ticketId == null) return;
        ticketRepository.findById(ticketId).ifPresent(ticket -> {
            if (!ticket.isSlaBreached()) {
                ticket.setSlaBreached(true);
                ticket.setUpdatedAt(Instant.now());
                ticketRepository.save(ticket);
                log.warn("BPMN timer: ticket #{} SLA ihlali işaretlendi", ticketId);
            }
        });
    }
}
