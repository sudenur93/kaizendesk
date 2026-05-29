ALTER TABLE users ADD COLUMN IF NOT EXISTS team VARCHAR(80);

-- Mevcut ajanlara varsayılan ekip ata
UPDATE users SET team = 'IT Destek'      WHERE username = 'agent1';
UPDATE users SET team = 'Bakım & Arıza'  WHERE username = 'agent2';
UPDATE users SET team = 'Üretim'         WHERE username = 'mehmet';
