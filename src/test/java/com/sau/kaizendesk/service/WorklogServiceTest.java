package com.sau.kaizendesk.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.domain.entity.Worklog;
import com.sau.kaizendesk.dto.CreateWorklogRequest;
import com.sau.kaizendesk.repository.TicketRepository;
import com.sau.kaizendesk.repository.UserRepository;
import com.sau.kaizendesk.repository.WorklogRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class WorklogServiceTest {

    @Mock
    WorklogRepository worklogRepository;
    @Mock
    TicketRepository ticketRepository;
    @Mock
    UserRepository userRepository;

    @InjectMocks
    WorklogService worklogService;

    @Test
    void addWorklog_persistsWithJwtAuthor() {
        Ticket ticket = new Ticket();
        ticket.setId(5L);
        User agent = new User();
        agent.setId(9L);
        agent.setUsername("agent1");
        when(ticketRepository.findById(5L)).thenReturn(Optional.of(ticket));
        when(userRepository.findByUsername("agent1")).thenReturn(Optional.of(agent));
        when(worklogRepository.save(any(Worklog.class)))
                .thenAnswer(
                        inv -> {
                            Worklog w = inv.getArgument(0);
                            w.setId(100L);
                            return w;
                        });

        CreateWorklogRequest req = new CreateWorklogRequest();
        req.setTimeSpent(45L);
        req.setWorkDate(LocalDate.of(2026, 4, 1));
        req.setNote("Debug");

        var r = worklogService.addWorklog(5L, req, "agent1");
        assertThat(r.getId()).isEqualTo(100L);
        assertThat(r.getTimeSpent()).isEqualTo(45L);
        assertThat(r.getAuthorUsername()).isEqualTo("agent1");

        ArgumentCaptor<Worklog> cap = ArgumentCaptor.forClass(Worklog.class);
        verify(worklogRepository).save(cap.capture());
        assertThat(cap.getValue().getDurationMinutes()).isEqualTo(45);
        assertThat(cap.getValue().getWorkDate()).isEqualTo(LocalDate.of(2026, 4, 1));
    }

    @Test
    void getWorklogs_unknownTicket_throws() {
        when(ticketRepository.existsById(1L)).thenReturn(false);
        assertThatThrownBy(() -> worklogService.getWorklogs(1L))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Ticket not found");
    }

    @Test
    void getWorklogs_returnsOrdered() {
        when(ticketRepository.existsById(1L)).thenReturn(true);
        Ticket t = new Ticket();
        t.setId(1L);
        User u = new User();
        u.setId(2L);
        u.setUsername("a");
        Worklog w = new Worklog();
        w.setId(10L);
        w.setTicket(t);
        w.setUser(u);
        w.setWorkDate(LocalDate.of(2026, 4, 2));
        w.setDurationMinutes(30);
        when(worklogRepository.findByTicket_IdOrderByCreatedAtAsc(1L)).thenReturn(List.of(w));

        var list = worklogService.getWorklogs(1L);
        assertThat(list).hasSize(1);
        assertThat(list.getFirst().getTimeSpent()).isEqualTo(30L);
    }
}
