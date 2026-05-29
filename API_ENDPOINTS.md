# KaizenDesk API Endpoint Listesi

Tüm endpoint'ler `Authorization: Bearer <JWT>` başlığı gerektirir. Roller, Keycloak realm rollerinden `ROLE_XXX` formatına map edilen Spring Security yetkileriyle kontrol edilir.

---

## 1. Kullanıcı

| # | Method | Path | Açıklama | Roller |
|---|--------|------|----------|--------|
| 1 | GET | `/api/v1/users/me` | Kimliği doğrulanmış kullanıcının profilini getirir. | CUSTOMER, AGENT, MANAGER |

---

## 2. Ticket İşlemleri

| # | Method | Path | Açıklama | Roller |
|---|--------|------|----------|--------|
| 2 | POST | `/api/v1/tickets` | Yeni destek talebi oluşturur. | CUSTOMER, AGENT, MANAGER |
| 3 | GET | `/api/v1/tickets` | Ticket listesi. Filtreler: `status`, `priority`, `assignedTo`, `q` (arama). | CUSTOMER, AGENT, MANAGER |
| 4 | GET | `/api/v1/tickets/{id}` | Ticket detayı. | CUSTOMER, AGENT, MANAGER |
| 5 | PATCH | `/api/v1/tickets/{id}/status` | Statü güncelleme. RESOLVED için `resolutionNote` zorunlu. | AGENT, MANAGER |
| 6 | PATCH | `/api/v1/tickets/{id}/assign` | Ticket'ı bir ajana atar; NEW ise IN_PROGRESS'e geçer. | AGENT, MANAGER |

### Statü geçiş kuralları

```
NEW → IN_PROGRESS → WAITING_FOR_CUSTOMER → RESOLVED → CLOSED
                  ↘ RESOLVED ↗
```

### Örnek body'ler

**POST `/api/v1/tickets`**
```json
{
  "title": "ERP sipariş modülü hata veriyor",
  "description": "Sipariş oluştururken 500 hatası alıyorum.",
  "priority": "HIGH",
  "productId": 1,
  "categoryId": 2,
  "issueTypeIds": [10, 11]
}
```

**PATCH `/api/v1/tickets/{id}/status`**
```json
{
  "status": "RESOLVED",
  "resolutionNote": "Cache temizlenerek çözüldü."
}
```

**PATCH `/api/v1/tickets/{id}/assign`**
```json
{
  "agentId": 5
}
```

**GET `/api/v1/tickets?status=IN_PROGRESS&priority=HIGH&q=sipariş`**
> Filtreler opsiyoneldir; `q` ticket no, başlık, ürün adı veya atanmış ajan kullanıcı adında arama yapar.

---

## 3. Yorum

| # | Method | Path | Açıklama | Roller |
|---|--------|------|----------|--------|
| 7 | POST | `/api/v1/tickets/{ticketId}/comments` | Ticket'a yorum ekler. | CUSTOMER, AGENT, MANAGER |
| 8 | GET | `/api/v1/tickets/{ticketId}/comments` | Ticket'ın yorumlarını listeler. | CUSTOMER, AGENT, MANAGER |

**POST `/api/v1/tickets/{ticketId}/comments`**
```json
{
  "content": "Ekran görüntüsünü ekte paylaştım."
}
```

---

## 4. Worklog (Zaman Kaydı)

| # | Method | Path | Açıklama | Roller |
|---|--------|------|----------|--------|
| 9 | POST | `/api/v1/tickets/{ticketId}/worklogs` | Worklog ekler. Kayıtlar değiştirilemez. | AGENT, MANAGER |
| 10 | GET | `/api/v1/tickets/{ticketId}/worklogs` | Worklog listesi. | AGENT, MANAGER |

**POST `/api/v1/tickets/{ticketId}/worklogs`**
```json
{
  "timeSpent": 45,
  "workDate": "2026-04-14",
  "note": "Log analizi yapıldı."
}
```

---

## 5. Ek Dosya (Attachment)

| # | Method | Path | Açıklama | Roller |
|---|--------|------|----------|--------|
| 11 | POST | `/api/v1/tickets/{ticketId}/attachments` | Dosya yükler (`multipart/form-data`, alan: `file`). | CUSTOMER, AGENT, MANAGER |
| 12 | GET | `/api/v1/tickets/{ticketId}/attachments` | Ek dosya listesi. | CUSTOMER, AGENT, MANAGER |
| 13 | GET | `/api/v1/tickets/{ticketId}/attachments/{id}/file` | Dosya indirme. | CUSTOMER, AGENT, MANAGER |

> İzin verilen uzantılar: `txt, docx, xlsx, pdf, png, jpeg, jpg`. Maks boyut `application.yml` ile ayarlanır.

---

## 6. Bildirim

| # | Method | Path | Açıklama | Roller |
|---|--------|------|----------|--------|
| 14 | GET | `/api/v1/notifications` | Kullanıcının bildirimlerini listeler. | CUSTOMER, AGENT, MANAGER |

> Bildirimler otomatik oluşur: ticket oluşturma, statü değişimi, atama, SLA risk / ihlal.

---

## 7. Dashboard (Yönetici Paneli)

| # | Method | Path | Açıklama | Roller |
|---|--------|------|----------|--------|
| 15 | GET | `/api/v1/dashboard/summary` | Özet KPI: statü/öncelik/ürün dağılımı, SLA ihlali, bugün kapanan, ort. çözüm süresi, ajan performansı. | MANAGER |

**Örnek yanıt:**
```json
{
  "totalTickets": 42,
  "openTickets": 8,
  "inProgressTickets": 12,
  "waitingForCustomerTickets": 3,
  "resolvedTickets": 14,
  "closedTickets": 5,
  "slaBreachedCount": 2,
  "closedToday": 1,
  "avgResolutionMinutes": 135,
  "statusCounts": {
    "NEW": 8, "IN_PROGRESS": 12, "WAITING_FOR_CUSTOMER": 3,
    "RESOLVED": 14, "CLOSED": 5
  },
  "priorityCounts": { "HIGH": 10, "MEDIUM": 22, "LOW": 10 },
  "productCounts": { "ERP Sistemi": 18, "CRM Yazılımı": 14, "Muhasebe": 10 },
  "agentPerformances": [
    {
      "agentId": 5,
      "agentName": "Ahmet Yılmaz",
      "assignedCount": 15,
      "resolvedCount": 10,
      "closedCount": 4,
      "avgResolutionMinutes": 120
    }
  ]
}
```

---

## 8. Katalog (Ürün / Kategori / Sorun Tipi)

| # | Method | Path | Açıklama | Roller |
|---|--------|------|----------|--------|
| 16 | GET | `/api/v1/products` | Aktif ürünleri listeler. | CUSTOMER, AGENT, MANAGER |
| 17 | GET | `/api/v1/products/{productId}/categories` | Ürüne ait kategorileri listeler. | CUSTOMER, AGENT, MANAGER |
| 18 | GET | `/api/v1/categories/{categoryId}/issue-types` | Kategoriye ait aktif sorun tiplerini listeler. | CUSTOMER, AGENT, MANAGER |

> Ticket oluştururken cascade: önce ürün seç → kategoriler gelir → sorun tipleri gelir.
