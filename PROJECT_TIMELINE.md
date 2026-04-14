# KaizenDesk — zaman çizelgesi (Haziran 1, 2026)

Başlangıç referans: **29 Mart 2026**. Bitiş: **1 Haziran 2026** (~9 hafta). **Son güncelleme:** ilerleme kutucukları kod tabanına göre işaretlendi.

Bu dosya, paylaşılan **KaizenDesk (Toyota) analiz dokümanı** ve üniversite teknik gereksinimleriyle hizalıdır. Haftalık ilerlemeyi burada işaretle.

---

## Analiz dokümanından çıkan "kilit kurallar" (backend/ürün)

| Konu | Kural |
|------|--------|
| Statü sırası | **New → In Progress → Waiting for Customer → Resolved → Closed** (workflow dışı geçiş yok) |
| Yeni ticket | **New** ile başlar; benzersiz ticket no |
| Atama | Personele atanınca (veya üzerine alınca) **In Progress**'e geçiş — dokümanda manuel atama |
| Resolved | **Çözüm notu zorunlu**; müşteri onayı bekleme mantığı |
| Closed | **Yalnızca destek veya yönetici** kapatır; müşteri doğrudan kapatamaz |
| Waiting | Müşteri yanıt verince süreç tekrar **In Progress** (API/entegrasyonda netleştirilecek) |
| Ek dosyalar | **txt, docx, xlsx, pdf**; görüntü **png, jpeg** |
| Sorun tipi | Kategoriye göre dinamik liste; **birden fazla sorun tipi** seçilebilir (`ticket_issue_types`) |
| Liste sıralama | Önce **yüksek öncelik**, aynı öncelikte **yeniden eskiye** |
| Arama (hedef) | Ticket id, başlık, ürün/sistem adı, atanan uzman |
| Worklog | Kayıtlar **değiştirilemez**, sadece listelenir |
| Bildirim | Açma, statü değişimi, SLA ihlal riski — SMS **yok** |
| **Kapsam dışı (analiz)** | **Native Android/iOS uygulama** geliştirilmesi yok |
| Üniversite rubriği | React web + (ders **React Native** isterse ayrı değerlendir); CI/CD "basit tasarım" analizde kapsam dışı sayılabilir — mevcut GitHub CI yine artıdır |

---

## Hafta 1 — 30 Mart – 5 Nisan 2026

**Odak:** API sözleşmesi + güvenlik + ticket omurgası + analizdeki ürün/kategori ağacı

- [x] Global exception handling + standart JSON hata gövdesi (`ControllerAdvice`)
- [x] Rol kuralları: müşteri **yalnızca kendi** ticket'ları; **AGENT/MANAGER** şimdilik tüm ticket listesi (ileride atanmamış havuz filtresi eklenebilir); yorum/ek için `TicketAccessService` ile müşteri sınırı
- [x] Yorum yazar: JWT'den kullanıcı (`CommentService` sabit user id kaldır)
- [x] Ticket oluşturma: ürün / kategori / **çoklu** sorun tipi; statü **NEW** (`OPEN` kaldırıldı, migration ile hizalı)
- [x] Flyway seed veya migration: demo katalog (`V2__seed_catalog_demo.sql`); ürün/kategori/sorun tipi API'leri

### Hafta 1 — günlük parçalar (her gün ~30–60 dk)

| Gün | Ne yapıyorsun? (küçük, bitirilebilir) |
|-----|----------------------------------------|
| **1** | **Hata JSON'u:** `GlobalExceptionHandler` + `ErrorResponse` zaten var → API'yi çalıştır, token ile **geçersiz body** gönder (ör. `POST /api/v1/tickets` boş `title`). Yanıtta `status`, `error`, `fieldErrors` olduğunu doğrula. İstersen `GET /api/v1/tickets/99999` ile 404 JSON'una bak. |
| **2** | **Yorum yazarı:** `CommentService` içindeki `findById(1L)` kalksın; `CommentController` JWT'den `preferred_username` alıp servise iletsin; yazar `userRepository.findByUsername` ile bulunsun. |
| **3** | **Müşteri ticket sınırı:** `GET /api/v1/tickets` ve `GET /api/v1/tickets/{id}` için `CUSTOMER` rolünde sadece **kendi oluşturduğu** kayıtlar; başkasının detayı **403** (veya 404 — ekip kararı). `AGENT`/`MANAGER` şimdilik hepsini görsün. |
| **4** | **Ticket isteği + DB:** `CreateTicketRequest`'e `productId`, `categoryId`, `issueTypeIds` (liste) ekle; kayıtta `tickets` + `ticket_issue_types` doldurulsun (şema uyumlu). Statüyü bir sonraki haftaya bırakabilirsin; bugün sadece alanlar + FK. |
| **5** | **Seed:** Yeni Flyway migration: 4 ana ürün/hat + "Diğer", her biri için `categories` / `issue_types` ve analizdeki metinlerle birkaç sorun tipi (tamamını yazmak zorunda değilsin, örnek 2'şer satır yeter). |

**Bugün (Gün 1):** Kod yazmadan da bitebilir: sadece **5–10 dakikalık doğrulama** — geçersiz istek at, dönen JSON'un tek formatta olduğunu not al. Yarın Gün 2'ye geç.

## Hafta 2 — 6 – 12 Nisan 2026

**Odak:** Yaşam döngüsü + iletişim + atama kuralları

- [x] Flyway + enum: **NEW**, **IN_PROGRESS**, **WAITING_FOR_CUSTOMER**, **RESOLVED**, **CLOSED**; geçiş matrisi `TicketService`
- [ ] İç / dış yorum veya müşteriye görünen iletişim + dahili not — **ertelendi** (tek yorum modeli; frontend'de sayfa ayrımı sonra)
- [x] **Atama** endpoint: atama sonrası **New → In Progress** (uygunsa)
- [x] Resolved: `resolution_note` zorunluluğu; statü PATCH müşteri için kapalı (`PreAuthorize`)

## Hafta 3 — 13 – 19 Nisan 2026

**Odak:** Ekler + worklog + bildirim + SLA işaretleme

- [x] `AttachmentService`: kalıcı saklama (`KAIZENDESK_ATTACHMENTS_DIR`), liste, indirme `GET .../attachments/{id}/file`; MIME + uzantı kuralı + `max-file-size` / `kaizendesk.attachments.max-file-size-bytes`
- [x] `WorklogService`: kalıcı kayıt, liste; yazar JWT; **güncelleme/silme yok**
- [x] `NotificationService`: **GET liste** + müşteri için ticket sahipliği filtresi
- [x] Olay bazlı bildirim kayıtları: `TicketNotificationService` — talep oluşturma, statü değişimi, atama, **SLA_AT_RISK** (ticket başına 24 saatte bir), **SLA_BREACHED** (bayrak ilk true olduğunda)
- [x] SLA: `sla_policies` seed, `slaTargetAt`, `slaBreached` senkronu, yanıtta `slaAtRisk` / `slaBreached`

## Hafta 4 — 20 – 26 Nisan 2026

**Odak:** Listeler + raporlama API (mockup / analiz 3.4)

- [x] Ticket liste: sıralama (öncelik desc, tarih desc); filtreler; **arama** (`q`: ticket no, başlık, ürün adı, atanan ajan, id)
- [x] Yönetici özet: açık dağılım, günlük kapanan, SLA ihlali, ort. çözüm süresi (`GET /api/v1/dashboard/summary`)
- [x] Trend / öncelik / sistem kırılımı: `statusCounts`, `priorityCounts`, `productCounts` dashboard yanıtında
- [x] Ajan performans tablosu verisi: `agentPerformances` (atanmış, çözülmüş, kapanmış, ort. çözüm süresi)
- [x] `API_ENDPOINTS.md` + örnek body'ler

## Hafta 5 — 27 Nisan – 3 Mayıs 2026

**Odak:** jBPM + süreç dokümantasyonu

- [ ] BPMN: ticket başına process instance; statü geçişleri süreçle hizalı (minimum entegrasyon veya tasarım + kayıt)
- [ ] Ticket kapanınca süreç sonlandırma (hedef)
- [ ] Kısa mimari: Docker, Keycloak, log/trace

## Hafta 6 — 4 – 10 Mayıs 2026

**Odak:** Backend sertleştirme + React başlangıcı

- [ ] Kritik uçlar için ek testler; müşteri/dstek ayrımı regresyon
- [ ] React: proje, router, layout, Keycloak, `/me` — **rol portal otomatik** (mockuptaki "rol seçimi" yerine JWT rolü)
- [ ] CORS / profiller

## Hafta 7 — 11 – 17 Mayıs 2026

**Odak:** Müşteri portalı (web)

- [ ] Yeni ticket formu: zorunlu alanlar, kategori → sorun tipi cascade, çoklu seçim, dosya kuralları
- [ ] Taleplerim: sıralama + filtre + arama; atanmamış / atanan sütunu

## Hafta 8 — 18 – 24 Mayıs 2026

**Odak:** Destek + yönetici web

- [ ] Destek listesi: özet kartlar, SLA vurgusu, sıralama kuralı
- [ ] Detay: iletişim akışı, ekler, durum/atama/worklog, çözüm notu + Resolved, Closed yetkisi
- [ ] Yönetici paneli: KPI + grafikler + ihlal tablosu

## Hafta 9 — 25 Mayıs – 1 Haziran 2026 (bitiş)

**Odak:** Teslim + tampon

- [ ] Uçtan uca demo senaryosu (script)
- [ ] README / sunum / ekran görüntüleri
- [ ] **React Native:** yalnızca **ders zorunlu kılarsa** ince dilim; analiz dokümanında native mobil **kapsam dışı**
- [ ] Son hata ve entegrasyon düzeltmeleri

---

## Şu anki odak (backend)

**Hafta 4 tamamlandı:** Liste sıralama/arama + dashboard KPI/ajan performansı + API dokümantasyonu. **Sıradaki (Hafta 5):** jBPM / süreç entegrasyonu veya tasarımı.
