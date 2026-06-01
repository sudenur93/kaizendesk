package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Category;
import com.sau.kaizendesk.domain.entity.IssueType;
import com.sau.kaizendesk.domain.entity.Product;
import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.domain.enums.TicketPriority;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import com.sau.kaizendesk.domain.enums.UserRole;
import com.sau.kaizendesk.dto.CreateTicketRequest;
import com.sau.kaizendesk.dto.TicketResponse;
import com.sau.kaizendesk.repository.CategoryRepository;
import com.sau.kaizendesk.repository.IssueTypeRepository;
import com.sau.kaizendesk.repository.ProductRepository;
import com.sau.kaizendesk.repository.SlaPolicyRepository;
import com.sau.kaizendesk.repository.TicketRepository;
import com.sau.kaizendesk.repository.UserRepository;
import com.sau.kaizendesk.workflow.TicketWorkflowService;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bilet yönetiminin tüm iş kurallarını barındıran merkezi servis.
 *
 * Temel sorumluluklar:
 *  - Bilet oluşturma: ürün/kategori/sorun tipi tutarlılık kontrolü, SLA hesabı, BPMN süreci başlatma
 *  - Durum geçişi: izin verilen state machine geçişleri (isAllowedTransition)
 *  - Ajan atama: ajan sadece kendi üzerine alabilir; manager herkese atayabilir
 *  - Müşteri aksiyonu: RESOLVED → CLOSED (onay) veya RESOLVED → IN_PROGRESS (yeniden aç)
 *  - Filtreleme: status, priority, assignedTo, username, fulltext arama (q)
 *
 * @Transactional(readOnly = true) varsayılan; yazma işlemlerine @Transactional eklenir.
 */
@Service
@Transactional(readOnly = true)
public class TicketService {

    /** Liste sıralaması: yüksek öncelik önce, aynı öncelikte en yeni önce. */
    private static final Comparator<Ticket> TICKET_LIST_ORDER =
            Comparator.comparing(Ticket::getPriority)
                    .reversed()
                    .thenComparing(Ticket::getCreatedAt, Comparator.reverseOrder());

    /** Çözülmüş ama müşteri tarafından kapatılmayan talepler kaç gün sonra otomatik kapatılır. */
    @Value("${kaizendesk.auto-close.resolved-after-days:7}")
    private int autoCloseDays;

    /** Kapatılan bir talep kaç gün içinde yeniden açılabilir (sonrasında yeni talep gerekir). */
    @Value("${kaizendesk.reopen-window-days:30}")
    private int reopenDays;

    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final IssueTypeRepository issueTypeRepository;
    private final SlaPolicyRepository slaPolicyRepository;
    private final TicketNotificationService ticketNotificationService;
    private final TicketWorkflowService ticketWorkflowService;
    private final ActivityLogService activityLogService;

    public TicketService(
            TicketRepository ticketRepository,
            UserRepository userRepository,
            ProductRepository productRepository,
            CategoryRepository categoryRepository,
            IssueTypeRepository issueTypeRepository,
            SlaPolicyRepository slaPolicyRepository,
            TicketNotificationService ticketNotificationService,
            TicketWorkflowService ticketWorkflowService,
            ActivityLogService activityLogService
    ) {
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.issueTypeRepository = issueTypeRepository;
        this.slaPolicyRepository = slaPolicyRepository;
        this.ticketNotificationService = ticketNotificationService;
        this.ticketWorkflowService = ticketWorkflowService;
        this.activityLogService = activityLogService;
    }

    /**
     * Yeni bir destek talebi oluşturur.
     *
     * Adımlar:
     *  1. Kullanıcı varlığını doğrular
     *  2. Ürün ve kategorinin tutarlı olduğunu kontrol eder
     *  3. Seçilen sorun tiplerinin kategoriye ait ve aktif olduğunu doğrular
     *  4. Bileti kaydeder, SLA hedefini hesaplar
     *  5. Flowable BPMN sürecini başlatır (processInstanceId atanır)
     *  6. Oluşturulma bildirimi ve SLA risk bildirimi tetiklenir
     *  7. Aktivite logu yazılır
     */
    @Transactional
    public TicketResponse createTicket(CreateTicketRequest request, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + request.getProductId()));
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found: " + request.getCategoryId()));
        // Seçilen kategorinin, seçilen ürüne ait olduğunu doğrula
        if (category.getProduct() == null || !category.getProduct().getId().equals(product.getId())) {
            throw new IllegalArgumentException("Category does not belong to selected product");
        }

        List<Long> distinctIssueIds = request.getIssueTypeIds().stream().distinct().toList();
        List<IssueType> issueTypes = issueTypeRepository.findAllByIdIn(distinctIssueIds);
        if (issueTypes.size() != distinctIssueIds.size()) {
            throw new IllegalArgumentException("One or more issue types were not found");
        }
        for (IssueType issueType : issueTypes) {
            if (!issueType.getCategory().getId().equals(category.getId())) {
                throw new IllegalArgumentException("Issue type does not belong to selected category: " + issueType.getId());
            }
            if (!issueType.isActive()) {
                throw new IllegalArgumentException("Issue type is not active: " + issueType.getId());
            }
        }

        Instant now = Instant.now();

        Ticket ticket = new Ticket();
        ticket.setTicketNo(generateTicketNo(now));
        ticket.setTitle(request.getTitle());
        ticket.setDescription(request.getDescription());
        ticket.setPriority(request.getPriority());
        ticket.setStatus(TicketStatus.NEW);
        ticket.setProduct(product);
        ticket.setCategory(category);
        ticket.setIssueTypes(new HashSet<>(issueTypes));
        ticket.setCreatedBy(user);
        ticket.setCreatedAt(now);
        ticket.setUpdatedAt(now);
        ticket.setSlaTargetAt(calculateSlaTargetAt(request.getPriority(), now));

        Ticket savedTicket = ticketRepository.save(ticket);
        // Temiz, sıralı ticket numarası — DB id'sine göre (örn. KD-035)
        savedTicket.setTicketNo(String.format(Locale.ROOT, "KD-%03d", savedTicket.getId()));
        // Flowable BPMN: ticket için process instance başlat
        String pid = ticketWorkflowService.startProcess(savedTicket);
        if (pid != null) {
            savedTicket.setProcessInstanceId(pid);
        }
        savedTicket = ticketRepository.save(savedTicket);
        ticketNotificationService.onTicketCreated(savedTicket);
        ticketNotificationService.maybeNotifySlaAtRisk(savedTicket, now);
        activityLogService.log("TICKET_CREATED", username, savedTicket, null);
        return mapToResponse(savedTicket);
    }

    private String generateTicketNo(Instant now) {
        // human-friendly unique-ish ticket id
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        return "KD-" + now.toEpochMilli() + "-" + suffix;
    }

    public List<TicketResponse> listTickets() {
        return ticketRepository.findAll().stream()
                .sorted(TICKET_LIST_ORDER)
                .map(this::mapToResponse)
                .toList();
    }

    public List<TicketResponse> getTickets(String status, String priority, Long assignedTo) {
        // Eski imza: testler ve geriye dönük uyumluluk için korunuyor.
        return getTickets(status, priority, assignedTo, null, false, null);
    }

    public List<TicketResponse> getTickets(
            String status,
            String priority,
            Long assignedTo,
            String username,
            boolean isCustomer,
            String q
    ) {
        return ticketRepository.findAll()
                .stream()
                .filter(ticket -> matchesStatus(ticket, status))
                .filter(ticket -> matchesPriority(ticket, priority))
                .filter(ticket -> matchesAssignedAgent(ticket, assignedTo))
                .filter(ticket -> !isCustomer || isCreatedBy(ticket, username))
                .filter(ticket -> matchesSearch(ticket, q))
                .sorted(TICKET_LIST_ORDER)
                .map(this::mapToResponse)
                .toList();
    }

    public TicketResponse getTicket(Long id) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + id));
        return mapToResponse(ticket);
    }

	public TicketResponse getTicketByIdForUser(Long id, String username, boolean isCustomer) {
		Ticket ticket = ticketRepository.findById(id)
				.orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + id));

		if (isCustomer && !isCreatedBy(ticket, username)) {
			throw new AccessDeniedException("Bu ticket'a erişim yetkiniz yok");
		}

		return mapToResponse(ticket);
    }

    @Transactional
    public TicketResponse updateStatus(Long id, TicketStatus newStatus, String resolutionNote) {
        return updateStatus(id, newStatus, resolutionNote, null);
    }

    @Transactional
    public TicketResponse updateStatus(Long id, TicketStatus newStatus, String resolutionNote, String actor) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + id));

        TicketStatus from = ticket.getStatus();
        if (from == newStatus) {
            return mapToResponse(ticket);
        }
        if (!isAllowedTransition(from, newStatus)) {
            throw new IllegalArgumentException("Geçersiz statü geçişi: " + from + " -> " + newStatus);
        }

        Instant now = Instant.now();

        // SLA duraklatma: WAITING_FOR_CUSTOMER'a girerken saati durdur, çıkarken beklenen süreyi biriktir
        if (newStatus == TicketStatus.WAITING_FOR_CUSTOMER) {
            ticket.setWaitingSince(now);
        } else if (from == TicketStatus.WAITING_FOR_CUSTOMER && ticket.getWaitingSince() != null) {
            long waited = Math.max(0, ChronoUnit.MINUTES.between(ticket.getWaitingSince(), now));
            ticket.setSlaPausedMinutes(ticket.getSlaPausedMinutes() + waited);
            ticket.setWaitingSince(null);
        }

        if (newStatus == TicketStatus.RESOLVED) {
            if (resolutionNote == null || resolutionNote.isBlank()) {
                throw new IllegalArgumentException("Çözüm notu zorunlu (resolutionNote)");
            }
            ticket.setResolutionNote(resolutionNote.trim());
            ticket.setResolvedAt(now);
        }
        if (newStatus == TicketStatus.CLOSED) {
            ticket.setClosedAt(now);
            ticket.setArchived(true); // agent/manager kapatınca otomatik arşivle
        }

        boolean wasBreached = ticket.isSlaBreached();
        ticket.setStatus(newStatus);
        ticket.setUpdatedAt(now);
        syncSlaBreachedFlag(ticket, now);
        Ticket saved = ticketRepository.save(ticket);
        ticketWorkflowService.onStatusChanged(saved.getProcessInstanceId(), newStatus);
        ticketNotificationService.onStatusChanged(saved, from, newStatus);
        ticketNotificationService.maybeNotifySlaBreached(saved, wasBreached, now);
        ticketNotificationService.maybeNotifySlaAtRisk(saved, now);
        activityLogService.log("STATUS_CHANGED", actor, saved, from.name() + " → " + newStatus.name());
        return mapToResponse(saved);
    }

    /**
     * İzin verilen durum geçişlerini tanımlayan state machine kuralları.
     * Yasak bir geçiş denenirse updateStatus() IllegalArgumentException fırlatır.
     *
     *   NEW                → IN_PROGRESS                      (ajan bileti alır)
     *   IN_PROGRESS        → WAITING_FOR_CUSTOMER | RESOLVED  (müşteri yanıtı bekleniyor veya çözüldü)
     *   WAITING_FOR_CUSTOMER → IN_PROGRESS | RESOLVED         (müşteri yanıtladı veya yine de çözüldü)
     *   RESOLVED           → CLOSED                           (müşteri onayla ya da ajan kapat)
     *   CLOSED             → (hiçbir geçiş yok)               (terminal durum)
     */
    private static boolean isAllowedTransition(TicketStatus from, TicketStatus to) {
        return switch (from) {
            case NEW -> to == TicketStatus.IN_PROGRESS;
            case IN_PROGRESS -> to == TicketStatus.WAITING_FOR_CUSTOMER || to == TicketStatus.RESOLVED;
            case WAITING_FOR_CUSTOMER -> to == TicketStatus.IN_PROGRESS || to == TicketStatus.RESOLVED;
            case RESOLVED -> to == TicketStatus.CLOSED;
            case CLOSED -> false;
        };
    }

    @Transactional
    public TicketResponse assignAgent(Long id, Long agentId) {
        return assignAgent(id, agentId, null, false, true);
    }

    @Transactional
    public TicketResponse assignAgent(
            Long id,
            Long agentId,
            String actorUsername,
            boolean actorIsAgent,
            boolean actorIsManager
    ) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + id));

        User agent = userRepository.findById(agentId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + agentId));
        if (agent.getRole() != UserRole.AGENT && agent.getRole() != UserRole.MANAGER) {
            throw new IllegalArgumentException("Assigned user must be an agent or manager");
        }

        if (actorIsAgent && !actorIsManager) {
            User actor = userRepository.findByUsername(actorUsername)
                    .orElseThrow(() -> new IllegalArgumentException("User not found: " + actorUsername));
            if (!agentId.equals(actor.getId())) {
                throw new AccessDeniedException("Agent sadece ticket'ı kendi üzerine alabilir");
            }
            if (ticket.getAssignedAgent() != null) {
                throw new AccessDeniedException("Agent sadece atanmamış ticket'ı üzerine alabilir");
            }
        }

        TicketStatus statusBefore = ticket.getStatus();
        ticket.setAssignedAgent(agent);
        if (ticket.getStatus() == TicketStatus.NEW) {
            ticket.setStatus(TicketStatus.IN_PROGRESS);
        }
        TicketStatus statusAfter = ticket.getStatus();
        Instant now = Instant.now();
        ticket.setUpdatedAt(now);
        boolean wasBreached = ticket.isSlaBreached();
        syncSlaBreachedFlag(ticket, now);
        Ticket updatedTicket = ticketRepository.save(ticket);
        if (statusBefore != statusAfter) {
            ticketNotificationService.onStatusChanged(updatedTicket, statusBefore, statusAfter);
        }
        ticketNotificationService.onAgentAssigned(updatedTicket);
        ticketNotificationService.maybeNotifySlaBreached(updatedTicket, wasBreached, now);
        ticketNotificationService.maybeNotifySlaAtRisk(updatedTicket, now);
        activityLogService.log("AGENT_ASSIGNED", actorUsername, updatedTicket, agent.getUsername());
        return mapToResponse(updatedTicket);
    }

    @Transactional
    public void deleteTicket(Long ticketId, String username) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket bulunamadı: " + ticketId));
        if (ticket.getCreatedBy() == null || !ticket.getCreatedBy().getUsername().equals(username)) {
            throw new SecurityException("Bu talebi silme yetkiniz yok.");
        }
        if (ticket.getStatus() != TicketStatus.NEW) {
            throw new IllegalStateException("Sadece 'Yeni' durumundaki talepler silinebilir.");
        }
        ticketRepository.deleteById(ticketId);
    }

    /**
     * Müşterinin "Çözümü Onayla" (confirm) veya "Yeniden Aç" (reopen) aksiyonları.
     * confirm : RESOLVED → CLOSED  (müşteri sorununun çözüldüğünü onaylar)
     * reopen  : RESOLVED → IN_PROGRESS  (müşteri sorunun hâlâ devam ettiğini bildirir)
     */
    @Transactional
    public TicketResponse customerAction(Long ticketId, String action, boolean archive, String username) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket bulunamadı: " + ticketId));
        if (ticket.getCreatedBy() == null || !ticket.getCreatedBy().getUsername().equals(username)) {
            throw new SecurityException("Bu talep üzerinde işlem yapma yetkiniz yok.");
        }
        Instant now = Instant.now();
        TicketStatus from = ticket.getStatus();
        if ("confirm".equals(action)) {
            // Onaylama yalnızca çözülmüş talepte
            if (from != TicketStatus.RESOLVED) {
                throw new IllegalStateException("Onaylama yalnızca 'Çözüldü' durumundaki talepler için geçerlidir.");
            }
            ticket.setStatus(TicketStatus.CLOSED);
            ticket.setClosedAt(now);
            ticket.setArchived(archive); // müşteri arşive taşımayı seçtiyse
            activityLogService.log("STATUS_CHANGED", username, ticket,
                    "RESOLVED → CLOSED (müşteri onayı" + (archive ? ", arşivlendi" : "") + ")");
        } else if ("reopen".equals(action)) {
            // Yeniden açma: RESOLVED'dan her zaman; CLOSED'dan ise reopenDays içinde
            if (from != TicketStatus.RESOLVED && from != TicketStatus.CLOSED) {
                throw new IllegalStateException("Bu talep yeniden açılamaz.");
            }
            if (from == TicketStatus.CLOSED) {
                Instant limit = ticket.getClosedAt() != null
                        ? ticket.getClosedAt().plus(reopenDays, ChronoUnit.DAYS) : null;
                if (limit == null || now.isAfter(limit)) {
                    throw new IllegalStateException(
                            "Bu talep " + reopenDays + " günlük yeniden açma süresini doldurdu. Lütfen yeni bir talep oluşturun.");
                }
                ticket.setArchived(false); // arşivden çıkar
                ticket.setClosedAt(null);  // kapanış iptal
            }
            ticket.setStatus(TicketStatus.IN_PROGRESS);
            activityLogService.log("STATUS_CHANGED", username, ticket,
                    from.name() + " → IN_PROGRESS (müşteri yeniden açtı)");
        } else {
            throw new IllegalArgumentException("Geçersiz aksiyon: " + action);
        }
        ticket.setUpdatedAt(now);
        Ticket saved = ticketRepository.save(ticket);
        ticketNotificationService.onStatusChanged(saved, from, saved.getStatus());
        return mapToResponse(saved);
    }

    /**
     * Müşteri memnuniyet puanı (CSAT). Yalnızca çözülmüş/kapatılmış kendi talebine, 1-5 arası.
     */
    @Transactional
    public TicketResponse rateTicket(Long ticketId, int rating, String comment, String username) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket bulunamadı: " + ticketId));
        if (ticket.getCreatedBy() == null || !ticket.getCreatedBy().getUsername().equals(username)) {
            throw new SecurityException("Bu talebi puanlama yetkiniz yok.");
        }
        if (ticket.getStatus() != TicketStatus.RESOLVED && ticket.getStatus() != TicketStatus.CLOSED) {
            throw new IllegalStateException("Yalnızca çözülmüş veya kapatılmış talepler puanlanabilir.");
        }
        if (rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Puan 1 ile 5 arasında olmalıdır.");
        }
        ticket.setSatisfactionRating(rating);
        ticket.setSatisfactionComment(comment != null && !comment.isBlank() ? comment.trim() : null);
        ticket.setUpdatedAt(Instant.now());
        Ticket saved = ticketRepository.save(ticket);
        activityLogService.log("RATED", username, saved, rating + "/5");
        return mapToResponse(saved);
    }

    @Transactional
    public TicketResponse updatePriority(Long ticketId, TicketPriority newPriority, String actor) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new IllegalArgumentException("Ticket bulunamadı: " + ticketId));
        // slaTargetAt değiştirilmez — müşterinin belirlediği orijinal süre korunur
        ticket.setPriority(newPriority);
        ticket.setUpdatedAt(Instant.now());
        Ticket saved = ticketRepository.save(ticket);
        activityLogService.log("PRIORITY_CHANGED", actor, saved, newPriority.name());
        return mapToResponse(saved);
    }

    /**
     * Çözülmüş (RESOLVED) ama müşteri tarafından onaylanmadığı için kapatılmamış talepleri
     * belirli gün (varsayılan 7) sonra otomatik kapatır + arşivler.
     * Her saat başı çalışır. Süre kaizendesk.auto-close.resolved-after-days ile ayarlanır.
     */
    @Transactional
    @Scheduled(cron = "${kaizendesk.auto-close.cron:0 0 * * * *}")
    public void autoCloseStaleResolvedTickets() {
        Instant cutoff = Instant.now().minus(autoCloseDays, ChronoUnit.DAYS);
        List<Ticket> stale = ticketRepository.findByStatusAndResolvedAtBefore(TicketStatus.RESOLVED, cutoff);
        for (Ticket t : stale) {
            updateStatus(t.getId(), TicketStatus.CLOSED, null, "system-auto-close");
        }
    }

    private void syncSlaBreachedFlag(Ticket ticket, Instant now) {
        ticket.setSlaBreached(SlaEvaluator.isBreached(ticket, now));
    }

    private boolean matchesStatus(Ticket ticket, String status) {
        if (status == null || status.isBlank()) {
            return true;
        }
        try {
            String n = normalizeEnum(status);
            if ("OPEN".equals(n)) {
                return ticket.getStatus() == TicketStatus.NEW;
            }
            return ticket.getStatus() == TicketStatus.valueOf(n);
        } catch (IllegalArgumentException ex) {
            return true;
        }
    }

    private boolean matchesPriority(Ticket ticket, String priority) {
        if (priority == null || priority.isBlank()) {
            return true;
        }
        try {
            return ticket.getPriority() == TicketPriority.valueOf(normalizeEnum(priority));
        } catch (IllegalArgumentException ex) {
            return true;
        }
    }

    private boolean matchesAssignedAgent(Ticket ticket, Long assignedTo) {
        if (assignedTo == null) {
            return true;
        }
        return ticket.getAssignedAgent() != null && assignedTo.equals(ticket.getAssignedAgent().getId());
    }

    private boolean isCreatedBy(Ticket ticket, String username) {
        return ticket.getCreatedBy() != null
                && ticket.getCreatedBy().getUsername() != null
                && ticket.getCreatedBy().getUsername().equals(username);
    }

    private boolean matchesSearch(Ticket ticket, String q) {
        if (q == null || q.isBlank()) {
            return true;
        }
        String needle = q.trim().toLowerCase(Locale.ROOT);

        if (ticket.getTicketNo() != null
                && ticket.getTicketNo().toLowerCase(Locale.ROOT).contains(needle)) {
            return true;
        }
        if (ticket.getTitle() != null
                && ticket.getTitle().toLowerCase(Locale.ROOT).contains(needle)) {
            return true;
        }
        if (ticket.getProduct() != null
                && ticket.getProduct().getName() != null
                && ticket.getProduct().getName().toLowerCase(Locale.ROOT).contains(needle)) {
            return true;
        }
        if (ticket.getAssignedAgent() != null
                && ticket.getAssignedAgent().getUsername() != null
                && ticket.getAssignedAgent().getUsername().toLowerCase(Locale.ROOT).contains(needle)) {
            return true;
        }
        if (ticket.getId() != null && needle.chars().allMatch(Character::isDigit)) {
            try {
                if (Long.parseLong(needle) == ticket.getId()) {
                    return true;
                }
            } catch (NumberFormatException ignored) {
                // needle çok uzunsa parse taşabilir; o zaman eşleşme yok
            }
        }
        return false;
    }

    private String normalizeEnum(String value) {
        return value.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
    }

    private Instant calculateSlaTargetAt(TicketPriority priority, Instant from) {
        long minutes = resolveTargetMinutes(priority);
        return from.plus(minutes, ChronoUnit.MINUTES);
    }

    /**
     * SLA hedef süresini (dakika) belirler.
     * Önce veritabanındaki sla_policies tablosuna bakılır; kayıt yoksa fallback değerleri kullanılır.
     */
    private long resolveTargetMinutes(TicketPriority priority) {
        if (priority != null) {
            var policy = slaPolicyRepository.findByPriority(priority);
            if (policy.isPresent()) {
                return policy.get().getTargetMinutes();
            }
        }
        return fallbackTargetMinutes(priority);
    }

    /**
     * DB'de SLA politikası tanımlı değilse kullanılan varsayılan süreler:
     *   HIGH     →  240 dk  (4 saat)
     *   MEDIUM   →  480 dk  (8 saat)
     *   LOW      → 1440 dk  (24 saat)
     */
    private static long fallbackTargetMinutes(TicketPriority priority) {
        if (priority == null) {
            return 480;
        }
        return switch (priority) {
            case HIGH -> 240;
            case LOW -> 1440;
            default -> 480;
        };
    }

    private TicketResponse mapToResponse(Ticket ticket) {
        Instant now = Instant.now();
        TicketResponse response = new TicketResponse();
        response.setId(ticket.getId());
        response.setTicketNo(ticket.getTicketNo());
        response.setTitle(ticket.getTitle());
        response.setDescription(ticket.getDescription());
        response.setPriority(ticket.getPriority());
        response.setStatus(ticket.getStatus());
        response.setAssignedAgentId(
                ticket.getAssignedAgent() != null ? ticket.getAssignedAgent().getId() : null
        );
        response.setAssignedAgentName(
                ticket.getAssignedAgent() != null ? ticket.getAssignedAgent().getName() : null
        );
        response.setCreatedByUsername(
                ticket.getCreatedBy() != null ? ticket.getCreatedBy().getUsername() : null
        );
        response.setCreatedByName(
                ticket.getCreatedBy() != null ? ticket.getCreatedBy().getName() : null
        );
        response.setCreatedAt(ticket.getCreatedAt());
        response.setUpdatedAt(ticket.getUpdatedAt());
        response.setProductId(ticket.getProduct() != null ? ticket.getProduct().getId() : null);
        response.setCategoryId(ticket.getCategory() != null ? ticket.getCategory().getId() : null);
        if (ticket.getIssueTypes() != null && !ticket.getIssueTypes().isEmpty()) {
            response.setIssueTypeIds(
                    ticket.getIssueTypes().stream().map(IssueType::getId).sorted().toList()
            );
        } else {
            response.setIssueTypeIds(List.of());
        }
        response.setResolutionNote(ticket.getResolutionNote());
        response.setResolvedAt(ticket.getResolvedAt());
        response.setClosedAt(ticket.getClosedAt());
        response.setSlaTargetAt(ticket.getSlaTargetAt());
        response.setSlaBreached(SlaEvaluator.isBreached(ticket, now));
        response.setSlaAtRisk(SlaEvaluator.isAtRisk(ticket, now));
        response.setArchived(ticket.isArchived());
        response.setSatisfactionRating(ticket.getSatisfactionRating());
        response.setSatisfactionComment(ticket.getSatisfactionComment());
        return response;
    }
}
