package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * SLA ihlali ve risk (hedefe yaklaşma) — liste/detay yanıtlarında türetilir.
 */
public final class SlaEvaluator {

    private SlaEvaluator() {
    }

    /** Çözüm hedef zamanı geçmiş ve kapatma/çözüm bu süreyi aşmış ya da ticket hâlâ açık. */
    public static boolean isBreached(Ticket ticket, Instant now) {
        if (ticket.getSlaTargetAt() == null) {
            return false;
        }
        Instant target = ticket.getSlaTargetAt();
        TicketStatus st = ticket.getStatus();
        if (st == TicketStatus.RESOLVED || st == TicketStatus.CLOSED) {
            Instant completed = ticket.getResolvedAt() != null ? ticket.getResolvedAt() : ticket.getClosedAt();
            if (completed == null) {
                return false;
            }
            return completed.isAfter(target);
        }
        return now.isAfter(target);
    }

    /**
     * İhlal yok; ticket kapanmamış; kalan süre pencerenin ~%25'i veya en az 30 dk (hangisi büyükse) altında.
     */
    public static boolean isAtRisk(Ticket ticket, Instant now) {
        if (ticket.getSlaTargetAt() == null || ticket.getCreatedAt() == null) {
            return false;
        }
        if (isBreached(ticket, now)) {
            return false;
        }
        if (ticket.getStatus() == TicketStatus.CLOSED) {
            return false;
        }
        Instant target = ticket.getSlaTargetAt();
        if (!now.isBefore(target)) {
            return false;
        }
        long totalMinutes = ChronoUnit.MINUTES.between(ticket.getCreatedAt(), target);
        if (totalMinutes <= 0) {
            return false;
        }
        long remaining = ChronoUnit.MINUTES.between(now, target);
        if (remaining <= 0) {
            return false;
        }
        long threshold = Math.max(30L, totalMinutes / 4);
        return remaining <= threshold;
    }
}
