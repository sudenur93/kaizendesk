package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.domain.enums.UserRole;
import com.sau.kaizendesk.dto.UserResponse;
import com.sau.kaizendesk.repository.UserRepository;
import java.util.Collection;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.oauth2.jwt.Jwt;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional
    public UserResponse getCurrentUser(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("jwt is required");
        }
        String username = jwt.getClaimAsString("preferred_username");
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("preferred_username claim is missing");
        }

        String email = jwt.getClaimAsString("email");
        String fullName = resolveFullName(jwt, username);
        UserRole role = resolveRole(jwt);

        User user = userRepository.findByUsername(username).orElseGet(() -> {
            User created = new User();
            created.setUsername(username);
            created.setName(fullName);
            created.setEmail(email != null ? email : username + "@example.local");
            created.setRole(role);
            return created;
        });

        boolean changed = false;
        if (user.getName() == null || !user.getName().equals(fullName)) {
            user.setName(fullName);
            changed = true;
        }
        if (email != null && (user.getEmail() == null || !user.getEmail().equals(email))) {
            user.setEmail(email);
            changed = true;
        }
        if (role != null && user.getRole() != role) {
            user.setRole(role);
            changed = true;
        }
        if (user.getId() == null || changed) {
            user = userRepository.save(user);
        }

        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setName(user.getName());
        response.setEmail(user.getEmail());
        response.setRole(user.getRole());
        return response;
    }

    private static String resolveFullName(Jwt jwt, String fallbackUsername) {
        String name = jwt.getClaimAsString("name");
        if (name != null && !name.isBlank()) {
            return name;
        }
        String given = jwt.getClaimAsString("given_name");
        String family = jwt.getClaimAsString("family_name");
        String combined = ((given != null ? given : "") + " " + (family != null ? family : "")).trim();
        return combined.isBlank() ? fallbackUsername : combined;
    }

    private static UserRole resolveRole(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess == null) {
            return UserRole.CUSTOMER;
        }
        Object rolesObj = realmAccess.get("roles");
        if (!(rolesObj instanceof Collection<?> roles)) {
            return UserRole.CUSTOMER;
        }
        boolean isManager = roles.stream().anyMatch(r -> "MANAGER".equalsIgnoreCase(String.valueOf(r)));
        if (isManager) {
            return UserRole.MANAGER;
        }
        boolean isAgent = roles.stream().anyMatch(r -> "AGENT".equalsIgnoreCase(String.valueOf(r)));
        if (isAgent) {
            return UserRole.AGENT;
        }
        return UserRole.CUSTOMER;
    }
}
