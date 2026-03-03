package com.sau.kaizendesk.controller;

import com.sau.kaizendesk.dto.NotificationResponse;
import com.sau.kaizendesk.service.NotificationService;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @GetMapping
    public ResponseEntity<List<NotificationResponse>> getNotifications(
            @AuthenticationPrincipal Jwt jwt
    ) {
        String username = jwt.getClaimAsString("preferred_username");
        return ResponseEntity.ok(notificationService.getUserNotifications(username));
    }
}
