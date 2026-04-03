package com.sau.kaizendesk.controller;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sau.kaizendesk.config.SecurityConfig;
import com.sau.kaizendesk.dto.DashboardSummaryResponse;
import com.sau.kaizendesk.service.DashboardService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = DashboardController.class)
@Import(SecurityConfig.class)
class DashboardControllerMvcTest {

	@Autowired
	MockMvc mockMvc;

	@MockitoBean
	DashboardService dashboardService;

	@MockitoBean
	JwtDecoder jwtDecoder;

	@Test
	void summary_withoutAuth_returns401() throws Exception {
		mockMvc.perform(get("/api/v1/dashboard/summary"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	void summary_asAgent_returns403() throws Exception {
		mockMvc.perform(get("/api/v1/dashboard/summary")
						.with(jwt().authorities(new SimpleGrantedAuthority("ROLE_AGENT"))))
				.andExpect(status().isForbidden());
	}

	@Test
	void summary_asManager_returns200() throws Exception {
		DashboardSummaryResponse body = new DashboardSummaryResponse();
		body.setTotalTickets(10);
		body.setOpenTickets(3);
		body.setInProgressTickets(2);
		body.setResolvedTickets(5);
		when(dashboardService.getSummary()).thenReturn(body);

		mockMvc.perform(get("/api/v1/dashboard/summary")
						.with(jwt().authorities(new SimpleGrantedAuthority("ROLE_MANAGER"))))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalTickets").value(10))
				.andExpect(jsonPath("$.openTickets").value(3));
	}
}
