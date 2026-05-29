package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.domain.entity.Worklog;
import com.sau.kaizendesk.dto.CreateWorklogRequest;
import com.sau.kaizendesk.dto.WorklogResponse;
import com.sau.kaizendesk.repository.TicketRepository;
import com.sau.kaizendesk.repository.UserRepository;
import com.sau.kaizendesk.repository.WorklogRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorklogService {

    private final WorklogRepository worklogRepository;
    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;

    public WorklogService(
            WorklogRepository worklogRepository,
            TicketRepository ticketRepository,
            UserRepository userRepository) {
        this.worklogRepository = worklogRepository;
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public WorklogResponse addWorklog(Long ticketId, CreateWorklogRequest request, String username) {
        Ticket ticket =
                ticketRepository
                        .findById(ticketId)
                        .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketId));
        User author =
                userRepository
                        .findByUsername(username)
                        .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));

        int minutes = toDurationMinutes(request.getTimeSpent());
        LocalDate workDate =
                request.getWorkDate() != null ? request.getWorkDate() : LocalDate.now(ZoneOffset.UTC);
        Instant now = Instant.now();

        Worklog w = new Worklog();
        w.setTicket(ticket);
        w.setUser(author);
        w.setWorkDate(workDate);
        w.setDurationMinutes(minutes);
        w.setNote(request.getNote());
        w.setCreatedAt(now);
        return toResponse(worklogRepository.save(w));
    }

    public List<WorklogResponse> getWorklogs(Long ticketId) {
        if (!ticketRepository.existsById(ticketId)) {
            throw new IllegalArgumentException("Ticket not found: " + ticketId);
        }
        return worklogRepository.findByTicket_IdOrderByCreatedAtAsc(ticketId).stream()
                .map(this::toResponse)
                .toList();
    }

    private static int toDurationMinutes(long timeSpent) {
        if (timeSpent <= 0) {
            throw new IllegalArgumentException("timeSpent must be positive");
        }
        if (timeSpent > Integer.MAX_VALUE) {
            throw new IllegalArgumentException("timeSpent exceeds maximum");
        }
        return (int) timeSpent;
    }

    private WorklogResponse toResponse(Worklog w) {
        WorklogResponse r = new WorklogResponse();
        r.setId(w.getId());
        r.setTicketId(w.getTicket().getId());
        r.setUserId(w.getUser().getId());
        r.setAuthorUsername(w.getUser().getUsername());
        r.setWorkDate(w.getWorkDate());
        r.setTimeSpent((long) w.getDurationMinutes());
        r.setNote(w.getNote());
        r.setCreatedAt(w.getCreatedAt());
        return r;
    }
}
