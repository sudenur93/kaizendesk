package com.sau.kaizendesk.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.repository.NotificationRepository;
import com.sau.kaizendesk.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    NotificationRepository notificationRepository;

    @Mock
    UserRepository userRepository;

    @InjectMocks
    NotificationService notificationService;

    @AfterEach
    void tearDown() {
        verifyNoMoreInteractions(notificationRepository);
    }

    @Test
    void getUserNotifications_customer_usesScopedQuery() {
        User u = new User();
        u.setId(10L);
        u.setUsername("cust");
        when(userRepository.findByUsername("cust")).thenReturn(Optional.of(u));
        when(notificationRepository.findForCustomerRecipient(10L, "cust")).thenReturn(List.of());

        notificationService.getUserNotifications("cust", true);

        verify(notificationRepository).findForCustomerRecipient(10L, "cust");
    }

    @Test
    void getUserNotifications_agent_usesFullRecipientQuery() {
        User u = new User();
        u.setId(20L);
        u.setUsername("agent1");
        when(userRepository.findByUsername("agent1")).thenReturn(Optional.of(u));
        when(notificationRepository.findByUser_IdOrderByCreatedAtDesc(20L)).thenReturn(List.of());

        notificationService.getUserNotifications("agent1", false);

        verify(notificationRepository).findByUser_IdOrderByCreatedAtDesc(20L);
    }

    @Test
    void getUserNotifications_unknownUser_throws() {
        when(userRepository.findByUsername("x")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> notificationService.getUserNotifications("x", false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User not found");
    }
}
