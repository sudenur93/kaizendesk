package com.sau.kaizendesk.service;

import com.sau.kaizendesk.dto.NotificationResponse;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class NotificationService {

    public List<NotificationResponse> getUserNotifications(String username) {
        return List.of();
    }
}
