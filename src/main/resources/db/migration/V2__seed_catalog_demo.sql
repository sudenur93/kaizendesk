-- Demo ürün / kategori / sorun tipi (analiz dokümanındaki ana hatlarla uyumlu örnek)

INSERT INTO products (name) VALUES ('Üretim Hattı A');
INSERT INTO products (name) VALUES ('Kalite Yönetimi');
INSERT INTO products (name) VALUES ('IT Altyapı');
INSERT INTO products (name) VALUES ('Diğer');

INSERT INTO categories (product_id, name)
SELECT id, 'Genel' FROM products WHERE name = 'Üretim Hattı A';

INSERT INTO categories (product_id, name)
SELECT id, 'Genel' FROM products WHERE name = 'Diğer';

INSERT INTO issue_types (category_id, name, requires_description, is_active)
SELECT c.id, 'Makine arızası', true, true
FROM categories c
JOIN products p ON p.id = c.product_id
WHERE p.name = 'Üretim Hattı A' AND c.name = 'Genel';

INSERT INTO issue_types (category_id, name, requires_description, is_active)
SELECT c.id, 'Malzeme uyuşmazlığı', true, true
FROM categories c
JOIN products p ON p.id = c.product_id
WHERE p.name = 'Üretim Hattı A' AND c.name = 'Genel';

INSERT INTO issue_types (category_id, name, requires_description, is_active)
SELECT c.id, 'Genel sorun', true, true
FROM categories c
JOIN products p ON p.id = c.product_id
WHERE p.name = 'Diğer' AND c.name = 'Genel';
