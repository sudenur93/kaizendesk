package com.sau.kaizendesk.domain.entity;

import com.sau.kaizendesk.domain.enums.UserRole;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Sistemdeki kullanıcı kaydı.
 *
 * Kimlik doğrulama Keycloak'a devredilmiştir — bu tabloda şifre tutulmaz.
 * username alanı, Keycloak JWT'sindeki preferred_username claim'i ile eşleşir.
 * Kullanıcı ilk girişte UserService.syncFromJwt() metodu aracılığıyla bu tabloya yazılır.
 *
 * Rol hiyerarşisi:
 *   CUSTOMER → sadece kendi biletlerini görür/yönetir
 *   AGENT    → kendisine atanan biletleri işler; üstlenemeyeceği biletlere erişemez
 *   MANAGER  → tüm biletlere, ekip yönetimine ve dashboard'a erişim sağlar
 */
@Entity
@Table(name = "users")
public class User {

    /** Veritabanı birincil anahtarı. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Keycloak preferred_username — her kullanıcı için benzersiz. */
    @Column(nullable = false, unique = true)
    private String username;

    /** Kullanıcının tam adı (firstName + lastName). Bildirim ve arayüzde gösterilir. */
    @Column(name = "full_name", nullable = false)
    private String name;

    /** Kullanıcının e-posta adresi. Bildirim e-postaları bu adrese gönderilir. */
    @Column(nullable = false, unique = true)
    private String email;

    /** Kullanıcının sistem rolü. Yetkilendirme bu alana göre yapılır. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role = UserRole.CUSTOMER;

    /**
     * Ajanın ait olduğu ekip adı (örn. "Yazılım", "Donanım").
     * Müşteri kayıtlarında null olabilir; manager tarafından atanır.
     */
    @Column(name = "team")
    private String team;

    /** Soft delete zaman damgası; null ise hesap aktiftir. */
    @Column(name = "deleted_at")
    private Instant deletedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public UserRole getRole() {
        return role;
    }

    public void setRole(UserRole role) {
        this.role = role;
    }

    public String getTeam() {
        return team;
    }

    public void setTeam(String team) {
        this.team = team;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }
}
