package com.sau.kaizendesk.domain.entity;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Sistem genelinde gerçekleşen önemli olayların denetim kaydı (audit log).
 *
 * ActivityLogService.log() metodu aracılığıyla doldurulur.
 * Kaydedilen olay tipleri:
 *   TICKET_CREATED   → yeni bilet açıldı
 *   STATUS_CHANGED   → bilet durumu güncellendi
 *   AGENT_ASSIGNED   → bilete ajan atandı
 *   PRIORITY_CHANGED → bilet önceliği değiştirildi
 *
 * ticketNo ve ticketTitle, bilet silinse bile geçmiş kayıtların okunabilir kalması için
 * bilet referansından bağımsız olarak ayrıca saklanır.
 */
@Entity
@Table(name = "activity_logs")
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Gerçekleşen olayın tipi (TICKET_CREATED, STATUS_CHANGED vb.). */
    @Column(name = "event_type", nullable = false, length = 50)
    private String eventType;

    /** İşlemi gerçekleştiren kullanıcının username'i. */
    @Column(name = "actor", length = 100)
    private String actor;

    /** İlgili bilet referansı. Bilet silinirse null olabilir (LAZY yükleme). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ticket_id")
    private Ticket ticket;

    /** Bilet numarasının anlık kopyası — bilet silinse bile log okunabilir kalır. */
    @Column(name = "ticket_no", length = 20)
    private String ticketNo;

    /** Bilet başlığının anlık kopyası — bilet silinse bile log okunabilir kalır. */
    @Column(name = "ticket_title")
    private String ticketTitle;

    /** Olayla ilgili ek bilgi (örn. "IN_PROGRESS → RESOLVED" veya atanan ajan adı). */
    @Column(name = "detail", columnDefinition = "TEXT")
    private String detail;

    /** Olayın gerçekleştiği zaman damgası. */
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() { return id; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getActor() { return actor; }
    public void setActor(String actor) { this.actor = actor; }
    public Ticket getTicket() { return ticket; }
    public void setTicket(Ticket ticket) { this.ticket = ticket; }
    public String getTicketNo() { return ticketNo; }
    public void setTicketNo(String ticketNo) { this.ticketNo = ticketNo; }
    public String getTicketTitle() { return ticketTitle; }
    public void setTicketTitle(String ticketTitle) { this.ticketTitle = ticketTitle; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
