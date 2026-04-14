package com.sau.kaizendesk.repository;

import com.sau.kaizendesk.domain.entity.SlaPolicy;
import com.sau.kaizendesk.domain.enums.TicketPriority;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SlaPolicyRepository extends JpaRepository<SlaPolicy, Long> {

    Optional<SlaPolicy> findByPriority(TicketPriority priority);
}
