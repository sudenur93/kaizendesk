package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.ActivityLog;
import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.repository.ActivityLogRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Sistem olaylarını denetim kaydı (audit log) olarak saklar.
 *
 * TicketService, CommentService vb. tarafından iş işleminin içinde çağrılır.
 * Propagation.REQUIRED kullanılır: çağıran işlem içindeyse onunla birleşir,
 * dışarıdaysa yeni bir işlem başlatır.
 *
 * ticketNo ve ticketTitle bilet referansından bağımsız olarak kopyalanır;
 * böylece bilet silinse bile geçmiş aktiviteler okunabilir kalır.
 */
@Service
public class ActivityLogService {

    private final ActivityLogRepository repo;

    public ActivityLogService(ActivityLogRepository repo) {
        this.repo = repo;
    }

    /**
     * Bir sistem olayını kaydeder.
     *
     * @param eventType olayın tipi (TICKET_CREATED, STATUS_CHANGED vb.)
     * @param actor     işlemi yapan kullanıcının username'i
     * @param ticket    ilgili bilet (null olabilir)
     * @param detail    ek açıklama (örn. "IN_PROGRESS → RESOLVED")
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public void log(String eventType, String actor, Ticket ticket, String detail) {
        ActivityLog log = new ActivityLog();
        log.setEventType(eventType);
        log.setActor(actor);
        if (ticket != null) {
            log.setTicket(ticket);
            log.setTicketNo(ticket.getTicketNo());
            log.setTicketTitle(ticket.getTitle());
        }
        log.setDetail(detail);
        repo.save(log);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getRecent(int limit) {
        return repo.findAllByOrderByCreatedAtDesc(PageRequest.of(0, limit))
                .stream()
                .map(a -> Map.<String, Object>of(
                        "id", a.getId(),
                        "eventType", a.getEventType(),
                        "actor", a.getActor() != null ? a.getActor() : "",
                        "ticketId", a.getTicket() != null ? a.getTicket().getId() : 0,
                        "ticketNo", a.getTicketNo() != null ? a.getTicketNo() : "",
                        "ticketTitle", a.getTicketTitle() != null ? a.getTicketTitle() : "",
                        "detail", a.getDetail() != null ? a.getDetail() : "",
                        "createdAt", a.getCreatedAt().toString()
                ))
                .toList();
    }
}
