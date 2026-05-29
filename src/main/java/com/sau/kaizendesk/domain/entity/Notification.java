package com.sau.kaizendesk.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

/**
 * Kullanıcıya iletilen sistem bildirimi.
 *
 * TicketNotificationService tarafından üretilir; aynı zamanda e-posta da gönderilir.
 * Bildirim tipleri (type alanı):
 *   TICKET_CREATED      → bilet oluşturuldu
 *   STATUS_CHANGED      → bilet durumu değişti
 *   TICKET_ASSIGNED     → bilet bir ajana atandı
 *   SLA_AT_RISK         → SLA süresinin %25'i ya da 30 dk'sı kaldı
 *   SLA_BREACHED        → SLA süresi aşıldı
 *   CUSTOMER_COMMENT    → müşteri yoruma yanıt verdi
 */
@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Bildirimi alacak kullanıcı. Kullanıcı silinirse kayıt da silinir (ON DELETE CASCADE). */
    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    /**
     * Bildirimin ilgili olduğu bilet.
     * Bilet silinirse bu alan null yapılır (ON DELETE SET NULL); bildirim kaydı korunur.
     */
    @ManyToOne
    @JoinColumn(name = "ticket_id")
    private Ticket ticket;

    /** Bildirim kategorisi. Arayüzde ikon ve renk seçimi için kullanılır. */
    @Column(nullable = false, length = 50)
    private String type;

    /** Kısa başlık — bildirim listesinde gösterilir (örn. "Talep oluşturuldu"). */
    @Column(nullable = false)
    private String title;

    /** Ayrıntılı mesaj içeriği. E-posta gövdesinde de kullanılır. */
    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    /** Bildirimin oluşturulma zamanı. */
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    /**
     * Okundu bayrağı.
     * Veritabanı sütunu "is_read" — Flyway V1__init.sql ile oluşturulmuştur.
     * Kullanıcı bildirimi açtığında NotificationController.markRead() ile true yapılır.
     */
    @Column(name = "is_read", nullable = false)
    private boolean read;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public Ticket getTicket() {
        return ticket;
    }

    public void setTicket(Ticket ticket) {
        this.ticket = ticket;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public boolean isRead() {
        return read;
    }

    public void setRead(boolean read) {
        this.read = read;
    }
}
