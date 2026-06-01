package com.sau.kaizendesk.domain.entity;

import com.sau.kaizendesk.domain.enums.TicketPriority;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * KaizenDesk sisteminin ana varlığı.
 * Her destek talebi (ticket) bu sınıf üzerinden temsil edilir.
 *
 * Yaşam döngüsü: NEW → IN_PROGRESS → (WAITING_FOR_CUSTOMER) → RESOLVED → CLOSED
 * SLA takibi: slaTargetAt alanı oluşturulma anında hesaplanır; slaBreached ihlal bayrağıdır.
 * Flowable BPMN entegrasyonu: processInstanceId ile süreç motoru bağlantısı kurulur.
 */
@Entity
@Table(name = "tickets")
public class Ticket {

    /** Veritabanı otomatik artan birincil anahtar. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** İnsan tarafından okunabilir benzersiz bilet numarası. Örnek: "KD-1748533...-A1B2C3D4" */
    @Column(name = "ticket_no", nullable = false, unique = true, length = 50)
    private String ticketNo;

    /** Bilet başlığı — kısa ve tanımlayıcı olmalıdır. */
    @Column(nullable = false)
    private String title;

    /** Sorunun ayrıntılı açıklaması. Maksimum 2000 karakter. */
    @Column(nullable = false, length = 2000)
    private String description;

    /** Bilet önceliği. Varsayılan MEDIUM; SLA hedef süresini belirler. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketPriority priority = TicketPriority.MEDIUM;

    /** Bilet durumu. Oluşturulduğunda NEW ile başlar; geçişler TicketService'de denetlenir. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketStatus status = TicketStatus.NEW;

    /** Biletin ilişkili olduğu ürün (örn. "Muhasebe Yazılımı"). */
    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    /** Ürüne bağlı kategori (örn. "Teknik Destek"). Ürün ile tutarlı olmalıdır. */
    @ManyToOne
    @JoinColumn(name = "category_id")
    private Category category;

    /**
     * Bilete atanan sorun tipleri.
     * ticket_issue_types ara tablosu üzerinden çoka-çok ilişki.
     * Bir bilette birden fazla sorun tipi olabilir (örn. "Hata" + "Performans").
     */
    @ManyToMany
    @JoinTable(
            name = "ticket_issue_types",
            joinColumns = @JoinColumn(name = "ticket_id"),
            inverseJoinColumns = @JoinColumn(name = "issue_type_id")
    )
    private Set<IssueType> issueTypes = new HashSet<>();

    /** Bileti açan kullanıcı (müşteri). Silme kısıtlıdır (ON DELETE RESTRICT). */
    @ManyToOne
    @JoinColumn(name = "created_by")
    private User createdBy;

    /** Bileti üstlenen ajan. Atama yapılmadan null olabilir. */
    @ManyToOne
    @JoinColumn(name = "assigned_to")
    private User assignedAgent;

    /** Bilete ait yorumlar (müşteri yanıtları ve dahili notlar). */
    @OneToMany(mappedBy = "ticket")
    private List<Comment> comments = new ArrayList<>();

    /** Ajanlara ait çalışma günlükleri; harcanan süre ve notlar. */
    @OneToMany(mappedBy = "ticket")
    private List<Worklog> worklogs = new ArrayList<>();

    /** Bilette yüklü dosyalar. Diskte UUID adıyla saklanır. */
    @OneToMany(mappedBy = "ticket")
    private List<Attachment> attachments = new ArrayList<>();

    /** Biletin oluşturulma zamanı. SLA hesabının başlangıç noktasıdır. */
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    /** Bilet üzerinde herhangi bir güncelleme yapıldığında set edilir. */
    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    /**
     * SLA çözüm hedef zamanı.
     * Oluşturulma anında önceliğe göre hesaplanır (LOW=1440dk, MEDIUM=480dk, HIGH=240dk).
     * Flowable timer event bu değeri kullanarak ihlal bildirimi tetikler.
     */
    @Column(name = "sla_target_at")
    private Instant slaTargetAt;

    /**
     * SLA ihlal bayrağı.
     * true → hedef zaman geçmiş; BPMN delegate veya SlaEvaluator tarafından set edilir.
     */
    @Column(name = "sla_breached", nullable = false)
    private boolean slaBreached = false;

    /** Arşiv işareti — kapatmadan bağımsız; müşteri kapatırken arşive taşımayı seçebilir. */
    @Column(name = "archived", nullable = false)
    private boolean archived = false;

    /** Memnuniyet puanı (CSAT) — müşteri 1-5 yıldız verir; null = puanlanmadı. */
    @Column(name = "satisfaction_rating")
    private Integer satisfactionRating;

    /** Memnuniyet geri bildirimi (opsiyonel). */
    @Column(name = "satisfaction_comment", columnDefinition = "TEXT")
    private String satisfactionComment;

    /**
     * SLA duraklatma — müşteriden cevap beklenirken (WAITING_FOR_CUSTOMER) geçen
     * toplam süre (dakika). Bu süre SLA hesabından düşülür (efektif hedef ötelenir).
     */
    @Column(name = "sla_paused_minutes", nullable = false)
    private long slaPausedMinutes = 0;

    /**
     * Bilet en son WAITING_FOR_CUSTOMER durumuna girdiği an.
     * Durumdan çıkınca (now - waitingSince) slaPausedMinutes'e eklenir ve null'lanır.
     */
    @Column(name = "waiting_since")
    private Instant waitingSince;

    /**
     * Flowable BPMN süreç instance kimliği.
     * startProcess() çağrısı sonrası atanır; onStatusChanged() bu ID üzerinden çalışır.
     */
    @Column(name = "process_instance_id", length = 64)
    private String processInstanceId;

    /** Çözüm notu — durum RESOLVED yapılırken zorunlu olarak girilir. */
    @Column(name = "resolution_note", columnDefinition = "TEXT")
    private String resolutionNote;

    /** Bilet RESOLVED durumuna geçtiğinde kaydedilen zaman; SLA ihlal hesabında kullanılır. */
    @Column(name = "resolved_at")
    private Instant resolvedAt;

    /** Bilet CLOSED durumuna geçtiğinde kaydedilen zaman. */
    @Column(name = "closed_at")
    private Instant closedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTicketNo() {
        return ticketNo;
    }

    public void setTicketNo(String ticketNo) {
        this.ticketNo = ticketNo;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public TicketPriority getPriority() {
        return priority;
    }

    public void setPriority(TicketPriority priority) {
        this.priority = priority;
    }

    public TicketStatus getStatus() {
        return status;
    }

    public void setStatus(TicketStatus status) {
        this.status = status;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public Category getCategory() {
        return category;
    }

    public void setCategory(Category category) {
        this.category = category;
    }

    public Set<IssueType> getIssueTypes() {
        return issueTypes;
    }

    public void setIssueTypes(Set<IssueType> issueTypes) {
        this.issueTypes = issueTypes;
    }

    public User getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(User createdBy) {
        this.createdBy = createdBy;
    }

    public User getAssignedAgent() {
        return assignedAgent;
    }

    public void setAssignedAgent(User assignedAgent) {
        this.assignedAgent = assignedAgent;
    }

    public List<Comment> getComments() {
        return comments;
    }

    public void setComments(List<Comment> comments) {
        this.comments = comments;
    }

    public List<Worklog> getWorklogs() {
        return worklogs;
    }

    public void setWorklogs(List<Worklog> worklogs) {
        this.worklogs = worklogs;
    }

    public List<Attachment> getAttachments() {
        return attachments;
    }

    public void setAttachments(List<Attachment> attachments) {
        this.attachments = attachments;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Instant getSlaTargetAt() {
        return slaTargetAt;
    }

    public void setSlaTargetAt(Instant slaTargetAt) {
        this.slaTargetAt = slaTargetAt;
    }

    public boolean isSlaBreached() {
        return slaBreached;
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public Integer getSatisfactionRating() {
        return satisfactionRating;
    }

    public void setSatisfactionRating(Integer satisfactionRating) {
        this.satisfactionRating = satisfactionRating;
    }

    public String getSatisfactionComment() {
        return satisfactionComment;
    }

    public void setSatisfactionComment(String satisfactionComment) {
        this.satisfactionComment = satisfactionComment;
    }

    public long getSlaPausedMinutes() {
        return slaPausedMinutes;
    }

    public void setSlaPausedMinutes(long slaPausedMinutes) {
        this.slaPausedMinutes = slaPausedMinutes;
    }

    public Instant getWaitingSince() {
        return waitingSince;
    }

    public void setWaitingSince(Instant waitingSince) {
        this.waitingSince = waitingSince;
    }

    public String getProcessInstanceId() {
        return processInstanceId;
    }

    public void setProcessInstanceId(String processInstanceId) {
        this.processInstanceId = processInstanceId;
    }

    public void setSlaBreached(boolean slaBreached) {
        this.slaBreached = slaBreached;
    }

    public String getResolutionNote() {
        return resolutionNote;
    }

    public void setResolutionNote(String resolutionNote) {
        this.resolutionNote = resolutionNote;
    }

    public Instant getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(Instant resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public void setClosedAt(Instant closedAt) {
        this.closedAt = closedAt;
    }
}
