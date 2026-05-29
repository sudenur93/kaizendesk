-- Customer portal catalog options.
-- Active products are scoped, each product has its own categories,
-- and every category exposes the same generic set of issue types.

UPDATE products
SET is_active = false
WHERE name IN ('Üretim Hattı A', 'Kalite Yönetimi', 'IT Altyapı', 'Lojistik / Depo');

DELETE FROM categories
WHERE name = 'Genel'
  AND product_id = (SELECT id FROM products WHERE name = 'Diğer');

INSERT INTO products (name, is_active) VALUES
    ('Üretim Hattı', true),
    ('Kalite Kontrol', true),
    ('Bakım & Arıza', true),
    ('IT Destek', true),
    ('Diğer', true)
ON CONFLICT (name) DO UPDATE SET is_active = EXCLUDED.is_active;

INSERT INTO categories (product_id, name)
SELECT p.id, c.name
FROM products p
JOIN (
    VALUES
        ('Üretim Hattı', 'Makine Duruşu'),
        ('Üretim Hattı', 'Operasyon Hatası'),
        ('Üretim Hattı', 'Verimlilik Sorunu'),
        ('Kalite Kontrol', 'Hatalı Ürün'),
        ('Kalite Kontrol', 'Ölçüm / Test Sorunu'),
        ('Kalite Kontrol', 'Standart Dışı Üretim'),
        ('Bakım & Arıza', 'Mekanik Arıza'),
        ('Bakım & Arıza', 'Elektrik Arızası'),
        ('Bakım & Arıza', 'Periyodik Bakım'),
        ('IT Destek', 'Sistem Girişi'),
        ('IT Destek', 'Yazıcı / Donanım'),
        ('IT Destek', 'ERP / Uygulama Hatası'),
        ('Diğer', 'Genel Talep')
) AS c(product_name, name) ON c.product_name = p.name
ON CONFLICT (product_id, name) DO NOTHING;

UPDATE issue_types
SET is_active = false
WHERE name NOT IN (
    'Acil müdahale gerekiyor',
    'Bilgi / destek talebi',
    'Tekrarlayan problem',
    'İyileştirme önerisi',
    'Doküman / ekran görüntüsü ile incelenecek'
);

INSERT INTO issue_types (category_id, name, requires_description, is_active)
SELECT cat.id, t.name, true, true
FROM categories cat
JOIN products p ON p.id = cat.product_id AND p.is_active = true
CROSS JOIN (
    VALUES
        ('Acil müdahale gerekiyor'),
        ('Bilgi / destek talebi'),
        ('Tekrarlayan problem'),
        ('İyileştirme önerisi'),
        ('Doküman / ekran görüntüsü ile incelenecek')
) AS t(name)
WHERE p.name IN ('Üretim Hattı', 'Kalite Kontrol', 'Bakım & Arıza', 'IT Destek', 'Diğer')
ON CONFLICT (category_id, name) DO UPDATE
    SET is_active = EXCLUDED.is_active,
        requires_description = EXCLUDED.requires_description;
