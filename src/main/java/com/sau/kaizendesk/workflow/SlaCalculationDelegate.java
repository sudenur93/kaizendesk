package com.sau.kaizendesk.workflow;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * BPMN serviceTask: SLA hedef süresini hesaplar (zaten TicketService.createTicket
 * sırasında DB'ye yazılıyor; bu delegate süreç değişkeni olarak görünür kılar ve
 * timer event'inin başvuracağı slaTargetAt değişkenini set eder).
 */
@Component("slaCalculationDelegate")
public class SlaCalculationDelegate implements JavaDelegate {

    private static final Logger log = LoggerFactory.getLogger(SlaCalculationDelegate.class);

    @Override
    public void execute(DelegateExecution execution) {
        Long ticketId = (Long) execution.getVariable("ticketId");
        Object slaTargetAt = execution.getVariable("slaTargetAt");
        log.info("BPMN: SLA hesaplandı (ticketId={}, slaTargetAt={})", ticketId, slaTargetAt);
    }
}
