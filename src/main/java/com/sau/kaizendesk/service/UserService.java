package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.dto.UserResponse;
import com.sau.kaizendesk.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UserResponse getCurrentUser(String username) {
        User user = userRepository.findByUsername(username).orElse(null);

        UserResponse response = new UserResponse();
        if (user != null) {
            response.setId(user.getId());
            response.setName(user.getName());
            response.setEmail(user.getEmail());
            response.setRole(user.getRole());
            return response;
        }

        response.setName(username);
        response.setEmail(username != null ? username + "@example.local" : null);
        return response;
    }
}
