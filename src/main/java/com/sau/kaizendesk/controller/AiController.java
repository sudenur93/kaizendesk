package com.sau.kaizendesk.controller;

import com.sau.kaizendesk.dto.AiChatRequest;
import com.sau.kaizendesk.dto.AiTextResponse;
import com.sau.kaizendesk.service.AiService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private final AiService aiService;

    public AiController(AiService aiService) {
        this.aiService = aiService;
    }

    @PreAuthorize("hasAnyRole('AGENT','MANAGER')")
    @PostMapping("/summarize/{ticketId}")
    public ResponseEntity<AiTextResponse> summarize(@PathVariable Long ticketId) {
        return ResponseEntity.ok(new AiTextResponse(aiService.summarizeTicket(ticketId)));
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @PostMapping("/chat")
    public ResponseEntity<AiTextResponse> chat(@RequestBody AiChatRequest request) {
        return ResponseEntity.ok(new AiTextResponse(aiService.chat(request.message(), request.context())));
    }

    @PreAuthorize("hasAnyRole('CUSTOMER','AGENT','MANAGER')")
    @PostMapping("/suggest-priority")
    public ResponseEntity<AiTextResponse> suggestPriority(@RequestBody Map<String, String> body) {
        String priority = aiService.suggestPriority(body.get("title"), body.get("description"));
        return ResponseEntity.ok(new AiTextResponse(priority));
    }

    @PreAuthorize("hasAnyRole('AGENT','MANAGER')")
    @PostMapping("/suggest-reply/{ticketId}")
    public ResponseEntity<AiTextResponse> suggestReply(@PathVariable Long ticketId) {
        return ResponseEntity.ok(new AiTextResponse(aiService.suggestReply(ticketId)));
    }

    @PreAuthorize("hasRole('MANAGER')")
    @PostMapping("/analyze-dashboard")
    public ResponseEntity<AiTextResponse> analyzeDashboard(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(new AiTextResponse(aiService.analyzeDashboard(body.get("stats"))));
    }

    @PreAuthorize("hasRole('MANAGER')")
    @PostMapping("/analyze-team")
    public ResponseEntity<AiTextResponse> analyzeTeam(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(new AiTextResponse(aiService.analyzeTeam(body.get("stats"))));
    }

    @PreAuthorize("hasRole('MANAGER')")
    @PostMapping("/analyze-sla")
    public ResponseEntity<AiTextResponse> analyzeSla(@RequestBody Map<String, String> body) {
        return ResponseEntity.ok(new AiTextResponse(aiService.analyzeSla(body.get("stats"))));
    }
}
