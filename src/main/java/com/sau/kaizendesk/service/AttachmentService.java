package com.sau.kaizendesk.service;

import com.sau.kaizendesk.dto.AttachmentResponse;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional(readOnly = true)
public class AttachmentService {

    @Transactional
    public AttachmentResponse upload(Long ticketId, MultipartFile file) {
        AttachmentResponse response = new AttachmentResponse();
        response.setTicketId(ticketId);
        response.setFileUrl(file != null ? file.getOriginalFilename() : null);
        return response;
    }

    public List<AttachmentResponse> getAttachments(Long ticketId) {
        return List.of();
    }
}
