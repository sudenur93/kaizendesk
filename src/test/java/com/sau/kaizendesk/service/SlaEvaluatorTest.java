package com.sau.kaizendesk.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;

class SlaEvaluatorTest {

    @Test
    void breached_openTicket_pastTarget() {
        Instant created = Instant.parse("2026-04-01T10:00:00Z");
        Instant target = Instant.parse("2026-04-01T12:00:00Z");
        Instant now = Instant.parse("2026-04-01T13:00:00Z");
        Ticket t = baseTicket(TicketStatus.IN_PROGRESS, created, target);
        assertThat(SlaEvaluator.isBreached(t, now)).isTrue();
        assertThat(SlaEvaluator.isAtRisk(t, now)).isFalse();
    }

    @Test
    void notBreached_resolvedOnTime() {
        Instant created = Instant.parse("2026-04-01T10:00:00Z");
        Instant target = Instant.parse("2026-04-01T12:00:00Z");
        Instant resolved = Instant.parse("2026-04-01T11:00:00Z");
        Instant now = Instant.parse("2026-04-01T15:00:00Z");
        Ticket t = baseTicket(TicketStatus.RESOLVED, created, target);
        t.setResolvedAt(resolved);
        assertThat(SlaEvaluator.isBreached(t, now)).isFalse();
    }

    @Test
    void breached_resolvedLate() {
        Instant created = Instant.parse("2026-04-01T10:00:00Z");
        Instant target = Instant.parse("2026-04-01T12:00:00Z");
        Instant resolved = Instant.parse("2026-04-01T12:01:00Z");
        Instant now = Instant.parse("2026-04-01T15:00:00Z");
        Ticket t = baseTicket(TicketStatus.RESOLVED, created, target);
        t.setResolvedAt(resolved);
        assertThat(SlaEvaluator.isBreached(t, now)).isTrue();
    }

    @Test
    void atRisk_lastQuarterOfWindow() {
        Instant created = Instant.parse("2026-04-01T10:00:00Z");
        Instant target = created.plus(480, ChronoUnit.MINUTES);
        Instant now = target.minus(119, ChronoUnit.MINUTES);
        Ticket t = baseTicket(TicketStatus.NEW, created, target);
        assertThat(SlaEvaluator.isBreached(t, now)).isFalse();
        assertThat(SlaEvaluator.isAtRisk(t, now)).isTrue();
    }

    @Test
    void notAtRisk_outsideLastQuarter() {
        Instant created = Instant.parse("2026-04-01T10:00:00Z");
        Instant target = created.plus(480, ChronoUnit.MINUTES);
        Instant now = target.minus(200, ChronoUnit.MINUTES);
        Ticket t = baseTicket(TicketStatus.NEW, created, target);
        assertThat(SlaEvaluator.isAtRisk(t, now)).isFalse();
    }

    @Test
    void closed_notAtRisk() {
        Instant created = Instant.parse("2026-04-01T10:00:00Z");
        Instant target = created.plus(60, ChronoUnit.MINUTES);
        Instant now = target.minus(10, ChronoUnit.MINUTES);
        Ticket t = baseTicket(TicketStatus.CLOSED, created, target);
        t.setResolvedAt(created.plus(30, ChronoUnit.MINUTES));
        t.setClosedAt(created.plus(31, ChronoUnit.MINUTES));
        assertThat(SlaEvaluator.isAtRisk(t, now)).isFalse();
    }

    private static Ticket baseTicket(TicketStatus status, Instant created, Instant target) {
        Ticket t = new Ticket();
        t.setStatus(status);
        t.setCreatedAt(created);
        t.setSlaTargetAt(target);
        return t;
    }
}
