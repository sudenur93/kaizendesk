-- Arşiv işareti: kapatma ile arşivleme ayrıldı.
-- Müşteri talebi kapatırken arşive taşıyıp taşımamayı seçebilir.
-- Mevcut kapalı talepler geriye dönük arşivlenmiş sayılır (eski davranış korunur).
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE tickets SET archived = TRUE WHERE status = 'CLOSED';
