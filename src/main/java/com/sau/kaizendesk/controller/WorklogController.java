package com.sau.kaizendesk.controller;

import com.sau.kaizendesk.dto.CreateWorklogRequest;
import com.sau.kaizendesk.dto.WorklogResponse;
import com.sau.kaizendesk.service.WorklogService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tickets/{ticketId}/worklogs")
public class WorklogController {

    private final WorklogService worklogService;

    public WorklogController(WorklogService worklogService) {
        this.worklogService = worklogService;
    }

    @PreAuthorize("hasAnyRole('AGENT','MANAGER')")
    @PostMapping
    public ResponseEntity<WorklogResponse> addWorklog(
            @PathVariable Long ticketId,
            @Valid @RequestBody CreateWorklogRequest request
    ) {
        return ResponseEntity.ok(worklogService.addWorklog(ticketId, request));
    }

    @PreAuthorize("hasAnyRole('AGENT','MANAGER')")
    @GetMapping
    public ResponseEntity<List<WorklogResponse>> getWorklogs(@PathVariable Long ticketId) {
        return ResponseEntity.ok(worklogService.getWorklogs(ticketId));
    }
}
