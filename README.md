# KaizenDesk — Helpdesk & Ticket Yönetim Sistemi

KaizenDesk, şirketlerin müşteri destek taleplerini uçtan uca yönetmesini sağlayan modern bir helpdesk platformudur. Müşteriler destek talebi oluşturur, ajanlar talepleri çözer, yöneticiler süreci takip eder.

---

## 🎯 Ne İşe Yarar?

- Müşteri bir sorun yaşadığında sisteme **destek talebi** açar
- Yönetici talebi uygun **ajana atar**
- Ajan talebi inceler, gerekirse müşteriden bilgi ister ve çözer
- Her adımda ilgili kişilere **e-posta bildirimi** gider
- **SLA (hizmet süresi)** takibi yapılır — süre dolmak üzereyse veya dolmuşsa uyarı gönderilir
- Tüm süreç **BPMN iş akışı** (jBPM 10 / Kogito) üzerinden yönetilir

---

## ✨ Özellikler

| Özellik | Açıklama |
|---|---|
| 🎫 Ticket Yönetimi | Oluşturma, atama, durum takibi, kapatma |
| 👥 3 Farklı Rol | Müşteri, Ajan, Yönetici |
| ⏱️ SLA Takibi | Önceliğe göre çözüm süresi, ihlal uyarısı |
| 📧 E-posta Bildirimleri | Her durum değişikliğinde otomatik mail |
| 📎 Dosya Ekleri | Ticket'a dosya yükleme |
| 💬 Yorumlar & İç Notlar | Müşteriye görünmeyen dahili notlar |
| ⏳ Worklog | Harcanan süre kaydı |
| 🤖 AI Asistan | Gemini ile akıllı destek |
| 📊 Dashboard | Özet istatistikler ve grafikler |
| 🔄 BPMN İş Akışı | jBPM 10 (Kogito) ile ticket yaşam döngüsü |
| 🔍 Gözlemlenebilirlik | Prometheus, Jaeger, OpenSearch ile izleme |
| 🌙 Dark/Light Tema | Tam tema desteği |

---

## 🛠️ Teknoloji Yığını

### Backend
- **Java 21** + **Spring Boot 3.4**
- **PostgreSQL 16** — veritabanı
- **Keycloak** — kimlik doğrulama (OAuth2/JWT)
- **jBPM 10 / Apache KIE (Kogito)** — BPMN iş akışı motoru
- **Flyway** — veritabanı migrasyon
- **OpenTelemetry** — dağıtık izleme

### Frontend
- **React 19** + **Vite**
- **Axios** — API iletişimi

### Altyapı
- **Docker Compose** — tüm servisler konteynerize
- **OpenLDAP** — kullanıcı dizini
- **OpenSearch** — log yönetimi
- **Jaeger** — dağıtık izleme
- **Fluent Bit** — log toplama

---

## 🏗️ Mimari

```
┌─────────────────────────────────────────────────────────┐
│                      Kullanıcı                           │
│              React 19 + Vite (port 3000)                 │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTP
┌─────────────────────────▼───────────────────────────────┐
│              Spring Boot API (port 8080)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Ticket   │  │ Comment  │  │Attachment│  │  User   │ │
│  │ Service  │  │ Service  │  │ Service  │  │ Service │ │
│  └────┬─────┘  └──────────┘  └──────────┘  └─────────┘ │
│       │                                                   │
│  ┌────▼──────────────┐  ┌──────────────────────────────┐│
│  │TicketWorkflowSvc  │  │   TicketNotificationService  ││
│  │  (jBPM/Kogito)    │  │   (E-posta + Bildirim)       ││
│  └───────────────────┘  └──────────────────────────────┘│
└──────────┬──────────────────────────┬────────────────────┘
           │                          │
┌──────────▼──────────┐  ┌───────────▼────────────────────┐
│   PostgreSQL 16      │  │         Keycloak               │
│   (Veritabanı)       │  │   (Kimlik Doğrulama/JWT)       │
└─────────────────────┘  └────────────────────────────────┘
```

### Ticket Yaşam Döngüsü (BPMN)

```
Oluşturuldu → SLA Hesapla → Atama Bekliyor (Manager)
    → İnceleniyor (Agent) → [Ek Bilgi Gerekiyor?]
        ├─ EVET → Müşteriden Bilgi İste → Müşteri Yanıtladı → İnceleniyor
        └─ HAYIR → Çözüldü → Kapatıldı
```

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler

Bilgisayarınızda şunların kurulu olması gerekiyor:

| Araç | Versiyon | İndirme |
|---|---|---|
| Docker Desktop | Son sürüm | [docker.com](https://www.docker.com/products/docker-desktop/) |
| Git | Son sürüm | [git-scm.com](https://git-scm.com) |

> **Not:** Java, Node.js veya başka bir şey kurmanıza gerek yok. Docker her şeyi halleder.

---

### Adım 1 — Projeyi İndirin

Terminal (Mac: Terminal uygulaması, Windows: Command Prompt) açın ve şunu yazın:

```bash
git clone https://github.com/sudenur93/kaizendesk.git
cd kaizendesk
```

---

### Adım 2 — Docker Desktop'ı Başlatın

Docker Desktop uygulamasını açın ve sol altta yeşil "Engine running" yazısını görene kadar bekleyin.

---

### Adım 3 — Uygulamayı Başlatın

```bash
docker-compose up -d
```

Bu komut tüm servisleri arka planda başlatır. İlk seferde Docker imajlarını indireceği için **5-10 dakika** sürebilir.

Servislerin hazır olup olmadığını kontrol etmek için:

```bash
docker-compose ps
```

Tüm servisler `running` veya `healthy` görünüyorsa hazırsınız.

---

### Adım 4 — Siteye Girin

Tarayıcınızda şu adresi açın:

```
http://localhost:3000
```

---

## 👤 Demo Kullanıcıları

Sisteme girmek için Keycloak'ta tanımlı kullanıcıları kullanın:

| Kullanıcı | Şifre | Rol |
|---|---|---|
| `customer1` | `customer123` | Müşteri |
| `agent1` | `agent123` | Ajan |
| `manager` | `manager123` | Yönetici |

---

## 🔧 Yapılandırma (İsteğe Bağlı)

### E-posta Gönderimi

Gerçek e-posta göndermek için `.env` dosyası oluşturun:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=mailiniz@gmail.com
SMTP_PASSWORD=google-app-sifresi
SMTP_FROM=no-reply@kaizendesk.com
```

> Gmail kullanıyorsanız: Google Hesabı → Güvenlik → Uygulama Şifreleri → Yeni şifre oluştur

### AI Asistan

Gemini AI asistanı aktif etmek için:

```env
GEMINI_API_KEY=your-api-key
```

---

## 📡 Servis Adresleri

| Servis | Adres | Açıklama |
|---|---|---|
| 🌐 Frontend | http://localhost:3000 | Ana uygulama |
| 🔐 Keycloak | http://localhost:8081 | Kimlik yönetimi (admin/admin) |
| 📊 OpenSearch | http://localhost:5601 | Log dashboard |
| 🔍 Jaeger | http://localhost:16686 | Dağıtık izleme |
| 📈 Grafana | http://localhost:3001 | Metrik dashboard (admin/admin) |
| 🎯 Prometheus | http://localhost:9090 | Metrik toplama |
| 🗄️ API | http://localhost:8080 | REST API |
| 📖 Swagger UI | http://localhost:8080/swagger-ui.html | API dokümantasyonu |

---

## 🛑 Durdurma

```bash
docker-compose down
```

Verileri de silmek için:

```bash
docker-compose down -v
```

---

## 📁 Proje Yapısı

```
kaizendesk/
├── src/
│   ├── main/java/com/sau/kaizendesk/
│   │   ├── controller/      # REST API endpoint'leri
│   │   ├── service/         # İş mantığı
│   │   ├── domain/          # Veritabanı entity'leri
│   │   ├── dto/             # İstek/yanıt objeleri
│   │   ├── repository/      # Veritabanı sorguları
│   │   ├── workflow/        # jBPM iş akışı
│   │   └── config/          # Yapılandırma
│   └── main/resources/
│       ├── ticketFlow.bpmn2 # BPMN süreç tanımı
│       └── db/migration/    # Veritabanı migrasyon dosyaları
├── frontend/
│   └── src/
│       ├── pages/           # Sayfa bileşenleri (Customer/Agent/Manager)
│       ├── components/      # Paylaşılan UI bileşenleri
│       └── services/        # API çağrıları
├── docker/                  # Servis yapılandırmaları
└── docker-compose.yml       # Tüm servis tanımları
```

---

## 🧪 Testleri Çalıştırma

```bash
./mvnw test
```

---

## 📚 Javadoc Üretme

Kod dokümantasyonunu HTML olarak üretmek için:

```bash
./mvnw javadoc:javadoc
```

Üretilen doküman: `target/site/apidocs/index.html`

---

## 📄 Lisans

Bu proje SAÜ Bilgisayar Mühendisliği kapsamında geliştirilmiştir.
