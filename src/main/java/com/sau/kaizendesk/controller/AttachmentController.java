package com.sau.kaizendesk.controller;

import com.sau.kaizendesk.dto.AttachmentFileDownload;
import com.sau.kaizendesk.dto.AttachmentResponse;
import com.sau.kaizendesk.security.JwtRealmRoles;
import com.sau.kaizendesk.service.AttachmentService;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.core.io.Resource;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/tickets/{ticketId}/attachments")
public class AttachmentController {

    private final AttachmentService attachmentService;

    public AttachmentController(AttachmentService attachmentService) {
        this.attachmentService = attachmentService;
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @PostMapping
    public ResponseEntity<AttachmentResponse> uploadAttachment(
            @PathVariable Long ticketId,
            @RequestParam("file") MultipartFile file,
			@AuthenticationPrincipal Jwt jwt
    ) {
		String username = jwt.getClaimAsString("preferred_username");
		boolean isCustomer = JwtRealmRoles.isCustomer(jwt);
        return ResponseEntity.ok(attachmentService.upload(ticketId, file, username, isCustomer));
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @GetMapping
    public ResponseEntity<List<AttachmentResponse>> getAttachments(
			@PathVariable Long ticketId,
			@AuthenticationPrincipal Jwt jwt
	) {
		String username = jwt.getClaimAsString("preferred_username");
		boolean isCustomer = JwtRealmRoles.isCustomer(jwt);
        return ResponseEntity.ok(attachmentService.getAttachments(ticketId, username, isCustomer));
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @GetMapping("/{attachmentId}/file")
    public ResponseEntity<Resource> downloadAttachment(
            @PathVariable Long ticketId,
            @PathVariable Long attachmentId,
            @AuthenticationPrincipal Jwt jwt) {
        String username = jwt.getClaimAsString("preferred_username");
        boolean isCustomer = JwtRealmRoles.isCustomer(jwt);
        AttachmentFileDownload file =
                attachmentService.download(ticketId, attachmentId, username, isCustomer);
        ContentDisposition disposition =
                ContentDisposition.attachment()
                        .filename(file.originalFileName(), StandardCharsets.UTF_8)
                        .build();
        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(file.contentType());
        } catch (Exception ex) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(mediaType)
                .body(file.resource());
    }
}
