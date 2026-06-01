package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

/**
 * SLA (Service Level Agreement) ihlal ve risk hesaplama yardımcı sınıfı.
 *
 * Yardımcı (utility) sınıf olarak tasarlanmıştır — instantiate edilemez.
 * TicketService.mapToResponse() her bilet yanıtında bu sınıfı çağırarak
 * slaBreached ve slaAtRisk değerlerini anlık olarak hesaplar.
 *
 * İhlal (isBreached):
 *   - Bilet hâlâ açık → şu anki zaman hedeften geçmiş mi?
 *   - Bilet çözüldü/kapandı → çözüm zamanı hedeften geçmiş mi?
 *
 * Risk (isAtRisk):
 *   - İhlal yoksa ve bilet kapanmamışsa
 *   - Kalan süre, toplam pencerenin %25'i VEYA 30 dakikadan küçük olan eşiğin altına düşmüşse
 *   - Örnek: 480 dk'lık bilet → eşik = max(30, 480/4) = 120 dk → son 2 saatte risk uyarısı
 */
public final class SlaEvaluator {

    private SlaEvaluator() {
    }

    /**
     * SLA ihlali olup olmadığını hesaplar.
     * Çözülmüş/kapatılmış biletlerde resolvedAt/closedAt zamanı hedefle karşılaştırılır;
     * açık biletlerde şu anki zaman kullanılır.
     */
    public static boolean isBreached(Ticket ticket, Instant now) {
        if (ticket.getSlaTargetAt() == null) {
            return false;
        }
        // Efektif hedef = orijinal hedef + müşteri beklemesinde geçen süre (SLA durur)
        Instant target = effectiveTarget(ticket, now);
        TicketStatus st = ticket.getStatus();
        if (st == TicketStatus.RESOLVED || st == TicketStatus.CLOSED) {
            // Tamamlanmış bilet: çözüm/kapanış zamanı hedefe göre değerlendirilir
            Instant completed = ticket.getResolvedAt() != null ? ticket.getResolvedAt() : ticket.getClosedAt();
            if (completed == null) {
                return false;
            }
            return completed.isAfter(target);
        }
        // Açık bilet: şu an hedeften sonraysa ihlal
        return now.isAfter(target);
    }

    /**
     * SLA duraklatmasını hesaba katan efektif hedef zamanı döndürür.
     * Müşteriden cevap beklenirken (WAITING_FOR_CUSTOMER) geçen süre SLA'dan düşülür:
     * hedef, biriken bekleme süresi + (hâlâ beklemedeyse şimdiye kadarki bekleme) kadar ötelenir.
     */
    public static Instant effectiveTarget(Ticket ticket, Instant now) {
        Instant target = ticket.getSlaTargetAt();
        if (target == null) {
            return null;
        }
        long pausedMin = ticket.getSlaPausedMinutes();
        if (ticket.getStatus() == TicketStatus.WAITING_FOR_CUSTOMER && ticket.getWaitingSince() != null) {
            pausedMin += Math.max(0, ChronoUnit.MINUTES.between(ticket.getWaitingSince(), now));
        }
        return pausedMin > 0 ? target.plus(pausedMin, ChronoUnit.MINUTES) : target;
    }

    /**
     * SLA risk durumunu hesaplar.
     * Koşullar: ihlal yok + bilet kapanmamış + kalan süre eşiğin altında.
     * Eşik: max(30 dk, toplam sürenin %25'i)
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
        // Müşteri beklenirken risk uyarısı verme (SLA duraklatılmış durumda)
        if (ticket.getStatus() == TicketStatus.WAITING_FOR_CUSTOMER) {
            return false;
        }
        Instant target = effectiveTarget(ticket, now);
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
        // Risk eşiği: toplam sürenin %25'i veya 30 dakika (hangisi büyükse)
        long threshold = Math.max(30L, totalMinutes / 4);
        return remaining <= threshold;
    }
}
