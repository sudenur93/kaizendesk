package com.sau.kaizendesk.domain.entity;

import com.sau.kaizendesk.domain.enums.TicketPriority;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Bilet önceliğine göre SLA (Service Level Agreement) çözüm süresi politikası.
 *
 * Her öncelik seviyesi için tek bir kayıt bulunur (unique constraint).
 * TicketService.resolveTargetMinutes() bu tablodan önce DB'yi kontrol eder;
 * kayıt yoksa hardcoded fallback değerleri kullanılır (HIGH=240, MEDIUM=480, LOW=1440).
 *
 * V4__sla_policies_seed.sql ile varsayılan değerler yüklenir.
 * Manager panelinden güncellenebilir (ManagerSLAPage).
 */
@Entity
@Table(name = "sla_policies")
public class SlaPolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Politikanın uygulandığı öncelik seviyesi. Her öncelik için yalnızca bir kayıt olabilir. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, unique = true, length = 30)
    private TicketPriority priority;

    /**
     * Bu öncelikte çözüm için hedeflenen süre (dakika).
     * Bilet oluşturulduğunda: slaTargetAt = createdAt + targetMinutes
     */
    @Column(name = "target_minutes", nullable = false)
    private int targetMinutes;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public TicketPriority getPriority() {
        return priority;
    }

    public void setPriority(TicketPriority priority) {
        this.priority = priority;
    }

    public int getTargetMinutes() {
        return targetMinutes;
    }

    public void setTargetMinutes(int targetMinutes) {
        this.targetMinutes = targetMinutes;
    }
}
