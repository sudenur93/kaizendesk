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
 * Bir bilete yüklenen dosya kaydı.
 *
 * Dosyalar veritabanında değil, diskte saklanır.
 * Depolama yolu: kaizendesk.attachments.directory / ticketId / UUID.ext
 * Güvenlik: orijinal dosya adı DB'de korunur, diskte UUID kullanılır (çakışma ve path traversal önlemi).
 * Metin dosyaları (.txt, .log vb.) otomatik taranır; ERROR/EXCEPTION gibi anahtar kelimeler
 * detectedLogKeywords alanına virgülle ayrılmış olarak kaydedilir.
 */
@Entity
@Table(name = "attachments")
public class Attachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Dosyanın ait olduğu bilet. Bilet silinirse dosya kaydı da silinir (ON DELETE CASCADE). */
    @ManyToOne
    @JoinColumn(name = "ticket_id")
    private Ticket ticket;

    /** Kullanıcının yüklediği orijinal dosya adı (örn. "hata-ekran-görüntüsü.png"). */
    @Column(name = "original_file_name", nullable = false)
    private String originalFileName;

    /**
     * Diskteki gerçek dosya adı.
     * UUID + uzantı formatındadır (örn. "a1b2c3d4-...-e5f6.png").
     * Bu isimlendirme çakışmaları ve güvenlik açıklarını önler.
     */
    @Column(name = "stored_file_name", nullable = false)
    private String storedFileName;

    /** MIME tipi (örn. "image/png", "application/pdf"). İndirme başlığında kullanılır. */
    @Column(name = "content_type")
    private String contentType;

    /** Dosya boyutu (byte). AttachmentMimeRules ile maksimum boyut denetlenir. */
    @Column(name = "file_size_bytes", nullable = false)
    private long fileSizeBytes;

    /** Dosya türü sınıflandırması (isteğe bağlı, örn. "LOG", "IMAGE"). */
    @Column(name = "kind", length = 50)
    private String kind;

    /** Dosyayı yükleyen kullanıcı. */
    @ManyToOne
    @JoinColumn(name = "uploaded_by")
    private User uploadedBy;

    /**
     * Metin dosyalarında tespit edilen log anahtar kelimeleri.
     * Virgülle ayrılmış liste (örn. "ERROR,EXCEPTION,FATAL").
     * AttachmentService yükleme sırasında dosya içeriğini tarayarak doldurur.
     */
    @Column(name = "detected_log_keywords", length = 500)
    private String detectedLogKeywords;

    /** Dosyanın yüklenme zamanı. */
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

    public String getOriginalFileName() {
        return originalFileName;
    }

    public void setOriginalFileName(String originalFileName) {
        this.originalFileName = originalFileName;
    }

    public String getStoredFileName() {
        return storedFileName;
    }

    public void setStoredFileName(String storedFileName) {
        this.storedFileName = storedFileName;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public long getFileSizeBytes() {
        return fileSizeBytes;
    }

    public void setFileSizeBytes(long fileSizeBytes) {
        this.fileSizeBytes = fileSizeBytes;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public User getUploadedBy() {
        return uploadedBy;
    }

    public void setUploadedBy(User uploadedBy) {
        this.uploadedBy = uploadedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getDetectedLogKeywords() {
        return detectedLogKeywords;
    }

    public void setDetectedLogKeywords(String detectedLogKeywords) {
        this.detectedLogKeywords = detectedLogKeywords;
    }
}
