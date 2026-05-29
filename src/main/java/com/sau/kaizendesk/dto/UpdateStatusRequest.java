package com.sau.kaizendesk.dto;

import com.sau.kaizendesk.domain.enums.TicketStatus;
import jakarta.validation.constraints.NotNull;

public class UpdateStatusRequest {

    @NotNull
    private TicketStatus status;

    /** RESOLVED hedefine geçerken zorunlu (çözüm notu). */
    private String resolutionNote;

    public TicketStatus getStatus() {
        return status;
    }

    public void setStatus(TicketStatus status) {
        this.status = status;
    }

    public String getResolutionNote() {
        return resolutionNote;
    }

    public void setResolutionNote(String resolutionNote) {
        this.resolutionNote = resolutionNote;
    }
}
