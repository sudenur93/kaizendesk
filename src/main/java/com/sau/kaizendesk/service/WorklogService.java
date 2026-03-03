package com.sau.kaizendesk.service;

import com.sau.kaizendesk.dto.CreateWorklogRequest;
import com.sau.kaizendesk.dto.WorklogResponse;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class WorklogService {

    @Transactional
    public WorklogResponse addWorklog(Long ticketId, CreateWorklogRequest request) {
        WorklogResponse response = new WorklogResponse();
        response.setTicketId(ticketId);
        response.setTimeSpent(request.getTimeSpent());
        response.setNote(request.getNote());
        return response;
    }

    public List<WorklogResponse> getWorklogs(Long ticketId) {
        return List.of();
    }
}
