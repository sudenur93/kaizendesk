package com.sau.kaizendesk.service;

import com.sau.kaizendesk.domain.entity.Ticket;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

@Component
public class TicketAccessService {

    /**
     * CUSTOMER ise yalnızca kendi oluşturduğu ticket üzerinde işlem yapabilir; AGENT/MANAGER için kısıt yok.
     */
    public void requireAccessIfCustomer(Ticket ticket, String username, boolean isCustomer) {
        if (!isCustomer) {
            return;
        }
        if (username == null
                || ticket.getCreatedBy() == null
                || ticket.getCreatedBy().getUsername() == null
                || !ticket.getCreatedBy().getUsername().equals(username)) {
            throw new AccessDeniedException("Bu ticket'a erişim yetkiniz yok");
        }
    }
}
