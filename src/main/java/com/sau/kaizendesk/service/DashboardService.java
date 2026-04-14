package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import com.sau.kaizendesk.dto.DashboardSummaryResponse;
import com.sau.kaizendesk.dto.DashboardSummaryResponse.AgentPerformance;
import com.sau.kaizendesk.repository.TicketRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private final TicketRepository ticketRepository;

    public DashboardService(TicketRepository ticketRepository) {
        this.ticketRepository = ticketRepository;
    }

    public DashboardSummaryResponse getSummary() {
        List<Ticket> all = ticketRepository.findAll();

        DashboardSummaryResponse resp = new DashboardSummaryResponse();

        resp.setTotalTickets(all.size());

        long newCount = countByStatus(all, TicketStatus.NEW);
        long inProgress = countByStatus(all, TicketStatus.IN_PROGRESS);
        long waiting = countByStatus(all, TicketStatus.WAITING_FOR_CUSTOMER);
        long resolved = countByStatus(all, TicketStatus.RESOLVED);
        long closed = countByStatus(all, TicketStatus.CLOSED);

        resp.setOpenTickets(newCount);
        resp.setInProgressTickets(inProgress);
        resp.setWaitingForCustomerTickets(waiting);
        resp.setResolvedTickets(resolved);
        resp.setClosedTickets(closed);

        Map<String, Long> statusCounts = new LinkedHashMap<>();
        statusCounts.put("NEW", newCount);
        statusCounts.put("IN_PROGRESS", inProgress);
        statusCounts.put("WAITING_FOR_CUSTOMER", waiting);
        statusCounts.put("RESOLVED", resolved);
        statusCounts.put("CLOSED", closed);
        resp.setStatusCounts(statusCounts);

        Map<String, Long> priorityCounts = all.stream()
                .collect(Collectors.groupingBy(
                        t -> t.getPriority().name(),
                        LinkedHashMap::new,
                        Collectors.counting()));
        resp.setPriorityCounts(priorityCounts);

        Map<String, Long> productCounts = all.stream()
                .filter(t -> t.getProduct() != null)
                .collect(Collectors.groupingBy(
                        t -> t.getProduct().getName(),
                        LinkedHashMap::new,
                        Collectors.counting()));
        resp.setProductCounts(productCounts);

        long slaBreached = all.stream().filter(Ticket::isSlaBreached).count();
        resp.setSlaBreachedCount(slaBreached);

        Instant startOfToday = LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);
        long closedToday = all.stream()
                .filter(t -> t.getClosedAt() != null && t.getClosedAt().isAfter(startOfToday))
                .count();
        resp.setClosedToday(closedToday);

        all.stream()
                .filter(t -> t.getResolvedAt() != null)
                .mapToLong(t -> java.time.Duration.between(t.getCreatedAt(), t.getResolvedAt()).toMinutes())
                .average()
                .ifPresentOrElse(
                        avg -> resp.setAvgResolutionMinutes(Math.round(avg)),
                        () -> resp.setAvgResolutionMinutes(null));

        resp.setAgentPerformances(buildAgentPerformances(all));

        return resp;
    }

    private long countByStatus(List<Ticket> tickets, TicketStatus status) {
        return tickets.stream().filter(t -> t.getStatus() == status).count();
    }

    private List<AgentPerformance> buildAgentPerformances(List<Ticket> all) {
        Map<Long, List<Ticket>> byAgent = all.stream()
                .filter(t -> t.getAssignedAgent() != null)
                .collect(Collectors.groupingBy(t -> t.getAssignedAgent().getId()));

        List<AgentPerformance> result = new ArrayList<>();
        for (var entry : byAgent.entrySet()) {
            List<Ticket> tickets = entry.getValue();
            Ticket sample = tickets.get(0);

            AgentPerformance ap = new AgentPerformance();
            ap.setAgentId(entry.getKey());
            ap.setAgentName(sample.getAssignedAgent().getName());
            ap.setAssignedCount(tickets.size());

            long resolvedOrClosed = tickets.stream()
                    .filter(t -> t.getStatus() == TicketStatus.RESOLVED || t.getStatus() == TicketStatus.CLOSED)
                    .count();
            ap.setResolvedCount(resolvedOrClosed);

            long closedCount = tickets.stream()
                    .filter(t -> t.getStatus() == TicketStatus.CLOSED)
                    .count();
            ap.setClosedCount(closedCount);

            tickets.stream()
                    .filter(t -> t.getResolvedAt() != null)
                    .mapToLong(t -> java.time.Duration.between(t.getCreatedAt(), t.getResolvedAt()).toMinutes())
                    .average()
                    .ifPresentOrElse(
                            avg -> ap.setAvgResolutionMinutes(Math.round(avg)),
                            () -> ap.setAvgResolutionMinutes(null));

            result.add(ap);
        }
        return result;
    }
}
