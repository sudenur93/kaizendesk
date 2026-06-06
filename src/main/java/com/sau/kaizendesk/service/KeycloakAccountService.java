package com.sau.kaizendesk.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Service
public class KeycloakAccountService {

    private static final Logger log = LoggerFactory.getLogger(KeycloakAccountService.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String adminUrl;
    private final String realm;
    private final String adminUsername;
    private final String adminPassword;

    public KeycloakAccountService(
            ObjectMapper objectMapper,
            @Value("${kaizendesk.keycloak.admin-url:http://localhost:8081}") String adminUrl,
            @Value("${kaizendesk.keycloak.realm:kaizendesk}") String realm,
            @Value("${kaizendesk.keycloak.admin-username:admin}") String adminUsername,
            @Value("${kaizendesk.keycloak.admin-password:admin}") String adminPassword
    ) {
        this.objectMapper = objectMapper;
        this.adminUrl = adminUrl.replaceAll("/$", "");
        this.realm = realm;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
        this.restClient = RestClient.create();
    }

    public void disableUser(String username) {
        try {
            String token = fetchAdminToken();
            if (token == null) {
                throw new IllegalStateException("Keycloak admin token alınamadı.");
            }

            List<Map<String, Object>> users = restClient.get()
                    .uri(adminUrl + "/admin/realms/{realm}/users?username={username}&exact=true",
                            realm, username)
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .body(new org.springframework.core.ParameterizedTypeReference<List<Map<String, Object>>>() {});

            if (users == null || users.isEmpty()) {
                log.warn("Keycloak kullanıcısı bulunamadı, devre dışı bırakılamadı: {}", username);
                return;
            }

            String userId = String.valueOf(users.get(0).get("id"));
            restClient.put()
                    .uri(adminUrl + "/admin/realms/{realm}/users/{userId}", realm, userId)
                    .header("Authorization", "Bearer " + token)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("enabled", false))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception ex) {
            log.error("Keycloak kullanıcısı devre dışı bırakılamadı: username={}", username, ex);
            throw new IllegalStateException("Hesap Keycloak üzerinde devre dışı bırakılamadı.");
        }
    }

    private String fetchAdminToken() {
        try {
            MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("client_id", "admin-cli");
            form.add("grant_type", "password");
            form.add("username", adminUsername);
            form.add("password", adminPassword);

            String response = restClient.post()
                    .uri(adminUrl + "/realms/master/protocol/openid-connect/token")
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(String.class);

            if (response == null || response.isBlank()) {
                return null;
            }

            Map<String, Object> tokenResponse = objectMapper.readValue(response, new TypeReference<>() {});
            Object accessToken = tokenResponse.get("access_token");
            return accessToken == null ? null : String.valueOf(accessToken);
        } catch (Exception ex) {
            log.warn("Keycloak admin token alınamadı: {}", ex.getMessage());
            return null;
        }
    }
}
