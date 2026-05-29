CREATE TABLE activity_logs (
    id            BIGSERIAL PRIMARY KEY,
    event_type    VARCHAR(50)  NOT NULL,
    actor         VARCHAR(100),
    ticket_id     BIGINT REFERENCES tickets(id) ON DELETE SET NULL,
    ticket_no     VARCHAR(20),
    ticket_title  VARCHAR(255),
    detail        TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
