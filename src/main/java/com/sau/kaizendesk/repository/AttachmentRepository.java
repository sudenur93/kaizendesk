package com.sau.kaizendesk.repository;

import com.sau.kaizendesk.domain.entity.Attachment;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    List<Attachment> findByTicket_IdOrderByCreatedAtDesc(Long ticketId);

    Optional<Attachment> findByIdAndTicket_Id(Long id, Long ticketId);
}
