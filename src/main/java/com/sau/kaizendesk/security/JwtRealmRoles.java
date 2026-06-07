package com.sau.kaizendesk.security;

import java.util.List;
import java.util.Map;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Keycloak JWT'sindeki realm rollerini sorgulamak için yardımcı sınıf.
 *
 * Controller katmanında isCustomer/isAgent/isManager sonucuna göre
 * farklı iş mantığı dalları çalıştırılır (örn. müşteri filtresi, atama kısıtı).
 *
 * @PreAuthorize sadece erişim kontrolü yapar; iş mantığı kararları için bu sınıf kullanılır.
 * Utility sınıfı — instantiate edilemez.
 */
public final class JwtRealmRoles {

    private JwtRealmRoles() {
    }

    /**
     * JWT sahibinin CUSTOMER rolüne sahip olup olmadığını döner.
     * Kullanım: bilet listesinde müşteri filtrelemesi, bilet silme yetkisi.
     */
    public static boolean isCustomer(Jwt jwt) {
        return hasRole(jwt, "CUSTOMER");
    }

    /** JWT sahibinin AGENT rolüne sahip olup olmadığını döner. */
    public static boolean isAgent(Jwt jwt) {
        return hasRole(jwt, "AGENT");
    }

    /** JWT sahibinin MANAGER rolüne sahip olup olmadığını döner. */
    public static boolean isManager(Jwt jwt) {
        return hasRole(jwt, "MANAGER");
    }

    /** realm_access.roles listesinde verilen rol adını arar. */
    private static boolean hasRole(Jwt jwt, String role) {
        if (jwt == null) {
            return false;
        }
        Object realmAccess = jwt.getClaim("realm_access");
        if (realmAccess instanceof Map<?, ?> map) {
            Object rolesObj = map.get("roles");
            if (rolesObj instanceof List<?> roles && roles.contains(role)) {
                return true;
            }
        }
        Object flatRolesObj = jwt.getClaim("roles");
        if (flatRolesObj instanceof List<?> flatRoles && flatRoles.contains(role)) {
            return true;
        }
        return false;
    }
}
