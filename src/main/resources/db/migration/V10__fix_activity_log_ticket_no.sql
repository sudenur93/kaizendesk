-- activity_logs.ticket_no sütunu KD-<epoch>-<suffix> formatında 25 karakter üretiyor.
-- VARCHAR(20) → VARCHAR(50) olarak genişletildi.
ALTER TABLE activity_logs ALTER COLUMN ticket_no TYPE VARCHAR(50);
