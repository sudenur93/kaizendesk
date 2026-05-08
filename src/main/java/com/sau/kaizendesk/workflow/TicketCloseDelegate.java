package com.sau.kaizendesk.workflow;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * BPMN end-of-process serviceTask: ticket çözüldü/kapatıldıktan sonra süreci sonlandırır.
 * Backend tarafında ticket statüsü zaten güncellendiği için sadece audit log basıyor.
 */
@Component("ticketCloseDelegate")
public class TicketCloseDelegate implements JavaDelegate {

    private static final Logger log = LoggerFactory.getLogger(TicketCloseDelegate.class);

    @Override
    public void execute(DelegateExecution execution) {
        Long ticketId = (Long) execution.getVariable("ticketId");
        Object status = execution.getVariable("status");
        log.info("BPMN: ticket #{} süreci sonlandı (final status={})", ticketId, status);
    }
}
