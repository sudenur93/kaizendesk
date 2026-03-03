package com.sau.kaizendesk.service;

import com.sau.kaizendesk.dto.DashboardSummaryResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    public DashboardSummaryResponse getSummary() {
        return new DashboardSummaryResponse();
    }
}
