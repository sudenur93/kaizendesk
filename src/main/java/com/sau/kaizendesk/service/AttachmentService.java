package com.sau.kaizendesk.service;

import com.sau.kaizendesk.config.AttachmentStorageProperties;
import com.sau.kaizendesk.domain.entity.Attachment;
import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.dto.AttachmentFileDownload;
import com.sau.kaizendesk.dto.AttachmentResponse;
import com.sau.kaizendesk.repository.AttachmentRepository;
import com.sau.kaizendesk.repository.TicketRepository;
import com.sau.kaizendesk.repository.UserRepository;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional(readOnly = true)
public class AttachmentService {

    private final TicketRepository ticketRepository;
    private final TicketAccessService ticketAccessService;
    private final AttachmentRepository attachmentRepository;
    private final UserRepository userRepository;
    private final AttachmentFileStorage attachmentFileStorage;
    private final AttachmentStorageProperties attachmentStorageProperties;

    public AttachmentService(
            TicketRepository ticketRepository,
            TicketAccessService ticketAccessService,
            AttachmentRepository attachmentRepository,
            UserRepository userRepository,
            AttachmentFileStorage attachmentFileStorage,
            AttachmentStorageProperties attachmentStorageProperties) {
        this.ticketRepository = ticketRepository;
        this.ticketAccessService = ticketAccessService;
        this.attachmentRepository = attachmentRepository;
        this.userRepository = userRepository;
        this.attachmentFileStorage = attachmentFileStorage;
        this.attachmentStorageProperties = attachmentStorageProperties;
    }

    @Transactional
    public AttachmentResponse upload(Long ticketId, MultipartFile file, String username, boolean isCustomer) {
        Ticket ticket =
                ticketRepository
                        .findById(ticketId)
                        .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketId));
        ticketAccessService.requireAccessIfCustomer(ticket, username, isCustomer);

        AttachmentMimeRules.validate(file, attachmentStorageProperties.getMaxFileSizeBytes());

        User uploader =
                userRepository
                        .findByUsername(username)
                        .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));

        String original = AttachmentMimeRules.safeOriginalFileName(file.getOriginalFilename());
        String ext = AttachmentMimeRules.extensionFromOriginalName(file.getOriginalFilename());
        String storedName = UUID.randomUUID().toString().toLowerCase(Locale.ROOT) + ext;

        try (InputStream in = file.getInputStream()) {
            attachmentFileStorage.store(ticketId, storedName, in);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to store attachment", e);
        }

        Attachment row = new Attachment();
        row.setTicket(ticket);
        row.setOriginalFileName(original);
        row.setStoredFileName(storedName);
        row.setContentType(StringUtils.hasText(file.getContentType()) ? file.getContentType().trim() : null);
        row.setFileSizeBytes(file.getSize());
        row.setUploadedBy(uploader);
        row.setCreatedAt(Instant.now());

        return toResponse(attachmentRepository.save(row));
    }

    public List<AttachmentResponse> getAttachments(Long ticketId, String username, boolean isCustomer) {
        Ticket ticket =
                ticketRepository
                        .findById(ticketId)
                        .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketId));
        ticketAccessService.requireAccessIfCustomer(ticket, username, isCustomer);
        return attachmentRepository.findByTicket_IdOrderByCreatedAtDesc(ticketId).stream()
                .map(this::toResponse)
                .toList();
    }

    public AttachmentFileDownload download(
            Long ticketId, Long attachmentId, String username, boolean isCustomer) {
        Ticket ticket =
                ticketRepository
                        .findById(ticketId)
                        .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + ticketId));
        ticketAccessService.requireAccessIfCustomer(ticket, username, isCustomer);

        Attachment att =
                attachmentRepository
                        .findByIdAndTicket_Id(attachmentId, ticketId)
                        .orElseThrow(() -> new IllegalArgumentException("Attachment not found: " + attachmentId));

        if (!attachmentFileStorage.exists(ticketId, att.getStoredFileName())) {
            throw new IllegalStateException("Stored file missing for attachment: " + attachmentId);
        }

        Resource resource =
                new FileSystemResource(attachmentFileStorage.resolveStoredFile(ticketId, att.getStoredFileName()));

        String ct = StringUtils.hasText(att.getContentType()) ? att.getContentType() : "application/octet-stream";
        return new AttachmentFileDownload(att.getOriginalFileName(), ct, resource);
    }

    private AttachmentResponse toResponse(Attachment a) {
        AttachmentResponse r = new AttachmentResponse();
        r.setId(a.getId());
        r.setTicketId(a.getTicket().getId());
        r.setOriginalFileName(a.getOriginalFileName());
        r.setContentType(a.getContentType());
        r.setFileSizeBytes(a.getFileSizeBytes());
        r.setUploadedBy(a.getUploadedBy() != null ? a.getUploadedBy().getId() : null);
        r.setCreatedAt(a.getCreatedAt());
        return r;
    }
}
