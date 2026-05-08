-- Flowable BPMN engine ile çalışan ticket süreç örneklerinin id'sini saklar.
-- Her ticket bir process instance ile eşlenir; süreç ilerledikçe Flowable kendi
-- ACT_RU_* tablolarında durumu yönetir.
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS process_instance_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_tickets_process_instance_id
    ON tickets (process_instance_id);
