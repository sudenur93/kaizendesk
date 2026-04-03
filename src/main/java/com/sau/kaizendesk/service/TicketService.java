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
import com.sau.kaizendesk.repository.TicketRepository;
import com.sau.kaizendesk.repository.UserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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

    private final TicketRepository ticketRepository;
    private final UserRepository userRepository;
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final IssueTypeRepository issueTypeRepository;

    public TicketService(
            TicketRepository ticketRepository,
            UserRepository userRepository,
            ProductRepository productRepository,
            CategoryRepository categoryRepository,
            IssueTypeRepository issueTypeRepository
    ) {
        this.ticketRepository = ticketRepository;
        this.userRepository = userRepository;
        this.productRepository = productRepository;
        this.categoryRepository = categoryRepository;
        this.issueTypeRepository = issueTypeRepository;
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
        ticket.setStatus(TicketStatus.OPEN);
        ticket.setProduct(product);
        ticket.setCategory(category);
        ticket.setIssueTypes(new HashSet<>(issueTypes));
        ticket.setCreatedBy(user);
        ticket.setCreatedAt(now);
        ticket.setUpdatedAt(now);
        ticket.setSlaTargetAt(calculateSlaTargetAt(request.getPriority(), now));

        Ticket savedTicket = ticketRepository.save(ticket);
        return mapToResponse(savedTicket);
    }

    private String generateTicketNo(Instant now) {
        // human-friendly unique-ish ticket id
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        return "KD-" + now.toEpochMilli() + "-" + suffix;
    }

    public List<TicketResponse> listTickets() {
        return ticketRepository.findAll()
                .stream()
                .map(this::mapToResponse)
                .toList();
    }

	public List<TicketResponse> getTickets(String status, String priority, Long assignedTo) {
		// Eski imza: testler ve geriye dönük uyumluluk için korunuyor.
		return getTickets(status, priority, assignedTo, null, false);
	}

	public List<TicketResponse> getTickets(
			String status,
			String priority,
			Long assignedTo,
			String username,
			boolean isCustomer
	) {
        return ticketRepository.findAll()
                .stream()
                .filter(ticket -> matchesStatus(ticket, status))
                .filter(ticket -> matchesPriority(ticket, priority))
                .filter(ticket -> matchesAssignedAgent(ticket, assignedTo))
				.filter(ticket -> !isCustomer || isCreatedBy(ticket, username))
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
    public TicketResponse updateStatus(Long id, TicketStatus status) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + id));

        ticket.setStatus(status);
        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket);
    }

    @Transactional
    public TicketResponse assignAgent(Long id, Long agentId) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + id));

        User agent = userRepository.findById(agentId)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + agentId));

        ticket.setAssignedAgent(agent);
        Ticket updatedTicket = ticketRepository.save(ticket);
        return mapToResponse(updatedTicket);
    }

    private boolean matchesStatus(Ticket ticket, String status) {
        if (status == null || status.isBlank()) {
            return true;
        }
        try {
            return ticket.getStatus() == TicketStatus.valueOf(normalizeEnum(status));
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

    private String normalizeEnum(String value) {
        return value.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
    }

    private Instant calculateSlaTargetAt(TicketPriority priority, Instant from) {
        long minutes;
        if (priority == null) {
            minutes = 480; // varsayılan medium
        } else {
            switch (priority) {
                case HIGH -> minutes = 240;
                case LOW -> minutes = 1440;
                default -> minutes = 480;
            }
        }
        return from.plus(minutes, ChronoUnit.MINUTES);
    }

    private TicketResponse mapToResponse(Ticket ticket) {
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
        return response;
    }
}
