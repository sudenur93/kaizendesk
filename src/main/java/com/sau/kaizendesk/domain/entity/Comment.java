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
 * Bir bilete eklenen yorum kaydı.
 *
 * İki tip yorum desteklenir:
 *   EXTERNAL  → müşteri ve ajan arasındaki görünür yazışma (varsayılan)
 *   INTERNAL  → sadece ajanlar ve managerlar tarafından görülen dahili not
 *
 * isInternal() kolaylık metodu, type=="INTERNAL" kontrolünü soyutlar.
 */
@Entity
@Table(name = "comments")
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Yorum metni. Maksimum 1000 karakter. */
    @Column(name = "content", nullable = false, length = 1000)
    private String message;

    /**
     * Yorumun görünürlük tipi.
     *   "EXTERNAL" → müşteri de görebilir
     *   "INTERNAL" → yalnızca ajan/manager görebilir (dahili not)
     */
    @Column(name = "type", nullable = false, length = 30)
    private String type = "EXTERNAL";

    /** Yorumun ait olduğu bilet. Bilet silinirse yorum da silinir (ON DELETE CASCADE). */
    @ManyToOne
    @JoinColumn(name = "ticket_id")
    private Ticket ticket;

    /** Yorumu yazan kullanıcı. */
    @ManyToOne
    @JoinColumn(name = "author_id")
    private User user;

    /** Yorumun yazıldığı zaman. */
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public Ticket getTicket() {
        return ticket;
    }

    public void setTicket(Ticket ticket) {
        this.ticket = ticket;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public boolean isInternal() {
        return "INTERNAL".equals(type);
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
