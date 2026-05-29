package com.sau.kaizendesk.repository;

import com.sau.kaizendesk.domain.entity.Notification;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {

       List<Notification> findByUser_IdOrderByCreatedAtDesc(Long userId);

    boolean existsByTicket_IdAndTypeAndCreatedAtAfter(Long ticketId, String type, Instant createdAt);

    /**
     * Müşteri: yalnızca kendi hesabına gelen ve (ticket yoksa veya ticket'ı kendisi oluşturduysa) kayıtlar.
     */
    @Query(
            """
            SELECT n FROM Notification n
            LEFT JOIN n.ticket t
            WHERE n.user.id = :userId
            AND (t IS NULL OR t.createdBy.username = :username)
            ORDER BY n.createdAt DESC
            """)
    List<Notification> findForCustomerRecipient(
            @Param("userId") Long userId, @Param("username") String username);
}
