-- OPEN -> NEW; analiz akışı: NEW, IN_PROGRESS, WAITING_FOR_CUSTOMER, RESOLVED, CLOSED

ALTER TABLE tickets DROP CONSTRAINT ck_tickets_status;

UPDATE tickets SET status = 'NEW' WHERE status = 'OPEN';

ALTER TABLE tickets ADD CONSTRAINT ck_tickets_status CHECK (
    status IN (
        'NEW',
        'IN_PROGRESS',
        'WAITING_FOR_CUSTOMER',
        'RESOLVED',
        'CLOSED'
    )
);
