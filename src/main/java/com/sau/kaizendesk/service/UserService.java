package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.domain.enums.UserRole;
import com.sau.kaizendesk.dto.UserResponse;
import com.sau.kaizendesk.repository.UserRepository;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.oauth2.jwt.Jwt;

@Service
@Transactional(readOnly = true)
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final EmailService emailService;
    private final KeycloakAccountService keycloakAccountService;

    public UserService(
            UserRepository userRepository,
            EmailService emailService,
            KeycloakAccountService keycloakAccountService
    ) {
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.keycloakAccountService = keycloakAccountService;
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

        if (user.getDeletedAt() != null) {
            throw new IllegalArgumentException("Hesap bulunamadı");
        }

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
        if (user.getId() == null) {
            user = userRepository.save(user);
            emailService.send(
                    user.getEmail(),
                    "KaizenDesk'e Hoş Geldiniz",
                    "Hesabınız Oluşturuldu",
                    "Merhaba " + user.getName() + ", KaizenDesk hesabınız başarıyla oluşturuldu. Sisteme giriş yapabilirsiniz."
            );
        } else if (changed) {
            user = userRepository.save(user);
        }

        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setName(user.getName());
        response.setEmail(user.getEmail());
        response.setRole(user.getRole());
        response.setTeam(user.getTeam());
        return response;
    }

    public List<UserResponse> getAgentList() {
        List<UserRole> agentRoles = List.of(UserRole.AGENT, UserRole.MANAGER);
        return agentRoles.stream()
                .flatMap(role -> userRepository.findByRole(role).stream())
                .filter(u -> u.getDeletedAt() == null)
                .map(u -> {
                    UserResponse r = new UserResponse();
                    r.setId(u.getId());
                    r.setUsername(u.getUsername());
                    r.setName(u.getName());
                    r.setEmail(u.getEmail());
                    r.setRole(u.getRole());
                    r.setTeam(u.getTeam());
                    return r;
                })
                .toList();
    }

    @Transactional
    public UserResponse updateAgentTeam(Long agentId, String team) {
        User user = userRepository.findById(agentId)
                .orElseThrow(() -> new IllegalArgumentException("Kullanıcı bulunamadı: " + agentId));
        user.setTeam(team == null || team.isBlank() ? null : team.trim());
        user = userRepository.save(user);
        UserResponse r = new UserResponse();
        r.setId(user.getId());
        r.setName(user.getName());
        r.setEmail(user.getEmail());
        r.setRole(user.getRole());
        r.setTeam(user.getTeam());
        return r;
    }

    @Transactional
    public void notifyLoginFailures(String usernameOrEmail) {
        if (usernameOrEmail == null || usernameOrEmail.isBlank()) {
            return;
        }
        String normalized = usernameOrEmail.trim();
        var userOpt = normalized.contains("@")
                ? userRepository.findByEmailIgnoreCase(normalized)
                : userRepository.findByUsername(normalized);
        userOpt.ifPresent(user -> {
            if (user.getDeletedAt() != null || user.getEmail() == null || user.getEmail().isBlank()) {
                return;
            }
            emailService.send(
                    user.getEmail(),
                    "Giriş Güvenlik Uyarısı",
                    "Art arda başarısız giriş denemesi",
                    "Merhaba " + user.getName()
                            + ", hesabınız için art arda hatalı giriş denemeleri tespit edildi. "
                            + "Bu giriş denemesi size ait değilse lütfen şifrenizi değiştirin ve 2FA doğrulamasını kontrol edin."
            );
            log.warn("Başarısız giriş denemesi uyarısı gönderildi: username={}, email={}",
                    user.getUsername(), user.getEmail());
        });
    }

    @Transactional
    public void softDeleteCurrentAccount(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalArgumentException("jwt is required");
        }
        String username = jwt.getClaimAsString("preferred_username");
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("preferred_username claim is missing");
        }
        if (resolveRole(jwt) != UserRole.CUSTOMER) {
            throw new IllegalArgumentException("Yalnızca müşteri hesapları silinebilir.");
        }

        User user = userRepository.findByUsername(username).orElse(null);
        if (user != null && user.getDeletedAt() != null) {
            throw new IllegalArgumentException("Hesap zaten silinmiş.");
        }

        String originalEmail = user != null ? user.getEmail() : jwt.getClaimAsString("email");
        String originalName = user != null ? user.getName() : resolveFullName(jwt, username);

        if (user != null) {
            user.setDeletedAt(Instant.now());
            user.setName("Silinmiş Kullanıcı");
            user.setEmail("deleted-" + user.getId() + "@removed.kaizendesk.local");
            userRepository.save(user);
        }

        keycloakAccountService.disableUser(username);

        if (originalEmail != null && !originalEmail.isBlank()) {
            emailService.send(
                    originalEmail,
                    "KaizenDesk Hesap Silme Onayı",
                    "Hesabınız devre dışı bırakıldı",
                    "Merhaba " + originalName
                            + ", KaizenDesk hesabınız soft delete ile kapatıldı. "
                            + "Geçmiş destek talepleriniz anonim olarak saklanmaya devam edecektir."
            );
        }

        log.warn("Müşteri hesabı soft delete ile kapatıldı: username={}, userId={}",
                username, user != null ? user.getId() : null);
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
