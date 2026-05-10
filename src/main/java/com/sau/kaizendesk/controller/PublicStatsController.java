package com.sau.kaizendesk.controller;

import com.sau.kaizendesk.service.DashboardService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
public class PublicStatsController {

    private final DashboardService dashboardService;

    public PublicStatsController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        var summary = dashboardService.getSummary(null, null);
        double avgHours = summary.getAvgResolutionMinutes() > 0
                ? Math.round(summary.getAvgResolutionMinutes() / 60.0 * 10) / 10.0
                : 0;
        long activeTickets = summary.getOpenTickets() + summary.getInProgressTickets();
        long totalTickets = summary.getTotalTickets();

        return ResponseEntity.ok(Map.of(
                "activeTickets", activeTickets,
                "totalTickets", totalTickets,
                "slaComplianceRate", summary.getSlaComplianceRate(),
                "avgResolutionHours", avgHours
        ));
    }
}
