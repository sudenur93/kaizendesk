-- Memnuniyet anketi (CSAT): müşteri çözülen/kapatılan talebi 1-5 yıldız puanlar.
-- satisfaction_rating  : 1-5 arası puan (boş = henüz puanlanmadı)
-- satisfaction_comment : opsiyonel geri bildirim metni
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_rating INTEGER;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS satisfaction_comment TEXT;
