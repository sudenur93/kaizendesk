# KaizenDesk — manuel test planı

Bu liste CI’ın kapsamadığı uçtan uca senaryolar içindir (`mvn verify` yalnızca Spring bağlamı + Flyway + Testcontainers PostgreSQL ile smoke test yapar).

**Yerel:** `mvn verify` çalıştırmak için Docker’ın açık (duraklatılmamış) olması gerekir; GitHub Actions’ta Docker varsayılan olarak kullanılabilir.

## Önkoşullar

- `docker compose up -d` ile API, PostgreSQL, Keycloak ve isteğe bağlı gözlemlenebilirlik stack’i ayağa kalkmış olmalı.
- Keycloak’ta realm `kaizendesk`, roller ve test kullanıcıları (`CUSTOMER` / `AGENT` / `MANAGER`) tanımlı; kullanıcı profili doğrudan grant için gerekli alanları içeriyor olmalı.

## 1. Kimlik doğrulama ve yetki

1. Token al (password grant veya UI): realm ve client ayarlarına uygun istek.
2. **CUSTOMER** ile korumalı bir uç çağrısı: beklenen davranışa göre 200 veya 403.
3. **AGENT** ile yönetim uçları (ör. `dashboard/summary`): 403 beklenir.
4. **MANAGER** ile aynı uç: 200 beklenir.
5. Geçersiz veya süresi dolmuş token: 401.

## 2. Kullanıcı senkronu

1. İlk kez giriş yapan kullanıcı için `/me` (veya eşdeğer) çağrısı.
2. Veritabanında `users` tablosunda kaydın oluştuğunu ve rolün JWT `realm_access.roles` ile uyumlu olduğunu doğrula.

## 3. Ticket akışı

1. Ticket oluştur: `ticket_no` dolu ve benzersiz.
2. Listeleme / detay / güncelleme (proje API’sine göre).
3. İsteğe bağlı: yorum, worklog, ek — ilgili Flyway şeması ve uçlarla uyumlu.

## 4. Sağlık ve gözlemlenebilirlik

1. `GET /actuator/health` (ve docker içinde probes).
2. Prometheus metrikleri açıksa scrape doğrula.
3. Istek sırasında Jaeger/OpenSearch tarafında iz/log beklentisi varsa manuel kontrol.

## 5. Regresyon notları

- Flyway migration’ları yalnızca PostgreSQL 16 ile CI’da koşuyor; yerelde farklı majör sürüm kullanmaktan kaçın.
- Ana `application.yml` içindeki `jwk-set-uri` container ortamında Keycloak servis adı içerir; host’tan çalışan testler için profil veya env ile override gerekir.
