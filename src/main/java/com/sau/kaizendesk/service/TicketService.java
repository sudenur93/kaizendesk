package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Category;
import com.sau.kaizendesk.domain.entity.IssueType;
import com.sau.kaizendesk.domain.entity.Product;
import com.sau.kaizendesk.domain.entity.Ticket;
import com.sau.kaizendesk.domain.entity.User;
import com.sau.kaizendesk.domain.enums.TicketPriority;
import com.sau.kaizendesk.domain.enums.TicketStatus;
import com.sau.kaizendesk.dto.CreateTicketRequest;
import com.sau.kaizendesk.dto.TicketResponse;
import com.sau.kaizendesk.repository.CategoryRepository;
import com.sau.kaizendesk.repository.IssueTypeRepository;
import com.sau.kaizendesk.repository.ProductRepository;
import com.sau.kaizendesk.repository.SlaPolicyRepository;
import com.sau.kaizendesk.repository.TicketRepository;
import com.sau.kaizendesk.repository.UserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class TicketService {

    /** Önce yüksek öncelik, aynı öncelikte yeniden eskiye (createdAt). */
    private static final Comparator<Ticket> TICKET_LIST_ORDER =
            Comparator.comparing(Ticket::getPriority)
                    .reversed()
                    .thenComparing(Ticket::getCreatedAt, Comparator.reverseOrder());

    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final IssueTypeRepository issueTypeRepository;
    private final SlaPolicyRepository slaPolicyRepository;
    private final TicketNotificationService ticketNotificationService;

    public TicketService(
            TicketRepository ticketRepository,
            UserRepository userRepository,
            ProductRepository productRepository,
            CategoryRepository categoryRepository,
            IssueTypeRepository issueTypeRepository,
            SlaPolicyRepository slaPolicyRepository,
            TicketNotificationService ticketNotificationService
    ) {
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.issueTypeRepository = issueTypeRepository;
        this.slaPolicyRepository = slaPolicyRepository;
        this.ticketNotificationService = ticketNotificationService;
    }

    @Transactional
    public TicketResponse createTicket(CreateTicketRequest request, String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + username));

        Product product = productRepository.findById(request.getProductId())
                .orElseThrow(() -> new IllegalArgumentException("Product not found: " + request.getProductId()));
        Category category = categoryRepository.findById(request.getCategoryId())
                .orElseThrow(() -> new IllegalArgumentException("Category not found: " + request.getCategoryId()));
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
        ticketNotificationService.onTicketCreated(savedTicket);
        ticketNotificationService.maybeNotifySlaAtRisk(savedTicket, now);
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
        if (newStatus == TicketStatus.RESOLVED) {
            if (resolutionNote == null || resolutionNote.isBlank()) {
                throw new IllegalArgumentException("Çözüm notu zorunlu (resolutionNote)");
            }
            ticket.setResolutionNote(resolutionNote.trim());
            ticket.setResolvedAt(now);
        }
        if (newStatus == TicketStatus.CLOSED) {
            ticket.setClosedAt(now);
        }

        boolean wasBreached = ticket.isSlaBreached();
        ticket.setStatus(newStatus);
        ticket.setUpdatedAt(now);
        syncSlaBreachedFlag(ticket, now);
        Ticket saved = ticketRepository.save(ticket);
        ticketNotificationService.onStatusChanged(saved, from, newStatus);
        ticketNotificationService.maybeNotifySlaBreached(saved, wasBreached, now);
        ticketNotificationService.maybeNotifySlaAtRisk(saved, now);
        return mapToResponse(saved);
    }

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
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + id));

        User agent = userRepository.findById(agentId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + agentId));

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
        return mapToResponse(updatedTicket);
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

    private long resolveTargetMinutes(TicketPriority priority) {
        if (priority != null) {
            var policy = slaPolicyRepository.findByPriority(priority);
            if (policy.isPresent()) {
                return policy.get().getTargetMinutes();
            }
        }
        return fallbackTargetMinutes(priority);
    }

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
        response.setTitle(ticket.getTitle());
        response.setDescription(ticket.getDescription());
        response.setPriority(ticket.getPriority());
        response.setStatus(ticket.getStatus());
        response.setAssignedAgentId(
                ticket.getAssignedAgent() != null ? ticket.getAssignedAgent().getId() : null
        );
        response.setCreatedByUsername(
                ticket.getCreatedBy() != null ? ticket.getCreatedBy().getUsername() : null
        );
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
        return response;
    }
}
