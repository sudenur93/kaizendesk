package com.sau.kaizendesk.repository;

import com.sau.kaizendesk.domain.entity.Worklog;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface WorklogRepository extends JpaRepository<Worklog, Long> {

    List<Worklog> findByTicket_IdOrderByCreatedAtAsc(Long ticketId);
}
