package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import com.sau.kaizendesk.dto.DashboardSummaryResponse;
import com.sau.kaizendesk.dto.DashboardSummaryResponse.AgentPerformance;
import com.sau.kaizendesk.dto.DashboardSummaryResponse.DailyCount;
import com.sau.kaizendesk.repository.TicketRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
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

    private static final Set<TicketStatus> DONE_STATUSES =
            Set.of(TicketStatus.RESOLVED, TicketStatus.CLOSED);

    public DashboardSummaryResponse getSummary(LocalDate from, LocalDate to) {
        List<Ticket> all = ticketRepository.findAll();
        Instant rangeStart = from != null ? from.atStartOfDay().toInstant(ZoneOffset.UTC) : null;
        Instant rangeEnd = to != null ? to.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC) : null;
        List<Ticket> periodTickets = all.stream()
                .filter(t -> isInRange(t.getCreatedAt(), rangeStart, rangeEnd))
                .toList();

        DashboardSummaryResponse resp = new DashboardSummaryResponse();

        resp.setTotalTickets(periodTickets.size());

        long newCount = countByStatus(periodTickets, TicketStatus.NEW);
        long inProgress = countByStatus(periodTickets, TicketStatus.IN_PROGRESS);
        long waiting = countByStatus(periodTickets, TicketStatus.WAITING_FOR_CUSTOMER);
        long resolved = countByStatus(periodTickets, TicketStatus.RESOLVED);
        long closed = countByStatus(periodTickets, TicketStatus.CLOSED);

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

        Map<String, Long> priorityCounts = periodTickets.stream()
                .collect(Collectors.groupingBy(
                        t -> t.getPriority().name(),
                        LinkedHashMap::new,
                        Collectors.counting()));
        resp.setPriorityCounts(priorityCounts);

        Map<String, Long> productCounts = periodTickets.stream()
                .filter(t -> t.getProduct() != null)
                .collect(Collectors.groupingBy(
                        t -> t.getProduct().getName(),
                        LinkedHashMap::new,
                        Collectors.counting()));
        resp.setProductCounts(productCounts);

        Instant now = Instant.now();

        long slaBreached = periodTickets.stream().filter(t -> SlaEvaluator.isBreached(t, now)).count();
        resp.setSlaBreachedCount(slaBreached);

        // SLA uyumu — dashboard "SLA Performansı" ile aynı tanım:
        // açık (RESOLVED/CLOSED olmayan) talepler içinde henüz ihlal etmeyenlerin oranı.
        List<Ticket> openTickets = periodTickets.stream()
                .filter(t -> !DONE_STATUSES.contains(t.getStatus()))
                .toList();
        long openTotal = openTickets.size();
        long openInTarget = openTickets.stream()
                .filter(t -> !SlaEvaluator.isBreached(t, now))
                .count();
        resp.setSlaInTargetCount(openInTarget);
        resp.setSlaComplianceRate(openTotal == 0 ? 100.0 : Math.round(openInTarget * 1000.0 / openTotal) / 10.0);

        Instant startOfToday = LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);
        long closedToday = all.stream()
                .filter(t -> t.getClosedAt() != null && t.getClosedAt().isAfter(startOfToday))
                .count();
        resp.setClosedToday(closedToday);

        long closedInRange = all.stream()
                .filter(t -> t.getClosedAt() != null)
                .filter(t -> isInRange(t.getClosedAt(), rangeStart, rangeEnd))
                .count();
        resp.setClosedInRange(closedInRange);

        all.stream()
                .filter(t -> t.getResolvedAt() != null)
                .filter(t -> isInRange(t.getResolvedAt(), rangeStart, rangeEnd))
                .mapToLong(t -> java.time.Duration.between(t.getCreatedAt(), t.getResolvedAt()).toMinutes())
                .average()
                .ifPresentOrElse(
                        avg -> resp.setAvgResolutionMinutes(Math.round(avg)),
                        () -> resp.setAvgResolutionMinutes(null));

        resp.setAgentPerformances(buildAgentPerformances(all, rangeStart, rangeEnd));
        DateWindow chartWindow = chartWindow(from, to);
        resp.setDailyCreatedCounts(dailyCounts(all, chartWindow.start(), chartWindow.days(), Ticket::getCreatedAt));
        resp.setDailyClosedCounts(dailyCounts(all, chartWindow.start(), chartWindow.days(), Ticket::getResolvedAt));

        return resp;
    }

    private List<DailyCount> dailyCounts(List<Ticket> all, LocalDate startDate, int days, Function<Ticket, Instant> dateOf) {
        List<DailyCount> result = new ArrayList<>(days);
        for (int i = 0; i < days; i++) {
            LocalDate day = startDate.plusDays(i);
            Instant start = day.atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant end = day.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            long count = all.stream()
                    .filter(t -> dateOf.apply(t) != null)
                    .filter(t -> !dateOf.apply(t).isBefore(start) && dateOf.apply(t).isBefore(end))
                    .count();
            DailyCount dc = new DailyCount();
            dc.setDate(day.toString());
            dc.setCount(count);
            result.add(dc);
        }
        return result;
    }

    private DateWindow chartWindow(LocalDate from, LocalDate to) {
        LocalDate end = to != null ? to : LocalDate.now(ZoneOffset.UTC);
        LocalDate start = from != null ? from : end.minusDays(13);
        if (start.isAfter(end)) {
            start = end;
        }
        long days = ChronoUnit.DAYS.between(start, end) + 1;
        return new DateWindow(start, (int) Math.max(1, days));
    }

    private boolean isInRange(Instant value, Instant rangeStart, Instant rangeEnd) {
        return value != null
                && (rangeStart == null || !value.isBefore(rangeStart))
                && (rangeEnd == null || value.isBefore(rangeEnd));
    }

    private long countByStatus(List<Ticket> tickets, TicketStatus status) {
        return tickets.stream().filter(t -> t.getStatus() == status).count();
    }

    private List<AgentPerformance> buildAgentPerformances(List<Ticket> all, Instant rangeStart, Instant rangeEnd) {
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
            ap.setAssignedCount(tickets.stream()
                    .filter(t -> isInRange(t.getCreatedAt(), rangeStart, rangeEnd))
                    .count());

            long resolvedOrClosed = tickets.stream()
                    .filter(t -> t.getStatus() == TicketStatus.RESOLVED || t.getStatus() == TicketStatus.CLOSED)
                    .filter(t -> isInRange(t.getResolvedAt(), rangeStart, rangeEnd))
                    .count();
            ap.setResolvedCount(resolvedOrClosed);

            long closedCount = tickets.stream()
                    .filter(t -> t.getStatus() == TicketStatus.CLOSED)
                    .filter(t -> isInRange(t.getClosedAt(), rangeStart, rangeEnd))
                    .count();
            ap.setClosedCount(closedCount);

            tickets.stream()
                    .filter(t -> t.getResolvedAt() != null)
                    .filter(t -> isInRange(t.getResolvedAt(), rangeStart, rangeEnd))
                    .mapToLong(t -> java.time.Duration.between(t.getCreatedAt(), t.getResolvedAt()).toMinutes())
                    .average()
                    .ifPresentOrElse(
                            avg -> ap.setAvgResolutionMinutes(Math.round(avg)),
                            () -> ap.setAvgResolutionMinutes(null));

            if (ap.getAssignedCount() > 0 || ap.getResolvedCount() > 0 || ap.getClosedCount() > 0) {
                result.add(ap);
            }
        }
        return result;
    }

    private record DateWindow(LocalDate start, int days) {
    }
}
