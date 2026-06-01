-- SLA duraklatma: müşteriden cevap beklenirken (WAITING_FOR_CUSTOMER) SLA saati durur.
-- sla_paused_minutes : beklemede geçen toplam süre (dakika), SLA hedefinden düşülür
-- waiting_since      : bilet en son beklemeye girdiği an (çıkınca süre biriktirilip null'lanır)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_paused_minutes BIGINT NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS waiting_since TIMESTAMPTZ;
