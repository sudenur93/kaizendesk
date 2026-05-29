package com.sau.kaizendesk.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.sau.kaizendesk.config.SecurityConfig;
import com.sau.kaizendesk.dto.AttachmentFileDownload;
import com.sau.kaizendesk.dto.AttachmentResponse;
import com.sau.kaizendesk.service.AttachmentService;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = AttachmentController.class)
@Import(SecurityConfig.class)
class AttachmentControllerMvcTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    AttachmentService attachmentService;

    @MockitoBean
    JwtDecoder jwtDecoder;

    @Test
    void upload_multipart_callsService() throws Exception {
        AttachmentResponse saved = new AttachmentResponse();
        saved.setId(1L);
        when(attachmentService.upload(eq(2L), any(), eq("u1"), eq(false))).thenReturn(saved);

        var part =
                new MockMultipartFile(
                        "file", "a.txt", MediaType.TEXT_PLAIN_VALUE, "x".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(
                        multipart("/api/v1/tickets/2/attachments")
                                .file(part)
                                .with(
                                        jwt()
                                                .authorities(new SimpleGrantedAuthority("ROLE_AGENT"))
                                                .jwt(j -> j.claim("preferred_username", "u1"))))
                .andExpect(status().isOk());

        verify(attachmentService).upload(eq(2L), any(), eq("u1"), eq(false));
    }

    @Test
    void download_returns200() throws Exception {
        var res = new ByteArrayResource("ok".getBytes(StandardCharsets.UTF_8));
        when(attachmentService.download(eq(2L), eq(9L), eq("u1"), eq(false)))
                .thenReturn(new AttachmentFileDownload("a.txt", "text/plain", res));

        mockMvc.perform(
                        get("/api/v1/tickets/2/attachments/9/file")
                                .with(
                                        jwt()
                                                .authorities(new SimpleGrantedAuthority("ROLE_AGENT"))
                                                .jwt(j -> j.claim("preferred_username", "u1"))))
                .andExpect(status().isOk());
    }
}
