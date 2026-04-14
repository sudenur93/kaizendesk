package com.sau.kaizendesk.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import com.sau.kaizendesk.repository.CategoryRepository;
import com.sau.kaizendesk.repository.IssueTypeRepository;
import com.sau.kaizendesk.repository.ProductRepository;
import com.sau.kaizendesk.repository.SlaPolicyRepository;
import com.sau.kaizendesk.repository.TicketRepository;
import com.sau.kaizendesk.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TicketServiceStatusTest {

	@Mock
	TicketRepository ticketRepository;
	@Mock
	UserRepository userRepository;
	@Mock
	ProductRepository productRepository;
	@Mock
	CategoryRepository categoryRepository;
	@Mock
	IssueTypeRepository issueTypeRepository;
	@Mock
	SlaPolicyRepository slaPolicyRepository;
	@Mock
	TicketNotificationService ticketNotificationService;

	@InjectMocks
	TicketService ticketService;

	@Test
	void updateStatus_newToInProgress_succeeds() {
		Ticket t = ticket(TicketStatus.NEW);
		when(ticketRepository.findById(1L)).thenReturn(Optional.of(t));
		when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));

		var r = ticketService.updateStatus(1L, TicketStatus.IN_PROGRESS, null);
		assertThat(r.getStatus()).isEqualTo(TicketStatus.IN_PROGRESS);
	}

	@Test
	void updateStatus_newToClosed_rejected() {
		Ticket t = ticket(TicketStatus.NEW);
		when(ticketRepository.findById(1L)).thenReturn(Optional.of(t));

		assertThatThrownBy(() -> ticketService.updateStatus(1L, TicketStatus.CLOSED, null))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("Geçersiz statü");
	}

	@Test
	void updateStatus_toResolved_withoutNote_rejected() {
		Ticket t = ticket(TicketStatus.IN_PROGRESS);
		when(ticketRepository.findById(1L)).thenReturn(Optional.of(t));

		assertThatThrownBy(() -> ticketService.updateStatus(1L, TicketStatus.RESOLVED, null))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("Çözüm notu");
	}

	@Test
	void updateStatus_inProgressToResolvedWithNote_setsFields() {
		Ticket t = ticket(TicketStatus.IN_PROGRESS);
		when(ticketRepository.findById(1L)).thenReturn(Optional.of(t));
		when(ticketRepository.save(any(Ticket.class))).thenAnswer(inv -> inv.getArgument(0));

		var r = ticketService.updateStatus(1L, TicketStatus.RESOLVED, "Düzeltildi");
		assertThat(r.getStatus()).isEqualTo(TicketStatus.RESOLVED);
		assertThat(r.getResolutionNote()).isEqualTo("Düzeltildi");
		assertThat(t.getResolvedAt()).isNotNull();
	}

	@Test
	void updateStatus_directCloseFromInProgress_rejected() {
		Ticket t = ticket(TicketStatus.IN_PROGRESS);
		when(ticketRepository.findById(1L)).thenReturn(Optional.of(t));

		assertThatThrownBy(() -> ticketService.updateStatus(1L, TicketStatus.CLOSED, null))
				.isInstanceOf(IllegalArgumentException.class);
	}

	private static Ticket ticket(TicketStatus status) {
		Ticket t = new Ticket();
		t.setId(1L);
		t.setStatus(status);
		return t;
	}
}
