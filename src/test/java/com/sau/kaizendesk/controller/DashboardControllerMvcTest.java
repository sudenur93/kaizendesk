package com.sau.kaizendesk.controller;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sau.kaizendesk.config.SecurityConfig;
import com.sau.kaizendesk.dto.DashboardSummaryResponse;
import com.sau.kaizendesk.dto.DashboardSummaryResponse.AgentPerformance;
import com.sau.kaizendesk.service.DashboardService;
import java.util.List;
import java.util.Map;
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
    void summary_asManager_returns200WithAllFields() throws Exception {
        AgentPerformance ap = new AgentPerformance();
        ap.setAgentId(5L);
        ap.setAgentName("Ahmet Usta");
        ap.setAssignedCount(8);
        ap.setResolvedCount(6);
        ap.setClosedCount(3);
        ap.setAvgResolutionMinutes(120L);

        DashboardSummaryResponse body = new DashboardSummaryResponse();
        body.setTotalTickets(20);
        body.setOpenTickets(4);
        body.setInProgressTickets(5);
        body.setWaitingForCustomerTickets(1);
        body.setResolvedTickets(7);
        body.setClosedTickets(3);
        body.setSlaBreachedCount(2);
        body.setClosedToday(1);
        body.setAvgResolutionMinutes(90L);
        body.setStatusCounts(Map.of("NEW", 4L, "IN_PROGRESS", 5L));
        body.setPriorityCounts(Map.of("HIGH", 6L, "MEDIUM", 10L, "LOW", 4L));
        body.setProductCounts(Map.of("ERP", 12L, "CRM", 8L));
        body.setAgentPerformances(List.of(ap));

        body.setSlaComplianceRate(85.7);
        body.setClosedInRange(2);

        when(dashboardService.getSummary(null, null)).thenReturn(body);

        mockMvc.perform(get("/api/v1/dashboard/summary")
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_MANAGER"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalTickets").value(20))
                .andExpect(jsonPath("$.openTickets").value(4))
                .andExpect(jsonPath("$.inProgressTickets").value(5))
                .andExpect(jsonPath("$.resolvedTickets").value(7))
                .andExpect(jsonPath("$.closedTickets").value(3))
                .andExpect(jsonPath("$.slaBreachedCount").value(2))
                .andExpect(jsonPath("$.closedToday").value(1))
                .andExpect(jsonPath("$.avgResolutionMinutes").value(90))
                .andExpect(jsonPath("$.statusCounts.NEW").value(4))
                .andExpect(jsonPath("$.priorityCounts.HIGH").value(6))
                .andExpect(jsonPath("$.productCounts.ERP").value(12))
                .andExpect(jsonPath("$.agentPerformances[0].agentId").value(5))
                .andExpect(jsonPath("$.agentPerformances[0].assignedCount").value(8))
                .andExpect(jsonPath("$.agentPerformances[0].avgResolutionMinutes").value(120))
                .andExpect(jsonPath("$.slaComplianceRate").value(85.7))
                .andExpect(jsonPath("$.closedInRange").value(2));
    }
}
