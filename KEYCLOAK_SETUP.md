# KaizenDesk – Keycloak Kurulumu (Dev)

Bu doküman, Keycloak ile Spring Boot API arasında JWT tabanlı kimlik doğrulama ve rol bazlı yetkilendirme akışını özetler.

## 1) Genel akış
- Kullanıcı Keycloak üzerinden login olur ve **Access Token (JWT)** alır.
- Frontend/Mobil uygulama API çağrılarında token’ı gönderir:
  - `Authorization: Bearer <ACCESS_TOKEN>`
- Spring Boot, `issuer-uri` üzerinden token’ı doğrular ve `@PreAuthorize` ile rol kontrollerini yapar.

## 2) Spring Boot ayarı
`src/main/resources/application.yml` içinde issuer:
- `spring.security.oauth2.resourceserver.jwt.issuer-uri: http://keycloak:8080/realms/kaizendesk`

> Docker Compose ağında backend, Keycloak’a `http://keycloak:8080` host adıyla erişir.

## 3) Realm / Roller
1. Keycloak’ta realm oluştur:
   - **Realm**: `kaizendesk`

2. Realm rollerini oluştur:
   - `CUSTOMER`
   - `AGENT`
   - `MANAGER`

3. Test kullanıcıları oluştur ve rollerini ata (örnek):
   - `alice` → `CUSTOMER`
   - `bob` → `AGENT`
   - `carol` → `MANAGER`

## 4) Token içindeki rol claim’i
Keycloak realm rolleri JWT’de genellikle şu claim altında gelir:
- `realm_access.roles`

Spring tarafında roller `ROLE_...` formatına map edilerek `@PreAuthorize("hasRole('MANAGER')")` gibi kontroller çalışır.

Örnek JWT payload kesiti:

```json
{
  "preferred_username": "alice",
  "realm_access": {
    "roles": ["CUSTOMER"]
  }
}
```

## 5) Hızlı test (local)
1. Compose ile ortamı kaldır:
   - `docker compose up -d`

2. Keycloak UI:
   - `http://localhost:8081`

3. JWT aldıktan sonra API çağır:

```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:8080/api/v1/users/me
```

## 6) Endpoint rol örnekleri
- `GET /api/v1/users/me` → `CUSTOMER|AGENT|MANAGER`
- `GET /api/v1/dashboard/summary` → `MANAGER`
- `PATCH /api/v1/tickets/{id}/status` → `AGENT|MANAGER`

