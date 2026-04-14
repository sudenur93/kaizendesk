package com.sau.kaizendesk.controller;

import com.sau.kaizendesk.dto.CommentResponse;
import com.sau.kaizendesk.dto.CreateCommentRequest;
import com.sau.kaizendesk.security.JwtRealmRoles;
import com.sau.kaizendesk.service.CommentService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tickets/{ticketId}/comments")
public class CommentController {

    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @PostMapping
    public ResponseEntity<CommentResponse> addComment(
            @PathVariable Long ticketId,
			@Valid @RequestBody CreateCommentRequest request,
			@AuthenticationPrincipal Jwt jwt
    ) {
		String username = jwt.getClaimAsString("preferred_username");
		boolean isCustomer = JwtRealmRoles.isCustomer(jwt);
		return ResponseEntity.ok(commentService.addComment(ticketId, request, username, isCustomer));
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @GetMapping
    public ResponseEntity<List<CommentResponse>> getComments(
			@PathVariable Long ticketId,
			@AuthenticationPrincipal Jwt jwt
) {
		String username = jwt.getClaimAsString("preferred_username");
		boolean isCustomer = JwtRealmRoles.isCustomer(jwt);
        return ResponseEntity.ok(commentService.getComments(ticketId, username, isCustomer));
    }
}
