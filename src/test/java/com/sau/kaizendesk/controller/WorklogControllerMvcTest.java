package com.sau.kaizendesk.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sau.kaizendesk.config.SecurityConfig;
import com.sau.kaizendesk.dto.CreateWorklogRequest;
import com.sau.kaizendesk.dto.WorklogResponse;
import com.sau.kaizendesk.service.WorklogService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = WorklogController.class)
@Import(SecurityConfig.class)
class WorklogControllerMvcTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @MockitoBean
    WorklogService worklogService;

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Test
    void addWorklog_asAgent_passesUsernameToService() throws Exception {
        CreateWorklogRequest req = new CreateWorklogRequest();
        req.setTimeSpent(60L);

        WorklogResponse saved = new WorklogResponse();
        saved.setId(1L);
        saved.setTimeSpent(60L);

        when(worklogService.addWorklog(eq(10L), any(CreateWorklogRequest.class), eq("agent1")))
                .thenReturn(saved);

        mockMvc.perform(
                        post("/api/v1/tickets/10/worklogs")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req))
                                .with(
                                        jwt()
                                                .authorities(new SimpleGrantedAuthority("ROLE_AGENT"))
                                                .jwt(j -> j.claim("preferred_username", "agent1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.timeSpent").value(60));

        verify(worklogService).addWorklog(eq(10L), any(CreateWorklogRequest.class), eq("agent1"));
    }

    @Test
    void addWorklog_asCustomer_forbidden() throws Exception {
        CreateWorklogRequest req = new CreateWorklogRequest();
        req.setTimeSpent(10L);

        mockMvc.perform(
                        post("/api/v1/tickets/10/worklogs")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(req))
                                .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
                .andExpect(status().isForbidden());
    }
}
