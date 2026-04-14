package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Notification;
import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.dto.NotificationResponse;
import com.sau.kaizendesk.repository.NotificationRepository;
import com.sau.kaizendesk.repository.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationService(
            NotificationRepository notificationRepository, UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    /**
     * Bildirimler alıcı {@code user_id} ile filtrelenir. Müşteri rolünde ek olarak, ticket bağlantılı
     * kayıtlar yalnızca ticket'ı kendisinin oluşturduğu durumlarda döner (ticket'sız kayıtlar dahil).
     */
    public List<NotificationResponse> getUserNotifications(String username, boolean isCustomer) {
        Long userId =
                userRepository
                        .findByUsername(username)
                        .map(User::getId)
                        .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));
        List<Notification> rows =
                isCustomer
                        ? notificationRepository.findForCustomerRecipient(userId, username)
                        : notificationRepository.findByUser_IdOrderByCreatedAtDesc(userId);
        return rows.stream().map(this::toResponse).toList();
    }

    private NotificationResponse toResponse(Notification n) {
        NotificationResponse r = new NotificationResponse();
        r.setId(n.getId());
        r.setTicketId(n.getTicket() != null ? n.getTicket().getId() : null);
        r.setType(n.getType());
        r.setTitle(n.getTitle());
        r.setMessage(n.getMessage());
        r.setCreatedAt(n.getCreatedAt());
        r.setRead(n.isRead());
        return r;
    }
}
