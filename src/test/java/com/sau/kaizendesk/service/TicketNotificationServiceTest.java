package com.sau.kaizendesk.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import com.sau.kaizendesk.repository.NotificationRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TicketNotificationServiceTest {

    @Mock
    NotificationRepository notificationRepository;

    @InjectMocks
    TicketNotificationService ticketNotificationService;

    @Test
    void onTicketCreated_persistsNotification() {
        User u = new User();
        u.setId(1L);
        Ticket t = new Ticket();
        t.setId(10L);
        t.setCreatedBy(u);
        t.setTicketNo("KD-X");
        t.setTitle("Başlık");

        ticketNotificationService.onTicketCreated(t);

        verify(notificationRepository).save(any());
    }

    @Test
    void maybeNotifySlaAtRisk_skipsWhenRecentExists() {
        User u = new User();
        u.setId(1L);
        Ticket t = new Ticket();
        t.setId(5L);
        t.setCreatedBy(u);
        t.setStatus(TicketStatus.IN_PROGRESS);
        t.setTicketNo("KD-1");
        t.setTitle("A");
        Instant created = Instant.parse("2026-04-01T10:00:00Z");
        t.setCreatedAt(created);
        t.setSlaTargetAt(created.plus(2, ChronoUnit.HOURS));
        Instant now = created.plus(100, ChronoUnit.MINUTES);
        when(notificationRepository.existsByTicket_IdAndTypeAndCreatedAtAfter(
                        eq(5L), eq(TicketNotificationService.TYPE_SLA_AT_RISK), any()))
                .thenReturn(true);

        ticketNotificationService.maybeNotifySlaAtRisk(t, now);

        verify(notificationRepository, never()).save(any());
    }
}
