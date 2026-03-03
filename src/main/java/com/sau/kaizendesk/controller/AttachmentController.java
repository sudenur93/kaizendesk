package com.sau.kaizendesk.controller;

import com.sau.kaizendesk.dto.AttachmentResponse;
import com.sau.kaizendesk.service.AttachmentService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
            @RequestParam("file") MultipartFile file
    ) {
        return ResponseEntity.ok(attachmentService.upload(ticketId, file));
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @GetMapping
    public ResponseEntity<List<AttachmentResponse>> getAttachments(@PathVariable Long ticketId) {
        return ResponseEntity.ok(attachmentService.getAttachments(ticketId));
    }
}
