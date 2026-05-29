package com.sau.kaizendesk.controller;

import com.sau.kaizendesk.service.ActivityLogService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/activity")
public class ActivityController {

    private final ActivityLogService activityLogService;

    public ActivityController(ActivityLogService activityLogService) {
        this.activityLogService = activityLogService;
    }

    @PreAuthorize("hasAnyRole('AGENT','MANAGER')")
    @GetMapping("/recent")
    public ResponseEntity<List<Map<String, Object>>> getRecent(
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ResponseEntity.ok(activityLogService.getRecent(Math.min(limit, 50)));
    }
}
