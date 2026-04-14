package com.sau.kaizendesk.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sau.kaizendesk.config.SecurityConfig;
import com.sau.kaizendesk.domain.enums.TicketPriority;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import com.sau.kaizendesk.dto.CreateTicketRequest;
import com.sau.kaizendesk.dto.TicketResponse;
import com.sau.kaizendesk.dto.UpdateStatusRequest;
import com.sau.kaizendesk.service.TicketService;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = TicketController.class)
@Import(SecurityConfig.class)
class TicketControllerMvcTest {

	@Autowired
	MockMvc mockMvc;

	@Autowired
	ObjectMapper objectMapper;

	@MockitoBean
	TicketService ticketService;

	@MockitoBean
	JwtDecoder jwtDecoder;

	@Test
	void getTickets_withoutAuth_returns401() throws Exception {
		mockMvc.perform(get("/api/v1/tickets"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void patchStatus_asCustomer_returns403() throws Exception {
		UpdateStatusRequest body = new UpdateStatusRequest();
		body.setStatus(TicketStatus.IN_PROGRESS);

		mockMvc.perform(patch("/api/v1/tickets/1/status")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(body))
						.with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
				.andExpect(status().isForbidden());
	}

	@Test
	void getTickets_asCustomer_returns200() throws Exception {
		when(ticketService.getTickets(isNull(), isNull(), isNull(), eq("alice"), eq(true), isNull()))
				.thenReturn(List.of());

		mockMvc.perform(get("/api/v1/tickets")
						.with(jwt()
								.authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))
								.jwt(j -> j.claim("preferred_username", "alice")
										.claim("realm_access", Map.of("roles", List.of("CUSTOMER"))))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$").isArray());
	}

	@Test
	void createTicket_asCustomer_returns200AndUsesPreferredUsername() throws Exception {
		CreateTicketRequest req = new CreateTicketRequest();
		req.setTitle("Başlık");
		req.setDescription("Açıklama");
		req.setPriority(TicketPriority.MEDIUM);
		req.setProductId(1L);
		req.setCategoryId(1L);
		req.setIssueTypeIds(List.of(10L));

		TicketResponse saved = new TicketResponse();
		saved.setId(42L);
		saved.setTitle(req.getTitle());
		saved.setStatus(TicketStatus.NEW);

		when(ticketService.createTicket(any(CreateTicketRequest.class), eq("alice")))
				.thenReturn(saved);

		mockMvc.perform(post("/api/v1/tickets")
						.contentType(MediaType.APPLICATION_JSON)
						.content(objectMapper.writeValueAsString(req))
						.with(jwt()
								.authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))
								.jwt(j -> j.claim("preferred_username", "alice"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(42))
				.andExpect(jsonPath("$.title").value("Başlık"));

		verify(ticketService).createTicket(any(CreateTicketRequest.class), eq("alice"));
	}
}
