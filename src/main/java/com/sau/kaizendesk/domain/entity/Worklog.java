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
import java.time.LocalDate;

/**
 * Bir bilet üzerinde harcanan çalışma süresini kaydeden iş günlüğü.
 *
 * Ajanlar ve managerlar tarafından oluşturulur.
 * Dashboard'da toplam çalışma süresi hesabında kullanılır.
 * Tek bir bilet için birden fazla worklog girişi yapılabilir.
 */
@Entity
@Table(name = "worklogs")
public class Worklog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Worklog'un ait olduğu bilet. Bilet silinirse kayıt da silinir (ON DELETE CASCADE). */
    @ManyToOne
    @JoinColumn(name = "ticket_id")
    private Ticket ticket;

    /** Worklog'u ekleyen kullanıcı (ajan veya manager). */
    @ManyToOne
    @JoinColumn(name = "author_id")
    private User user;

    /** Çalışmanın gerçekleştiği tarih. Geçmiş tarih girilebilir. */
    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    /** Harcanan süre (dakika cinsinden). Sıfırdan büyük olmalıdır. */
    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    /** Yapılan çalışmanın açıklaması (isteğe bağlı). */
    @Column(columnDefinition = "TEXT")
    private String note;

    /** Worklog kaydının sisteme giriliş zamanı. */
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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

    public LocalDate getWorkDate() {
        return workDate;
    }

    public void setWorkDate(LocalDate workDate) {
        this.workDate = workDate;
    }

    public int getDurationMinutes() {
        return durationMinutes;
    }

    public void setDurationMinutes(int durationMinutes) {
        this.durationMinutes = durationMinutes;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
