-- jBPM 10 (Kogito) BPMN engine ile çalışan ticket süreç örneklerinin id'sini saklar.
-- Her ticket bir process instance ile eşlenir; süreç ilerledikçe Kogito kendi
-- tablolarında durumu yönetir.
ALTER TABLE tickets
    ADD COLUMN IF NOT EXISTS process_instance_id VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_tickets_process_instance_id
    ON tickets (process_instance_id);
