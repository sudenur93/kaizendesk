# KaizenDesk API Endpoint Listesi

| # | HTTP Method | Path                                           | Açıklama                                              | Roller                             | Kimlik Doğrulama |
|---|-------------|------------------------------------------------|-------------------------------------------------------|------------------------------------|------------------|
| 1 | GET         | `/api/v1/users/me`                            | Kimliği doğrulanmış kullanıcının profilini getirir.  | `CUSTOMER`, `AGENT`, `MANAGER`    | JWT (Keycloak)   |
| 2 | POST        | `/api/v1/tickets`                             | Yeni destek talebi (ticket) oluşturur.               | `CUSTOMER`, `AGENT`, `MANAGER`    | JWT (Keycloak)   |
| 3 | GET         | `/api/v1/tickets`                             | Tüm ticket’ları durum/öncelik/atanan filtreleriyle listeler. | `CUSTOMER`, `AGENT`, `MANAGER` | JWT (Keycloak)   |
| 4 | GET         | `/api/v1/tickets/{id}`                        | Belirli bir ticket’ın detayını getirir.              | `CUSTOMER`, `AGENT`, `MANAGER`    | JWT (Keycloak)   |
| 5 | PATCH       | `/api/v1/tickets/{id}/status`                 | Ticket durumunu günceller (OPEN, IN_PROGRESS, CLOSED vb.). | `AGENT`, `MANAGER`          | JWT (Keycloak)   |
| 6 | PATCH       | `/api/v1/tickets/{id}/assign`                 | Ticket’ı bir agenta atar.                            | `AGENT`, `MANAGER`                | JWT (Keycloak)   |
| 7 | POST        | `/api/v1/tickets/{ticketId}/comments`         | Ticket’a yorum ekler.                                | `CUSTOMER`, `AGENT`, `MANAGER`    | JWT (Keycloak)   |
| 8 | GET         | `/api/v1/tickets/{ticketId}/comments`         | Ticket’a ait tüm yorumları listeler.                 | `CUSTOMER`, `AGENT`, `MANAGER`    | JWT (Keycloak)   |
| 9 | POST        | `/api/v1/tickets/{ticketId}/worklogs`         | Ticket’a worklog (zaman kaydı) ekler.                | `AGENT`, `MANAGER`                | JWT (Keycloak)   |
|10 | GET         | `/api/v1/tickets/{ticketId}/worklogs`         | Ticket’ın tüm worklog kayıtlarını listeler.          | `AGENT`, `MANAGER`                | JWT (Keycloak)   |
|11 | POST        | `/api/v1/tickets/{ticketId}/attachments`      | Ticket’a dosya eki yükler.                           | `CUSTOMER`, `AGENT`, `MANAGER`    | JWT (Keycloak)   |
|12 | GET         | `/api/v1/tickets/{ticketId}/attachments`      | Ticket’a ait dosya eklerini listeler.                | `CUSTOMER`, `AGENT`, `MANAGER`    | JWT (Keycloak)   |
|13 | GET         | `/api/v1/notifications`                       | Mevcut kullanıcının bildirimlerini listeler.         | `CUSTOMER`, `AGENT`, `MANAGER`    | JWT (Keycloak)   |
|14 | GET         | `/api/v1/dashboard/summary`                   | Yönetici paneli için özet metrik/KPI bilgilerini getirir. | `MANAGER`                     | JWT (Keycloak)   |

> Not: Tüm endpoint’ler için istekler HTTPS üzerinden ve `Authorization: Bearer <JWT>` başlığı ile çağrılmalıdır. Roller, Keycloak realm rollerinden `ROLE_XXX` formatına map edilen Spring Security yetkileriyle kontrol edilir.

