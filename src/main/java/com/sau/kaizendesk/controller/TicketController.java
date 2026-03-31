package com.sau.kaizendesk.controller;

import com.sau.kaizendesk.domain.enums.TicketStatus;
import com.sau.kaizendesk.dto.AssignAgentRequest;
import com.sau.kaizendesk.dto.CreateTicketRequest;
import com.sau.kaizendesk.dto.TicketResponse;
import com.sau.kaizendesk.dto.UpdateStatusRequest;
import com.sau.kaizendesk.service.TicketService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tickets")
public class TicketController {

    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @PostMapping
    public ResponseEntity<TicketResponse> createTicket(
            @Valid @RequestBody CreateTicketRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String username = jwt.getClaimAsString("preferred_username");
        TicketResponse response = ticketService.createTicket(request, username);
        return ResponseEntity.ok(response);
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @GetMapping
    public ResponseEntity<List<TicketResponse>> getAllTickets(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
			@RequestParam(required = false) Long assignedTo,
			@AuthenticationPrincipal Jwt jwt
    ) {
		String username = jwt.getClaimAsString("preferred_username");
		boolean isCustomer = isCustomer(jwt);
		return ResponseEntity.ok(ticketService.getTickets(status, priority, assignedTo, username, isCustomer));
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @GetMapping("/{id}")
	public ResponseEntity<TicketResponse> getTicketById(
			@PathVariable Long id,
			@AuthenticationPrincipal Jwt jwt
	) {
		String username = jwt.getClaimAsString("preferred_username");
		boolean isCustomer = isCustomer(jwt);
		return ResponseEntity.ok(ticketService.getTicketByIdForUser(id, username, isCustomer));
    }

	private boolean isCustomer(Jwt jwt) {
		Object realmAccess = jwt.getClaim("realm_access");
		if (!(realmAccess instanceof java.util.Map)) {
			return false;
		}
		java.util.Map<?, ?> map = (java.util.Map<?, ?>) realmAccess;
		Object rolesObj = map.get("roles");
		if (!(rolesObj instanceof java.util.List)) {
			return false;
		}
		java.util.List<?> roles = (java.util.List<?>) rolesObj;
		return roles.contains("CUSTOMER");
	}

    @PreAuthorize("hasAnyRole('AGENT','MANAGER')")
    @PatchMapping("/{id}/status")
    public ResponseEntity<TicketResponse> updateTicketStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStatusRequest request
    ) {
        return ResponseEntity.ok(ticketService.updateStatus(id, request.getStatus()));
    }

    @PreAuthorize("hasAnyRole('AGENT','MANAGER')")
    @PatchMapping("/{id}/assign")
    public ResponseEntity<TicketResponse> assignAgent(
            @PathVariable Long id,
            @Valid @RequestBody AssignAgentRequest request
    ) {
        return ResponseEntity.ok(ticketService.assignAgent(id, request.getAgentId()));
    }
}
