package com.sau.kaizendesk.repository;

import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {

    List<Ticket> findByStatus(TicketStatus status);

    long countByStatus(TicketStatus status);

    long countBySlaBreachedTrue();

    long countByClosedAtAfter(Instant since);

    @Query("SELECT AVG(CAST((EXTRACT(EPOCH FROM t.resolvedAt) - EXTRACT(EPOCH FROM t.createdAt)) AS double) / 60) "
            + "FROM Ticket t WHERE t.resolvedAt IS NOT NULL")
    Double findAverageResolutionMinutes();

    @Query("SELECT t.assignedAgent.id, t.assignedAgent.name, "
            + "COUNT(t), "
            + "SUM(CASE WHEN t.status = 'RESOLVED' OR t.status = 'CLOSED' THEN 1 ELSE 0 END), "
            + "SUM(CASE WHEN t.status = 'CLOSED' THEN 1 ELSE 0 END), "
            + "AVG(CASE WHEN t.resolvedAt IS NOT NULL "
            + "  THEN CAST((EXTRACT(EPOCH FROM t.resolvedAt) - EXTRACT(EPOCH FROM t.createdAt)) AS double) / 60 "
            + "  ELSE NULL END) "
            + "FROM Ticket t WHERE t.assignedAgent IS NOT NULL "
            + "GROUP BY t.assignedAgent.id, t.assignedAgent.name")
    List<Object[]> findAgentPerformanceStats();
}
