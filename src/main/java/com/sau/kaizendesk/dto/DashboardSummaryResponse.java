package com.sau.kaizendesk.dto;

import java.util.List;
import java.util.Map;

public class DashboardSummaryResponse {

    private long totalTickets;
    private long openTickets;
    private long inProgressTickets;
    private long waitingForCustomerTickets;
    private long resolvedTickets;
    private long closedTickets;

    private long slaBreachedCount;
    private double slaComplianceRate;
    private long closedToday;
    private long closedInRange;
    private Long avgResolutionMinutes;

    private Map<String, Long> statusCounts;
    private Map<String, Long> priorityCounts;
    private Map<String, Long> productCounts;

    private List<AgentPerformance> agentPerformances;

    public long getTotalTickets() {
        return totalTickets;
    }

    public void setTotalTickets(long totalTickets) {
        this.totalTickets = totalTickets;
    }

    public long getOpenTickets() {
        return openTickets;
    }

    public void setOpenTickets(long openTickets) {
        this.openTickets = openTickets;
    }

    public long getInProgressTickets() {
        return inProgressTickets;
    }

    public void setInProgressTickets(long inProgressTickets) {
        this.inProgressTickets = inProgressTickets;
    }

    public long getWaitingForCustomerTickets() {
        return waitingForCustomerTickets;
    }

    public void setWaitingForCustomerTickets(long waitingForCustomerTickets) {
        this.waitingForCustomerTickets = waitingForCustomerTickets;
    }

    public long getResolvedTickets() {
        return resolvedTickets;
    }

    public void setResolvedTickets(long resolvedTickets) {
        this.resolvedTickets = resolvedTickets;
    }

    public long getClosedTickets() {
        return closedTickets;
    }

    public void setClosedTickets(long closedTickets) {
        this.closedTickets = closedTickets;
    }

    public long getSlaBreachedCount() {
        return slaBreachedCount;
    }

    public void setSlaBreachedCount(long slaBreachedCount) {
        this.slaBreachedCount = slaBreachedCount;
    }

    public double getSlaComplianceRate() {
        return slaComplianceRate;
    }

    public void setSlaComplianceRate(double slaComplianceRate) {
        this.slaComplianceRate = slaComplianceRate;
    }

    public long getClosedToday() {
        return closedToday;
    }

    public void setClosedToday(long closedToday) {
        this.closedToday = closedToday;
    }

    public long getClosedInRange() {
        return closedInRange;
    }

    public void setClosedInRange(long closedInRange) {
        this.closedInRange = closedInRange;
    }

    public Long getAvgResolutionMinutes() {
        return avgResolutionMinutes;
    }

    public void setAvgResolutionMinutes(Long avgResolutionMinutes) {
        this.avgResolutionMinutes = avgResolutionMinutes;
    }

    public Map<String, Long> getStatusCounts() {
        return statusCounts;
    }

    public void setStatusCounts(Map<String, Long> statusCounts) {
        this.statusCounts = statusCounts;
    }

    public Map<String, Long> getPriorityCounts() {
        return priorityCounts;
    }

    public void setPriorityCounts(Map<String, Long> priorityCounts) {
        this.priorityCounts = priorityCounts;
    }

    public Map<String, Long> getProductCounts() {
        return productCounts;
    }

    public void setProductCounts(Map<String, Long> productCounts) {
        this.productCounts = productCounts;
    }

    public List<AgentPerformance> getAgentPerformances() {
        return agentPerformances;
    }

    public void setAgentPerformances(List<AgentPerformance> agentPerformances) {
        this.agentPerformances = agentPerformances;
    }

    public static class AgentPerformance {
        private Long agentId;
        private String agentName;
        private long assignedCount;
        private long resolvedCount;
        private long closedCount;
        private Long avgResolutionMinutes;

        public Long getAgentId() {
            return agentId;
        }

        public void setAgentId(Long agentId) {
            this.agentId = agentId;
        }

        public String getAgentName() {
            return agentName;
        }

        public void setAgentName(String agentName) {
            this.agentName = agentName;
        }

        public long getAssignedCount() {
            return assignedCount;
        }

        public void setAssignedCount(long assignedCount) {
            this.assignedCount = assignedCount;
        }

        public long getResolvedCount() {
            return resolvedCount;
        }

        public void setResolvedCount(long resolvedCount) {
            this.resolvedCount = resolvedCount;
        }

        public long getClosedCount() {
            return closedCount;
        }

        public void setClosedCount(long closedCount) {
            this.closedCount = closedCount;
        }

        public Long getAvgResolutionMinutes() {
            return avgResolutionMinutes;
        }

        public void setAvgResolutionMinutes(Long avgResolutionMinutes) {
            this.avgResolutionMinutes = avgResolutionMinutes;
        }
    }
}
