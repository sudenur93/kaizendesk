package com.sau.kaizendesk.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import com.sau.kaizendesk.dto.DashboardSummaryResponse;
import com.sau.kaizendesk.repository.TicketRepository;
import java.lang.reflect.Proxy;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class DashboardServiceTest {

    @Test
    void getSummary_withDateRange_filtersPeriodMetricsAndTrend() {
        User agent = new User();
        agent.setId(42L);
        agent.setName("Ayse Agent");

        Ticket oldTicket = ticket(TicketStatus.NEW, "2026-05-20T10:00:00Z", null, null, agent);
        Ticket newTicket = ticket(TicketStatus.NEW, "2026-06-02T10:00:00Z", null, null, agent);
        Ticket resolvedTicket = ticket(
                TicketStatus.RESOLVED,
                "2026-06-03T09:00:00Z",
                "2026-06-03T11:00:00Z",
                null,
                agent);
        Ticket closedTicket = ticket(
                TicketStatus.CLOSED,
                "2026-06-05T13:00:00Z",
                "2026-06-05T14:00:00Z",
                "2026-06-05T14:30:00Z",
                agent);

        DashboardService dashboardService = new DashboardService(
                repositoryReturning(List.of(oldTicket, newTicket, resolvedTicket, closedTicket)));

        DashboardSummaryResponse summary = dashboardService.getSummary(
                LocalDate.parse("2026-06-01"),
                LocalDate.parse("2026-06-07"));

        assertThat(summary.getTotalTickets()).isEqualTo(3);
        assertThat(summary.getStatusCounts()).containsEntry("NEW", 1L);
        assertThat(summary.getStatusCounts()).containsEntry("RESOLVED", 1L);
        assertThat(summary.getStatusCounts()).containsEntry("CLOSED", 1L);
        assertThat(summary.getClosedInRange()).isEqualTo(1);
        assertThat(summary.getAvgResolutionMinutes()).isEqualTo(90L);

        assertThat(summary.getDailyCreatedCounts()).hasSize(7);
        assertThat(summary.getDailyCreatedCounts())
                .extracting(DashboardSummaryResponse.DailyCount::getCount)
                .containsExactly(0L, 1L, 1L, 0L, 1L, 0L, 0L);
        assertThat(summary.getDailyClosedCounts())
                .extracting(DashboardSummaryResponse.DailyCount::getCount)
                .containsExactly(0L, 0L, 1L, 0L, 1L, 0L, 0L);

        assertThat(summary.getAgentPerformances()).hasSize(1);
        DashboardSummaryResponse.AgentPerformance performance = summary.getAgentPerformances().get(0);
        assertThat(performance.getAssignedCount()).isEqualTo(3);
        assertThat(performance.getResolvedCount()).isEqualTo(2);
        assertThat(performance.getClosedCount()).isEqualTo(1);
        assertThat(performance.getAvgResolutionMinutes()).isEqualTo(90L);
    }

    private TicketRepository repositoryReturning(List<Ticket> tickets) {
        return (TicketRepository) Proxy.newProxyInstance(
                TicketRepository.class.getClassLoader(),
                new Class<?>[] {TicketRepository.class},
                (proxy, method, args) -> {
                    if (method.getName().equals("findAll") && method.getParameterCount() == 0) {
                        return tickets;
                    }
                    if (method.getName().equals("toString")) {
                        return "TicketRepositoryStub";
                    }
                    throw new UnsupportedOperationException("Unexpected repository call: " + method.getName());
                });
    }

    private Ticket ticket(
            TicketStatus status,
            String createdAt,
            String resolvedAt,
            String closedAt,
            User agent) {
        Ticket ticket = new Ticket();
        ticket.setStatus(status);
        ticket.setCreatedAt(Instant.parse(createdAt));
        ticket.setUpdatedAt(Instant.parse(createdAt));
        ticket.setResolvedAt(resolvedAt == null ? null : Instant.parse(resolvedAt));
        ticket.setClosedAt(closedAt == null ? null : Instant.parse(closedAt));
        ticket.setAssignedAgent(agent);
        return ticket;
    }
}
