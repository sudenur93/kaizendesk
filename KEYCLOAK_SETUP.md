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

## 5) Client oluşturma (cURL / Postman ile token için şart)

Realm **kaizendesk** → **Clients** → **Create client**:

1. **Client ID:** örn. `kaizendesk-app` (bundan sonra curl’de bunu kullanacaksın).
2. **Client authentication:** geliştirme kolaylığı için **Off** (public client) — böylece `client_secret` gerekmez.  
   Üretimde genelde **On** olur; o zaman aşağıdaki curl’e `client_secret` eklenir (**Credentials** sekmesinden kopyala).
3. **Capability config** (veya Login settings): **Direct access grants** = **ON** (password grant için zorunlu).
4. Kaydet.

> Placeholder `BURAYA_CLIENT_ID` ile istek atarsan Keycloak **`invalid_client`** döner.

## 5b) cURL ile access token (password grant)

Gerçek kullanıcı ve client id ile:

```bash
curl -s -X POST 'http://localhost:8081/realms/kaizendesk/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=password' \
  -d 'client_id=kaizendesk-app' \
  -d 'username=alice' \
  -d 'password=SENIN_SIFREN'
```

Client **confidential** ise:

```bash
  -d 'client_secret=CLIENT_CREDENTIALS_SEKMESINDEKI_SECRET'
```

Yanıtta `access_token` gelmeli. `invalid_grant` → kullanıcı/şifre veya kullanıcı profil zorunlu alanları; `unauthorized_client` → Direct access grants kapalı.

### `invalid_grant` — "Account is not fully set up"

Bu hata genelde şunlardan biridir:

1. **Zorunlu kullanıcı alanları boş**  
   **Users** → kullanıcı → **Details:** **First name**, **Last name**, **Email** doldur → **Save**.

2. **Bekleyen “Required actions”**  
   Aynı kullanıcıda **Login** sekmesinde **Required user actions** listesinde *Update Password*, *Update Profile*, *Verify Email* vb. varsa kaldır veya kullanıcı bir kez Keycloak hesap konsolundan tamamlasın.  
   Dev için: eylemleri temizleyip şifreyi **Credentials**’tan yeniden **non-temporary** olarak kaydet.

3. **Realm User Profile’da zorunlu attribute**  
   **Realm settings** → **User profile** (veya **Attributes**): `firstName` / `lastName` zorunluysa tüm test kullanıcılarında doldurulmalı.

Düzelttikten sonra token isteğini tekrarla.

## 6) Hızlı test (local)
1. Compose ile ortamı kaldır:
   - `docker compose up -d`

2. Keycloak UI:
   - `http://localhost:8081`

3. JWT aldıktan sonra API çağır:

```bash
curl -H "Authorization: Bearer <TOKEN>" http://localhost:8080/api/v1/users/me
```

## 7) Endpoint rol örnekleri
- `GET /api/v1/users/me` → `CUSTOMER|AGENT|MANAGER`
- `GET /api/v1/dashboard/summary` → `MANAGER`
- `PATCH /api/v1/tickets/{id}/status` → `AGENT|MANAGER`

