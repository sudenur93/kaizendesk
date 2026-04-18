package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Notification;
import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import com.sau.kaizendesk.repository.NotificationRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ticket yaşam döngüsü olaylarından bildirim satırı üretir ve e-posta gönderir.
 */
@Service
public class TicketNotificationService {

    public static final String TYPE_TICKET_CREATED = "TICKET_CREATED";
    public static final String TYPE_STATUS_CHANGED = "STATUS_CHANGED";
    public static final String TYPE_TICKET_ASSIGNED = "TICKET_ASSIGNED";
    public static final String TYPE_SLA_AT_RISK = "SLA_AT_RISK";
    public static final String TYPE_SLA_BREACHED = "SLA_BREACHED";

    private final NotificationRepository notificationRepository;
    private final EmailService emailService;

    public TicketNotificationService(
            NotificationRepository notificationRepository,
            EmailService emailService
    ) {
        this.notificationRepository = notificationRepository;
        this.emailService = emailService;
    }

    @Transactional
    public void onTicketCreated(Ticket ticket) {
        User creator = ticket.getCreatedBy();
        if (creator == null) {
            return;
        }
        String no = ticket.getTicketNo() != null ? ticket.getTicketNo() : "#" + ticket.getId();
        persist(
                creator,
                ticket,
                TYPE_TICKET_CREATED,
                "Talep oluşturuldu",
                "Kaydınız alındı: " + no + " — " + ticket.getTitle());
    }

    @Transactional
    public void onStatusChanged(Ticket ticket, TicketStatus from, TicketStatus to) {
        if (from == to) {
            return;
        }
        String no = ticket.getTicketNo() != null ? ticket.getTicketNo() : "#" + ticket.getId();
        String body =
                String.format(
                        "%s: %s → %s",
                        no,
                        statusLabel(from),
                        statusLabel(to));
        for (User u : distinctRecipients(ticket)) {
            persist(u, ticket, TYPE_STATUS_CHANGED, "Statü güncellendi", body);
        }
    }

    @Transactional
    public void onAgentAssigned(Ticket ticket) {
        User agent = ticket.getAssignedAgent();
        String no = ticket.getTicketNo() != null ? ticket.getTicketNo() : "#" + ticket.getId();
        if (agent != null) {
            persist(
                    agent,
                    ticket,
                    TYPE_TICKET_ASSIGNED,
                    "Size atama yapıldı",
                    no + " numaralı talep üzerinize atandı.");
        }
        User creator = ticket.getCreatedBy();
        if (creator != null && (agent == null || !creator.getId().equals(agent.getId()))) {
            persist(
                    creator,
                    ticket,
                    TYPE_TICKET_ASSIGNED,
                    "Atama yapıldı",
                    no + " numaralı talebiniz bir uzmana atandı.");
        }
    }

    @Transactional
    public void maybeNotifySlaAtRisk(Ticket ticket, Instant now) {
        if (ticket.getSlaTargetAt() == null) {
            return;
        }
        if (SlaEvaluator.isBreached(ticket, now) || !SlaEvaluator.isAtRisk(ticket, now)) {
            return;
        }
        if (notificationRepository.existsByTicket_IdAndTypeAndCreatedAtAfter(
                ticket.getId(), TYPE_SLA_AT_RISK, now.minus(1, ChronoUnit.DAYS))) {
            return;
        }
        String no = ticket.getTicketNo() != null ? ticket.getTicketNo() : "#" + ticket.getId();
        for (User u : distinctRecipients(ticket)) {
            persist(
                    u,
                    ticket,
                    TYPE_SLA_AT_RISK,
                    "SLA uyarısı",
                    no + " çözüm hedefine yaklaşıyor.");
        }
    }

    @Transactional
    public void maybeNotifySlaBreached(Ticket ticket, boolean wasBreachedBefore, Instant now) {
        if (!ticket.isSlaBreached() || wasBreachedBefore) {
            return;
        }
        String no = ticket.getTicketNo() != null ? ticket.getTicketNo() : "#" + ticket.getId();
        for (User u : distinctRecipients(ticket)) {
            persist(
                    u,
                    ticket,
                    TYPE_SLA_BREACHED,
                    "SLA ihlali",
                    no + " için çözüm hedefi aşıldı.");
        }
    }

    private static List<User> distinctRecipients(Ticket ticket) {
        Set<Long> seen = new LinkedHashSet<>();
        List<User> out = new ArrayList<>();
        if (ticket.getCreatedBy() != null && seen.add(ticket.getCreatedBy().getId())) {
            out.add(ticket.getCreatedBy());
        }
        if (ticket.getAssignedAgent() != null && seen.add(ticket.getAssignedAgent().getId())) {
            out.add(ticket.getAssignedAgent());
        }
        return out;
    }

    private static String statusLabel(TicketStatus s) {
        return switch (s) {
            case NEW -> "Yeni";
            case IN_PROGRESS -> "İşlemde";
            case WAITING_FOR_CUSTOMER -> "Müşteri yanıtı bekleniyor";
            case RESOLVED -> "Çözüldü";
            case CLOSED -> "Kapatıldı";
        };
    }

    private void persist(User user, Ticket ticket, String type, String title, String message) {
        Notification n = new Notification();
        n.setUser(user);
        n.setTicket(ticket);
        n.setType(type);
        n.setTitle(title);
        n.setMessage(message);
        n.setCreatedAt(Instant.now());
        n.setRead(false);
        notificationRepository.save(n);

        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            String ticketNo = ticket != null && ticket.getTicketNo() != null
                    ? ticket.getTicketNo()
                    : "";
            String subject = "[KaizenDesk] " + title
                    + (ticketNo.isEmpty() ? "" : " — " + ticketNo);
            emailService.send(user.getEmail(), subject, title, message);
        }
    }
}
