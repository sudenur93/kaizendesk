package com.sau.kaizendesk.controller;

import com.sau.kaizendesk.dto.AssignAgentRequest;
import com.sau.kaizendesk.dto.CreateTicketRequest;
import com.sau.kaizendesk.dto.TicketResponse;
import com.sau.kaizendesk.dto.UpdateStatusRequest;
import com.sau.kaizendesk.domain.enums.TicketPriority;
import com.sau.kaizendesk.security.JwtRealmRoles;
import com.sau.kaizendesk.service.TicketService;
import java.util.Map;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Bilet yönetimi REST API'si.
 * Tüm endpoint'ler /api/v1/tickets altında yer alır.
 *
 * Yetkilendirme özeti:
 *   POST   /                    → CUSTOMER, AGENT, MANAGER  (bilet oluştur)
 *   GET    /                    → CUSTOMER, AGENT, MANAGER  (listele; müşteri sadece kendininkini görür)
 *   GET    /{id}                → CUSTOMER, AGENT, MANAGER  (detay; müşteri sadece kendininkini görür)
 *   PATCH  /{id}/status         → AGENT, MANAGER            (durum güncelle)
 *   PATCH  /{id}/customer-action → CUSTOMER                 (confirm/reopen)
 *   DELETE /{id}                → CUSTOMER                  (sadece NEW durumundaki kendi bileti)
 *   PATCH  /{id}/priority       → AGENT, MANAGER            (öncelik güncelle)
 *   PATCH  /{id}/assign         → AGENT, MANAGER            (ajan ata)
 *
 * Her endpoint JWT'den preferred_username okuyarak servis katmanına iletir.
 * Rol kontrolü hem @PreAuthorize hem de servis içi mantıkla çift katmanlı yapılır.
 */
@RestController
@RequestMapping("/api/v1/tickets")
public class TicketController {

    private final TicketService ticketService;

    public TicketController(TicketService ticketService) {
        this.ticketService = ticketService;
    }

    /**
     * Yeni bilet oluşturur.
     * JWT'den username alınarak bilet sahibi olarak kaydedilir.
     */
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

    /**
     * Biletleri listeler.
     * Müşteri rolünde: yalnızca kendi oluşturduğu biletler döner (isCustomer=true filtresi).
     * Ajan/Manager rolünde: tüm biletler döner; status, priority, assignedTo, q parametreleriyle filtrele.
     */
    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @GetMapping
    public ResponseEntity<List<TicketResponse>> getAllTickets(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Long assignedTo,
            @RequestParam(required = false) String q,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String username = jwt.getClaimAsString("preferred_username");
        boolean isCustomer = JwtRealmRoles.isCustomer(jwt);
        return ResponseEntity.ok(
                ticketService.getTickets(status, priority, assignedTo, username, isCustomer, q));
    }

    /** Tek bilet detayını döner. Müşteri yalnızca kendi biletine erişebilir. */
    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @GetMapping("/{id}")
	public ResponseEntity<TicketResponse> getTicketById(
			@PathVariable Long id,
			@AuthenticationPrincipal Jwt jwt
	) {
		String username = jwt.getClaimAsString("preferred_username");
		boolean isCustomer = JwtRealmRoles.isCustomer(jwt);
		return ResponseEntity.ok(ticketService.getTicketByIdForUser(id, username, isCustomer));
    }

    /**
     * Bilet durumunu günceller. Yalnızca ajan/manager yapabilir.
     * RESOLVED durumuna geçiş için resolutionNote zorunludur.
     * İzin verilen geçişler TicketService.isAllowedTransition() ile denetlenir.
     */
    @PreAuthorize("hasAnyRole('AGENT','MANAGER')")
    @PatchMapping("/{id}/status")
    public ResponseEntity<TicketResponse> updateTicketStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStatusRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String actor = jwt.getClaimAsString("preferred_username");
        return ResponseEntity.ok(
                ticketService.updateStatus(id, request.getStatus(), request.getResolutionNote(), actor)
        );
    }

    /**
     * Müşteri aksiyonu: RESOLVED durumundaki bileti kapat veya yeniden aç.
     * action = "confirm" → RESOLVED → CLOSED (müşteri sorunu onayladı)
     * action = "reopen"  → RESOLVED → IN_PROGRESS (müşteri sorunun devam ettiğini bildirdi)
     */
    @PreAuthorize("hasRole('CUSTOMER')")
    @PatchMapping("/{id}/customer-action")
    public ResponseEntity<TicketResponse> customerAction(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String username = jwt.getClaimAsString("preferred_username");
        String action = body.get("action");
        boolean archive = "true".equalsIgnoreCase(body.get("archive"));
        return ResponseEntity.ok(ticketService.customerAction(id, action, archive, username));
    }

    @PreAuthorize("hasRole('CUSTOMER')")
    @PatchMapping("/{id}/rating")
    public ResponseEntity<TicketResponse> rateTicket(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String username = jwt.getClaimAsString("preferred_username");
        int rating = Integer.parseInt(body.getOrDefault("rating", "0"));
        String comment = body.get("comment");
        return ResponseEntity.ok(ticketService.rateTicket(id, rating, comment, username));
    }

    /**
     * Müşteri kendi oluşturduğu ve NEW durumundaki bileti silebilir.
     * Başka kullanıcının bileti veya ileri durumdaki bilet silinemez.
     */
    @PreAuthorize("hasRole('CUSTOMER')")
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTicket(
            @PathVariable Long id,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String username = jwt.getClaimAsString("preferred_username");
        ticketService.deleteTicket(id, username);
    }

    @PreAuthorize("hasAnyRole('AGENT','MANAGER')")
    @PatchMapping("/{id}/priority")
    public ResponseEntity<TicketResponse> updatePriority(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String actor = jwt.getClaimAsString("preferred_username");
        TicketPriority priority = TicketPriority.valueOf(body.get("priority").toUpperCase());
        return ResponseEntity.ok(ticketService.updatePriority(id, priority, actor));
    }

    /**
     * Bileti bir ajana atar.
     * Ajan rolü → yalnızca atanmamış bileti kendi üzerine alabilir.
     * Manager rolü → herhangi bir ajana atayabilir.
     * Atama sırasında bilet NEW ise otomatik olarak IN_PROGRESS'e geçer.
     */
    @PreAuthorize("hasAnyRole('AGENT','MANAGER')")
    @PatchMapping("/{id}/assign")
    public ResponseEntity<TicketResponse> assignAgent(
            @PathVariable Long id,
            @Valid @RequestBody AssignAgentRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        String username = jwt.getClaimAsString("preferred_username");
        boolean isAgent = JwtRealmRoles.isAgent(jwt);
        boolean isManager = JwtRealmRoles.isManager(jwt);
        return ResponseEntity.ok(ticketService.assignAgent(id, request.getAgentId(), username, isAgent, isManager));
    }
}
