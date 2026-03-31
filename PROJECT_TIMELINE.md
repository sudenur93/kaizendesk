# KaizenDesk — zaman çizelgesi (Haziran 1, 2026)

Bugün referans: **29 Mart 2026**. Bitiş: **1 Haziran 2026** (~9 hafta).

Bu dosya, paylaşılan **KaizenDesk (Toyota) analiz dokümanı** ve üniversite teknik gereksinimleriyle hizalıdır. Haftalık ilerlemeyi burada işaretle.

---

## Analiz dokümanından çıkan “kilit kurallar” (backend/ürün)

| Konu | Kural |
|------|--------|
| Statü sırası | **New → In Progress → Waiting for Customer → Resolved → Closed** (workflow dışı geçiş yok) |
| Yeni ticket | **New** ile başlar; benzersiz ticket no |
| Atama | Personele atanınca (veya üzerine alınca) **In Progress**’e geçiş — dokümanda manuel atama |
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
| Üniversite rubriği | React web + (ders **React Native** isterse ayrı değerlendir); CI/CD “basit tasarım” analizde kapsam dışı sayılabilir — mevcut GitHub CI yine artıdır |

---

## Hafta 1 — 30 Mart – 5 Nisan 2026

**Odak:** API sözleşmesi + güvenlik + ticket omurgası + analizdeki ürün/kategori ağacı

- [ ] Global exception handling + standart JSON hata gövdesi (`ControllerAdvice`)
- [ ] Rol kuralları: müşteri **yalnızca kendi** ticket’ları; destek **yetkisi/atanan** (tercihen: destek = atanan + atanmamış havuz veya hepsi — tek karar ver); yönetici genel erişim
- [ ] Yorum yazar: JWT’den kullanıcı (`CommentService` sabit user id kaldır)
- [ ] Ticket oluşturma: ürün / kategori / **çoklu** sorun tipi; oluşturulunca statü **NEW** (mevcut `OPEN` ile çakışıyorsa migration’da birleştir)
- [ ] Flyway seed veya migration: analizdeki 4 ana sistem + “Diğer” ve her biri için sorun tipi listeleri (minimal: isimler dokümandaki gibi)

### Hafta 1 — günlük parçalar (her gün ~30–60 dk)

| Gün | Ne yapıyorsun? (küçük, bitirilebilir) |
|-----|----------------------------------------|
| **1** | **Hata JSON’u:** `GlobalExceptionHandler` + `ErrorResponse` zaten var → API’yi çalıştır, token ile **geçersiz body** gönder (ör. `POST /api/v1/tickets` boş `title`). Yanıtta `status`, `error`, `fieldErrors` olduğunu doğrula. İstersen `GET /api/v1/tickets/99999` ile 404 JSON’una bak. |
| **2** | **Yorum yazarı:** `CommentService` içindeki `findById(1L)` kalksın; `CommentController` JWT’den `preferred_username` alıp servise iletsin; yazar `userRepository.findByUsername` ile bulunsun. |
| **3** | **Müşteri ticket sınırı:** `GET /api/v1/tickets` ve `GET /api/v1/tickets/{id}` için `CUSTOMER` rolünde sadece **kendi oluşturduğu** kayıtlar; başkasının detayı **403** (veya 404 — ekip kararı). `AGENT`/`MANAGER` şimdilik hepsini görsün. |
| **4** | **Ticket isteği + DB:** `CreateTicketRequest`’e `productId`, `categoryId`, `issueTypeIds` (liste) ekle; kayıtta `tickets` + `ticket_issue_types` doldurulsun (şema uyumlu). Statüyü bir sonraki haftaya bırakabilirsin; bugün sadece alanlar + FK. |
| **5** | **Seed:** Yeni Flyway migration: 4 ana ürün/hat + “Diğer”, her biri için `categories` / `issue_types` ve analizdeki metinlerle birkaç sorun tipi (tamamını yazmak zorunda değilsin, örnek 2’şer satır yeter). |

**Bugün (Gün 1):** Kod yazmadan da bitebilir: sadece **5–10 dakikalık doğrulama** — geçersiz istek at, dönen JSON’un tek formatta olduğunu not al. Yarın Gün 2’ye geç.

## Hafta 2 — 6 – 12 Nisan 2026

**Odak:** Yaşam döngüsü + iletişim + atama kuralları

- [ ] Flyway + enum: **NEW**, **WAITING_FOR_CUSTOMER**, **RESOLVED**, **CLOSED** — mevcut şema ile uyum; geçiş matrisi serviste
- [ ] İç / dış yorum veya müşteriye görünen iletişim + (isteğe bağlı) dahili not — destek detayına uyum
- [ ] **Atama** endpoint: atama sonrası uygunsa **New → In Progress** (analiz 4.2)
- [ ] Resolved: `resolution_note` zorunluluğu; Closed: müşteri rolü engeli

## Hafta 3 — 13 – 19 Nisan 2026

**Odak:** Ekler + worklog + bildirim + SLA işaretleme

- [ ] `AttachmentService`: kalıcı saklama, liste, indirme; **izin verilen MIME / uzantı** (txt, docx, xlsx, pdf, png, jpeg) + boyut sınırı
- [ ] `WorklogService`: kalıcı kayıt, liste; yazar JWT; **güncelleme/silme yok**
- [ ] `NotificationService`: ticket oluşturma / statü / SLA riski kayıtları
- [ ] SLA: ihlal bayrağı / hedef; listede “risk/ihlal” için veri

## Hafta 4 — 20 – 26 Nisan 2026

**Odak:** Listeler + raporlama API (mockup / analiz 3.4)

- [ ] Ticket liste: sıralama (öncelik desc, tarih desc); filtreler; **arama** (id, başlık, ürün adı, atanan — mümkün olan alanlarda)
- [ ] Yönetici özet: açık dağılım, günlük kapanan, SLA ihlali, ort. çözüm süresi
- [ ] Trend / öncelik / sistem-kırılımı için aggregation endpoint’leri
- [ ] Ajan performans tablosu verisi
- [ ] `API_ENDPOINTS.md` + örnek body’ler

## Hafta 5 — 27 Nisan – 3 Mayıs 2026

**Odak:** jBPM + süreç dokümantasyonu

- [ ] BPMN: ticket başına process instance; statü geçişleri süreçle hizalı (minimum entegrasyon veya tasarım + kayıt)
- [ ] Ticket kapanınca süreç sonlandırma (hedef)
- [ ] Kısa mimari: Docker, Keycloak, log/trace

## Hafta 6 — 4 – 10 Mayıs 2026

**Odak:** Backend sertleştirme + React başlangıcı

- [ ] Kritik uçlar için ek testler; müşteri/dstek ayrımı regresyon
- [ ] React: proje, router, layout, Keycloak, `/me` — **rol portal otomatik** (mockuptaki “rol seçimi” yerine JWT rolü)
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

## Bu hafta (Hafta 1) kısa özet

**Standart hatalar + müşteri veri sınırı + yorum yazarı + ticket (NEW + ürün/kategori/çoklu sorun tipi + dokümandaki seed veri).**
