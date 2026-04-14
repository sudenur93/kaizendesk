package com.sau.kaizendesk.security;

import java.util.List;
import java.util.Map;
import org.springframework.security.oauth2.jwt.Jwt;

public final class JwtRealmRoles {

    private JwtRealmRoles() {
    }

    /**
     * Keycloak JWT {@code realm_access.roles} içinde CUSTOMER var mı (liste görünümü / sahiplik kontrolü).
     */
    public static boolean isCustomer(Jwt jwt) {
        if (jwt == null) {
            return false;
        }
        Object realmAccess = jwt.getClaim("realm_access");
        if (!(realmAccess instanceof Map)) {
            return false;
        }
        Map<?, ?> map = (Map<?, ?>) realmAccess;
        Object rolesObj = map.get("roles");
        if (!(rolesObj instanceof List)) {
            return false;
        }
        List<?> roles = (List<?>) rolesObj;
        return roles.contains("CUSTOMER");
    }
}
