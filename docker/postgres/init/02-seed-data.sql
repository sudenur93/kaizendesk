-- =============================================================
-- KaizenDesk Demo Seed Data
-- =============================================================

-- Kullanıcılar
INSERT INTO users (id, username, full_name, email, role) OVERRIDING SYSTEM VALUE VALUES
  (1, 'customer1',    'Ali Yılmaz',   'customer1@kaizendesk.demo',  'CUSTOMER'),
  (2, 'customer2',    'Ayşe Kaya',    'customer2@kaizendesk.demo',  'CUSTOMER'),
  (3, 'agent1',       'Mehmet Demir', 'agent1@kaizendesk.demo',     'AGENT'),
  (4, 'sude3',        'Sude Üç',      'sude3@test.com',             'AGENT'),
  (5, 'manager',      'Fatma Şahin',  'manager@kaizendesk.demo',    'MANAGER'),
  (6, 'agent2',       'Can Yıldız',   'agent2@kaizendesk.demo',     'AGENT'),
  (7, 'kaizendesk23', 'Kaizen Admin', 'kaizendesk23@gmail.com',     'MANAGER')
ON CONFLICT (id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('users','id'), (SELECT MAX(id) FROM users));

-- Mevcut ticketları temizle (yeniden seed için)
TRUNCATE ticket_issue_types, worklogs, comments, notifications, tickets RESTART IDENTITY CASCADE;

-- TICKETS
INSERT INTO tickets
  (id, ticket_no, title, description, priority, status,
   product_id, category_id, created_by, assigned_to,
   created_at, updated_at, sla_target_at, sla_breached,
   resolved_at, closed_at, resolution_note)
OVERRIDING SYSTEM VALUE VALUES

(1,  'KD-001', 'ERP sistemine giriş yapılamıyor',
 'Sabahtan beri ERP sistemine bağlanamıyorum. Hata kodu: 503. Tüm departman etkileniyor.',
 'HIGH', 'CLOSED', 8, 12, 1, 3,
 NOW()-'7 days'::interval, NOW()-'5 days'::interval,
 NOW()-'7 days'::interval+'4 hours'::interval, false,
 NOW()-'6 days'::interval, NOW()-'5 days'::interval,
 'ERP sunucusundaki bağlantı havuzu dolmuştu. Uygulama yeniden başlatıldı, limit 200→500 artırıldı.'),

(2,  'KD-002', 'Yazıcı ağda görünmüyor',
 '3. kattaki HP LaserJet ağ yazıcısı bilgisayarımda listelenmiyor. IP ping''e cevap veriyor.',
 'MEDIUM', 'RESOLVED', 8, 13, 1, 4,
 NOW()-'6 days'::interval, NOW()-'4 days'::interval,
 NOW()-'6 days'::interval+'8 hours'::interval, false,
 NOW()-'4 days'::interval, NULL,
 'Print Spooler servisi yeniden yapılandırıldı ve sürücü güncellendi.'),

(3,  'KD-003', 'Yeni kullanıcı hesabı açılması',
 'Yeni işe başlayan Kemal Yıldız için ERP, intranet ve e-posta hesabı gerekiyor. Pazartesi başlıyor.',
 'MEDIUM', 'IN_PROGRESS', 8, 14, 2, 4,
 NOW()-'5 days'::interval, NOW()-'2 days'::interval,
 NOW()-'5 days'::interval+'8 hours'::interval, false,
 NULL, NULL, NULL),

(4,  'KD-004', 'ERP raporlama modülü yavaş çalışıyor',
 'Aylık üretim raporu alınırken sistem donuyor, yaklaşık 20 dakika bekliyoruz.',
 'HIGH', 'WAITING_FOR_CUSTOMER', 8, 12, 2, 3,
 NOW()-'5 days'::interval, NOW()-'1 day'::interval,
 NOW()-'5 days'::interval+'4 hours'::interval, false,
 NULL, NULL, NULL),

(5,  'KD-005', 'VPN bağlantısı sürekli kesiliyor',
 'Evden çalışırken Cisco AnyConnect VPN her 30 dakikada bir otomatik düşüyor.',
 'MEDIUM', 'NEW', 8, 14, 1, NULL,
 NOW()-'3 days'::interval, NOW()-'3 days'::interval,
 NOW()-'3 days'::interval+'8 hours'::interval, false,
 NULL, NULL, NULL),

(6,  'KD-006', 'Hat-2 konveyör bant motoru arızası',
 'A bloğu hat-2 konveyör bandı tamamen durdu. Motor sürücüsünde aşırı ısınma alarmı var. Üretim 3 saattir bekliyor.',
 'HIGH', 'IN_PROGRESS', 5, 5, 2, 3,
 NOW()-'4 days'::interval, NOW()-'3 days'::interval,
 NOW()-'4 days'::interval+'4 hours'::interval, false,
 NULL, NULL, NULL),

(7,  'KD-007', 'Kompresör-3 500 saatlik periyodik bakım',
 'Merkezi hava kompresörü 3 numaralı ünite 500 saatlik bakım zamanına ulaştı. Yağ ve filtre değişimi gerekiyor.',
 'LOW', 'CLOSED', 7, 9, 1, 4,
 NOW()-'10 days'::interval, NOW()-'7 days'::interval,
 NOW()-'10 days'::interval+'24 hours'::interval, false,
 NOW()-'8 days'::interval, NOW()-'7 days'::interval,
 'Yağ değişimi yapıldı, hava filtresi temizlendi, yağ filtresi yenilendi. Çalışma saati sıfırlandı.'),

(8,  'KD-008', 'Kumpas kalibrasyon sapması tespit edildi',
 'Kalite laboratuvarındaki 3 dijital kumpasta referans bloklara göre 0.02 mm sapma var. Kalibrasyon süresi dolmuş.',
 'HIGH', 'IN_PROGRESS', 6, 7, 2, 4,
 NOW()-'3 days'::interval, NOW()-'2 days'::interval,
 NOW()-'3 days'::interval+'4 hours'::interval, false,
 NULL, NULL, NULL),

(9,  'KD-009', 'CNC tezgah program yükleme hatası',
 'Hat-1 CNC tezgahına yeni program yüklenemiyor. "Memory full" hatası veriyor ama kapasite %60 dolu görünüyor.',
 'HIGH', 'RESOLVED', 5, 4, 1, 3,
 NOW()-'8 days'::interval, NOW()-'6 days'::interval,
 NOW()-'8 days'::interval+'4 hours'::interval, false,
 NOW()-'6 days'::interval, NULL,
 'DNC belleğindeki eski programlar temizlendi, hafıza yönetim yazılımı güncellendi.'),

(10, 'KD-010', 'B blok pano odası UPS alarmı',
 'B blok elektrik pano odasındaki UPS cihazı sürekli alarm veriyor. Batarya ikonu yanında kırmızı uyarı var.',
 'HIGH', 'NEW', 7, 10, 2, NULL,
 NOW()-'1 day'::interval, NOW()-'1 day'::interval,
 NOW()-'1 day'::interval+'4 hours'::interval, true,
 NULL, NULL, NULL),

(11, 'KD-011', 'ERP stok modülü negatif değer gösteriyor',
 'Ambar yönetimi ekranında 3 farklı ürün için stok negatif görünüyor. Fiili stok ile sistem uyuşmuyor.',
 'MEDIUM', 'WAITING_FOR_CUSTOMER', 8, 12, 1, 4,
 NOW()-'4 days'::interval, NOW()-'1 day'::interval,
 NOW()-'4 days'::interval+'8 hours'::interval, false,
 NULL, NULL, NULL),

(12, 'KD-012', 'Lot HA-2024 ölçü dışı çıktı',
 '500 adetlik HA-2024 lotunun boyut kontrolünde %8 ret oranı var. Tolerans 0.1mm iken 0.18-0.22mm sapma ölçüldü.',
 'HIGH', 'CLOSED', 6, 8, 2, 3,
 NOW()-'12 days'::interval, NOW()-'9 days'::interval,
 NOW()-'12 days'::interval+'4 hours'::interval, false,
 NOW()-'10 days'::interval, NOW()-'9 days'::interval,
 'Fikstür aşınması tespit edildi. Fikstür değiştirildi, kalibrasyon yenilendi, lot karantinaya alındı.'),

(13, 'KD-013', 'Hat-3 OEE değeri hedefin altında',
 'Bu hafta hat-3 OEE değeri %62, hedef %80. Plansız duruşlar artmış. Kök neden analizi için destek istiyoruz.',
 'MEDIUM', 'IN_PROGRESS', 5, 3, 1, 4,
 NOW()-'5 days'::interval, NOW()-'3 days'::interval,
 NOW()-'5 days'::interval+'8 hours'::interval, false,
 NULL, NULL, NULL),

(14, 'KD-014', 'Hidrolik pres sızdırmazlık sorunu',
 'C blok 200 tonluk hidrolik preste yağ sızıntısı başladı. Zemine yağ damlıyor, kayma riski var.',
 'HIGH', 'NEW', 7, 11, 2, NULL,
 NOW()-'2 hours'::interval, NOW()-'2 hours'::interval,
 NOW()-'2 hours'::interval+'4 hours'::interval, false,
 NULL, NULL, NULL),

(15, 'KD-015', 'Toplu parola sıfırlama - üretim hattı',
 '12 operatörün sisteme girememesi nedeniyle toplu parola sıfırlama gerekiyor. Güvenlik politikası güncellemesi sonrası kilitlendi.',
 'HIGH', 'RESOLVED', 8, 14, 2, 3,
 NOW()-'6 days'::interval, NOW()-'5 days'::interval,
 NOW()-'6 days'::interval+'4 hours'::interval, false,
 NOW()-'5 days'::interval, NULL,
 '12 kullanıcı hesabı yönetici panelinden sıfırlandı. Güvenlik politikası dokümante edildi.'),

(16, 'KD-016', 'Boya kalınlığı TS-EN standardının altında',
 'Son partide boya kalınlığı 80-90 mikron çıktı, standart minimum 120 mikron. Müşteri şikayeti var.',
 'HIGH', 'WAITING_FOR_CUSTOMER', 6, 6, 1, 4,
 NOW()-'3 days'::interval, NOW()-'1 day'::interval,
 NOW()-'3 days'::interval+'4 hours'::interval, false,
 NULL, NULL, NULL),

(17, 'KD-017', 'Barkod yazıcısı etiket beslemesi yapmıyor',
 'Ambar giriş noktasındaki Zebra ZT410 barkod yazıcısı etiket beslemesi yapmıyor. Etiket kağıdı takılıyor.',
 'MEDIUM', 'NEW', 8, 13, 2, NULL,
 NOW()-'6 hours'::interval, NOW()-'6 hours'::interval,
 NOW()-'6 hours'::interval+'8 hours'::interval, false,
 NULL, NULL, NULL),

(18, 'KD-018', 'Robot kaynak kolunun servo hatası',
 'Hat-1 robot kaynak istasyonunda servo motor "Encoder Error" veriyor. Robot referans pozisyonunu kaybetti.',
 'HIGH', 'CLOSED', 5, 5, 1, 3,
 NOW()-'15 days'::interval, NOW()-'12 days'::interval,
 NOW()-'15 days'::interval+'4 hours'::interval, false,
 NOW()-'13 days'::interval, NOW()-'12 days'::interval,
 'Encoder kablosu gevşemişti. Kablo değiştirildi, servo parametreleri yeniden ayarlandı.'),

(19, 'KD-019', 'Üretim hattı aydınlatma arızası - D blok',
 'D blok üretim hattı aydınlatmasının %40''ı çalışmıyor. Gece vardiyası etkileniyor.',
 'MEDIUM', 'IN_PROGRESS', 7, 10, 2, 4,
 NOW()-'2 days'::interval, NOW()-'1 day'::interval,
 NOW()-'2 days'::interval+'8 hours'::interval, false,
 NULL, NULL, NULL),

(20, 'KD-020', 'CMM ölçüm cihazı yazılım lisansı sona erdi',
 'Koordinat ölçüm makinesi (CMM) yazılımının lisansı doldu. Ölçüm raporu oluşturulamıyor.',
 'MEDIUM', 'NEW', 6, 7, 1, NULL,
 NOW()-'4 hours'::interval, NOW()-'4 hours'::interval,
 NOW()-'4 hours'::interval+'8 hours'::interval, false,
 NULL, NULL, NULL),

(21, 'KD-021', 'A blok elektrik panosu sigorta atması',
 'A bloğu ana elektrik panosunda 3 fazlı sigorta defalarca atıyor. Elektrik kesintisi yaşanıyor, hat durdu.',
 'HIGH', 'CLOSED', 7, 10, 1, 6,
 NOW()-'8 days'::interval, NOW()-'6 days'::interval,
 NOW()-'8 days'::interval+'4 hours'::interval, false,
 NOW()-'7 days'::interval, NOW()-'6 days'::interval,
 'Aşırı yük tespit edildi. Devre yük dengesi yeniden düzenlendi, sigorta kapasitesi artırıldı.'),

(22, 'KD-022', 'VPN istemcisi güncelleme sonrası bağlanmıyor',
 'Cisco AnyConnect 4.10 güncellemesi sonrası uzak çalışanlar VPN''e bağlanamıyor. 15 kişi etkileniyor.',
 'MEDIUM', 'RESOLVED', 8, 14, 2, 6,
 NOW()-'5 days'::interval, NOW()-'3 days'::interval,
 NOW()-'5 days'::interval+'8 hours'::interval, false,
 NOW()-'3 days'::interval, NULL,
 'VPN profil konfigürasyonu güncellendi, split-tunnel ayarı düzeltildi. Tüm kullanıcılar bağlanabiliyor.'),

(23, 'KD-023', 'Hat-4 konveyör bant hız kontrolü arızası',
 'Hat-4 konveyör bandı sabit hızda çalışıyor, hız kontrolörü komutları almıyor. Frekans inverteri alarmlı.',
 'HIGH', 'IN_PROGRESS', 5, 5, 1, 6,
 NOW()-'2 days'::interval, NOW()-'1 day'::interval,
 NOW()-'2 days'::interval+'4 hours'::interval, false,
 NULL, NULL, NULL);

SELECT setval(pg_get_serial_sequence('tickets','id'), (SELECT MAX(id) FROM tickets));

-- Ticket - Issue Type
INSERT INTO ticket_issue_types (ticket_id, issue_type_id) VALUES
  (1,13),(1,39),(2,27),(3,28),(4,39),(4,52),(5,41),
  (6,6),(7,23),(8,8),(9,5),(10,11),(11,13),(11,56),
  (12,9),(13,43),(13,30),(14,12),(15,15),(16,9),(16,22),
  (17,27),(18,6),(19,24),(20,21),(20,47),
  (21,11),(21,24),(22,41),(23,6),(23,43);

-- YORUMLAR
INSERT INTO comments (ticket_id, author_id, content, created_at) VALUES
(1, 1, 'Acil! Tüm departman çalışamıyor, sabah vardiyası durdu.', NOW()-'7 days'::interval),
(1, 3, 'İnceliyorum, sunucu loglarına bakıyorum.', NOW()-'7 days'::interval+'30 minutes'::interval),
(1, 3, 'Sorun tespit edildi. Bağlantı havuzu dolmuş. Çözüm uygulanıyor.', NOW()-'7 days'::interval+'2 hours'::interval),
(1, 1, 'Sistem açıldı, teşekkürler. Çok hızlı çözdünüz.', NOW()-'6 days'::interval+'8 hours'::interval),

(2, 1, 'Yazıcı IP: 192.168.10.45. Ping atıyorum cevap veriyor ama Windows''ta görünmüyor.', NOW()-'6 days'::interval),
(2, 4, 'Uzaktan bağlandım, Print Spooler servisinde sorun var. Düzeltiyorum.', NOW()-'5 days'::interval),
(2, 1, 'Artık görünüyor ve yazdırıyor, teşekkürler.', NOW()-'4 days'::interval),

(4, 2, 'Raporun adı "Aylık Üretim Özeti". Tüm departmanları seçiyorum.', NOW()-'5 days'::interval),
(4, 3, 'Sorgu planına baktım, index eksikliği var. Hangi tarih aralığını seçiyorsunuz?', NOW()-'4 days'::interval),
(4, 2, 'Genellikle son 3 ayı seçiyoruz.', NOW()-'3 days'::interval),
(4, 3, 'DB adminden index ekleme yetkisi bekliyoruz. Onay gelince çözülecek.', NOW()-'2 days'::interval),

(6, 2, 'Motor sürücüsü: Schneider Altivar 312. Hata kodu: OHF (aşırı ısınma).', NOW()-'4 days'::interval),
(6, 3, 'Geldim, sürücü gerçekten aşırı ısınmış. Fan filtresi tıkanmış.', NOW()-'4 days'::interval+'1 hour'::interval),
(6, 3, 'Fan filtresi temizlendi, sürücü soğutuldu. Test çalışması yapıyoruz.', NOW()-'3 days'::interval),
(6, 2, 'Hat tekrar çalışıyor, teşekkürler!', NOW()-'3 days'::interval+'2 hours'::interval),

(8, 2, 'Kumpas seri no: KP-001, KP-002, KP-003. Son kalibrasyon 8 ay önce.', NOW()-'3 days'::interval),
(8, 4, 'Sertifikalar 6 ayda bir yenilenmeli. Dış kalibrasyon laboratuvarına göndereceğiz.', NOW()-'2 days'::interval),
(8, 2, 'Ne kadar sürer? Üretimde kullanıyoruz.', NOW()-'2 days'::interval+'3 hours'::interval),
(8, 4, 'Genellikle 3-5 iş günü. Bu süreçte yedek kumpasları kullanabilirsiniz.', NOW()-'1 day'::interval),

(9, 1, 'Hata mesajı: "Memory full - Cannot load program". Program boyutu 2.4 MB.', NOW()-'8 days'::interval),
(9, 3, 'Tezgah hafızasını inceliyorum. Çok sayıda eski program birikmiş.', NOW()-'7 days'::interval),
(9, 1, '2020 öncesi programlar kullanılmıyor, silebilirsiniz.', NOW()-'7 days'::interval+'2 hours'::interval),
(9, 3, 'Eski programlar temizlendi, yeni program yüklendi. Tezgah çalışıyor.', NOW()-'6 days'::interval),

(11, 1, 'Negatif görünen ürün kodları: MAL-1045, MAL-1067, MAL-2031', NOW()-'4 days'::interval),
(11, 4, 'Bu ürünler için son 1 ayda elle stok düzeltmesi yapıldı mı?', NOW()-'3 days'::interval),
(11, 1, 'Evet, geçen hafta ambar sorumlusu düzeltme yapmış.', NOW()-'2 days'::interval),
(11, 4, 'Hareket geçmişini incelememiz lazım. Ambar sorumlusunun adını verir misiniz?', NOW()-'1 day'::interval),

(13, 1, 'Bu hafta 14 plansız duruş yaşandı, en uzunu 47 dakikaydı.', NOW()-'5 days'::interval),
(13, 4, 'SCADA kayıtlarından çekiyorum. İlk bakışta malzeme besleme kaynaklı.', NOW()-'4 days'::interval),
(13, 4, 'Malzeme besleme sensör değerleri tutarsız. Sensör değişimi öneriyorum.', NOW()-'3 days'::interval),

(16, 1, 'Müşteri ret yazısı geldi. Kalınlık ölçüm raporunu da ekledim.', NOW()-'3 days'::interval),
(16, 4, 'Boya tabancası basınç ayarı düşmüş olabilir. Mevcut basınç değeri nedir?', NOW()-'2 days'::interval),
(16, 1, 'Kontrol ettim, basınç göstergesi 2.8 bar gösteriyor.', NOW()-'1 day'::interval),
(16, 4, 'Standart 4.2-4.5 bar olmalı. Boya ustasıyla kontrol edin ve bildirin.', NOW()-'20 hours'::interval),

(19, 2, 'D blok 12-15 arası bandalar çalışmıyor. Gece vardiyası etkileniyor.', NOW()-'2 days'::interval),
(19, 4, 'Tespite geldim. 8 adet balast arızalı. Yedek malzeme deposundan alınıyor.', NOW()-'1 day'::interval),

(21, 1, 'Acil! A blok tamamen karanlık, üretim durdu.', NOW()-'8 days'::interval),
(21, 6, 'Geldim, 3 fazlı sigorta defalarca atıyor. Aşırı yük şüphesi var.', NOW()-'8 days'::interval+'1 hour'::interval),
(21, 6, 'Yük analizi tamamlandı. Devre yeniden düzenlendi, çözüldü.', NOW()-'7 days'::interval),
(21, 1, 'Hat tekrar çalışıyor, çok hızlı çözdünüz teşekkürler!', NOW()-'6 days'::interval),

(22, 2, '4.10 güncellemesi sonrası kimse bağlanamıyor, çalışamıyoruz.', NOW()-'5 days'::interval),
(22, 6, 'VPN profil konfigürasyonunu inceliyorum, split-tunnel ayarı bozulmuş.', NOW()-'4 days'::interval),
(22, 6, 'Profil güncellendi, test ettim. Bağlantı sağlandı.', NOW()-'3 days'::interval),

(23, 1, 'Frekans inverteri alarm kodu: F0011. Hat durdu.', NOW()-'2 days'::interval),
(23, 6, 'Sahaya geldim. Parametre sıfırlama deniyorum.', NOW()-'2 days'::interval+'2 hours'::interval),
(23, 6, 'Kısmi ilerleme var, inverter çalışıyor ama hız kontrolü hâlâ dengesiz. Takip ediyorum.', NOW()-'1 day'::interval);

-- WORKLOGLAR
INSERT INTO worklogs (ticket_id, author_id, note, duration_minutes, work_date) VALUES
(1,  3, 'Sunucu log analizi ve sorun tespiti', 45, NOW()-'7 days'::interval),
(1,  3, 'Bağlantı havuzu yapılandırması ve restart', 30, NOW()-'7 days'::interval),
(2,  4, 'Uzaktan bağlantı ve sorun tespiti', 20, NOW()-'5 days'::interval),
(2,  4, 'Print Spooler yeniden yapılandırma', 40, NOW()-'5 days'::interval),
(4,  3, 'ERP sorgu planı analizi', 60, NOW()-'4 days'::interval),
(4,  3, 'DB admin ile görüşme ve index talebi', 30, NOW()-'3 days'::interval),
(6,  3, 'Saha ziyareti ve arıza tespiti', 30, NOW()-'4 days'::interval),
(6,  3, 'Fan filtresi temizleme ve sürücü soğutma', 90, NOW()-'3 days'::interval),
(6,  3, 'Test çalışması ve izleme', 45, NOW()-'3 days'::interval),
(7,  4, 'Kompresör yağ ve filtre değişimi', 120, NOW()-'8 days'::interval),
(7,  4, 'Çalışma saati sıfırlama ve test', 30, NOW()-'8 days'::interval),
(8,  4, 'Kumpas kalibrasyon sapma analizi', 30, NOW()-'2 days'::interval),
(8,  4, 'Kalibrasyon laboratuvarı ile iletişim', 45, NOW()-'1 day'::interval),
(9,  3, 'DNC bellek analizi', 30, NOW()-'7 days'::interval),
(9,  3, 'Eski program temizliği ve yeni program yükleme', 60, NOW()-'6 days'::interval),
(12, 3, 'Lot inceleme ve ölçüm doğrulama', 60, NOW()-'12 days'::interval),
(12, 3, 'Fikstür değişimi ve kalibrasyon', 90, NOW()-'11 days'::interval),
(12, 3, 'Lot karantina prosedürü ve dokümantasyon', 45, NOW()-'10 days'::interval),
(13, 4, 'SCADA kayıt analizi', 90, NOW()-'4 days'::interval),
(13, 4, 'Saha sensör kontrolü', 60, NOW()-'3 days'::interval),
(15, 3, 'Toplu hesap sıfırlama işlemi', 45, NOW()-'5 days'::interval),
(18, 3, 'Robot hata tespiti ve encoder kontrolü', 60, NOW()-'14 days'::interval),
(18, 3, 'Encoder kablo değişimi', 90, NOW()-'13 days'::interval),
(18, 3, 'Servo parametre ayarı ve test', 60, NOW()-'13 days'::interval),
(19, 4, 'Saha tespiti ve arızalı balast sayımı', 45, NOW()-'1 day'::interval),
(19, 4, 'Balast değişimi (8 adet)', 120, NOW()-'20 hours'::interval),
(21, 6, 'Saha inceleme ve sigorta tespiti', 45, NOW()-'8 days'::interval),
(21, 6, 'Yük dengesi analizi ve sigorta değişimi', 90, NOW()-'7 days'::interval),
(22, 6, 'VPN profil analizi ve konfigürasyon testi', 60, NOW()-'4 days'::interval),
(22, 6, 'Split-tunnel düzeltme ve kullanıcı testi', 45, NOW()-'3 days'::interval),
(23, 6, 'Frekans inverteri hata kodu analizi', 60, NOW()-'2 days'::interval),
(23, 6, 'Parametre sıfırlama ve test çalışması', 75, NOW()-'1 day'::interval);
