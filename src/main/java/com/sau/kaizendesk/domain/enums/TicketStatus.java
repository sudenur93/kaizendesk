package com.sau.kaizendesk.domain.enums;

/**
 * Yaşam döngüsü: NEW → IN_PROGRESS → WAITING_FOR_CUSTOMER → RESOLVED → CLOSED (detaylı geçişler serviste).
 */
public enum TicketStatus {
    NEW,
    IN_PROGRESS,
    WAITING_FOR_CUSTOMER,
    RESOLVED,
    CLOSED
}
