package com.sau.kaizendesk.config;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Spring Security yapılandırması.
 *
 * Uygulama saf bir OAuth2 Resource Server olarak çalışır:
 *   - Oturum (session) yoktur; her istek JWT ile kimlik doğrulanır.
 *   - CSRF devre dışı: JWT Bearer token kullanıldığı için gerekmez.
 *   - Keycloak JWT'si realm_access.roles üzerinden roller taşır; bu sınıf onları ROLE_XXX formatına çevirir.
 *
 * Herkese açık endpoint'ler:
 *   /actuator/health, /actuator/info   → sağlık kontrolü (Docker healthcheck)
 *   /swagger-ui/**, /v3/api-docs/**    → API dökümantasyonu
 *   /api/v1/public/**                  → giriş gerektirmeyen istatistikler
 *
 * @EnableMethodSecurity → @PreAuthorize anotasyonlarının controller'larda çalışmasını sağlar.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    /**
     * Ana güvenlik filtre zinciri.
     * JWT doğrulama, CORS ve yetkilendirme kuralları burada tanımlanır.
     */
    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/actuator/health",
                                "/actuator/info",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/api/v1/public/**"
                        ).permitAll()
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(keycloakJwtAuthenticationConverter()))
                );

        return http.build();
    }

    /**
     * CORS yapılandırması.
     * Geliştirme ortamında Vite (5173, 5174) ve Docker frontend (3000) kaynaklarına izin verir.
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174",
                "http://localhost:3000"
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    /**
     * Keycloak JWT'sindeki realm rollerini Spring Security yetkilerine dönüştürür.
     *
     * Keycloak JWT yapısı:
     *   { "realm_access": { "roles": ["CUSTOMER", "AGENT", "offline_access", ...] } }
     *
     * Bu converter "CUSTOMER" → "ROLE_CUSTOMER" şeklinde dönüştürerek
     * @PreAuthorize("hasRole('CUSTOMER')") anotasyonlarının çalışmasını sağlar.
     * Standart scope/authority değerleri de korunur (defaultConverter).
     */
    @Bean
    public JwtAuthenticationConverter keycloakJwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();

        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            JwtGrantedAuthoritiesConverter defaultConverter = new JwtGrantedAuthoritiesConverter();

            // Varsayılan scope/authority yetkileri (SCOPE_openid vb.)
            Collection<GrantedAuthority> authorities = defaultConverter.convert(jwt);

            // Keycloak realm rollerini JWT'den oku ve ROLE_ önekiyle ekle
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            if (realmAccess != null) {
                Object rolesObj = realmAccess.get("roles");
                if (rolesObj instanceof Collection<?> roles) {
                    List<GrantedAuthority> roleAuthorities = roles.stream()
                            .filter(String.class::isInstance)
                            .map(String.class::cast)
                            .map(roleName -> new SimpleGrantedAuthority("ROLE_" + roleName.toUpperCase()))
                            .collect(Collectors.toList());
                    authorities.addAll(roleAuthorities);
                }
            }

            return authorities;
        });

        return converter;
    }
}

