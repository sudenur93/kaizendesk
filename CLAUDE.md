# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

KaizenDesk is a helpdesk/ticketing platform with a Spring Boot 3.4 backend (Java 21) and a React 19 + Vite frontend. Authentication is delegated to Keycloak (OAuth2/JWT). The full infrastructure runs via Docker Compose.

---

## Commands

### Backend (Maven)

```bash
# Run all tests
./mvnw test

# Run a single test class
./mvnw test -Dtest=AttachmentServiceTest

# Run a single test method
./mvnw test -Dtest=AttachmentServiceTest#someMethod

# Build (skip tests)
./mvnw package -DskipTests

# Start locally (requires Docker infra running; uses application-local.yml)
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

### Frontend

```bash
cd frontend
npm install
npm run dev      # dev server at http://localhost:5173
npm run build
npm run lint
```

### Infrastructure (Docker Compose)

```bash
# Start all services (postgres, keycloak, opensearch, mailhog, jaeger, etc.)
docker-compose up -d

# Start only infra (no app containers)
docker-compose up -d postgres keycloak openldap mailhog opensearch otel-collector jaeger

# Full stack including built app images
docker-compose up --build
```

---

## Architecture

### Backend package layout (`src/main/java/com/sau/kaizendesk/`)

| Package | Purpose |
|---|---|
| `domain/entity` | JPA entities (`Ticket`, `User`, `Attachment`, `Comment`, `Worklog`, `SlaPolicy`, …) |
| `domain/enums` | `TicketStatus`, `TicketPriority`, `UserRole` |
| `dto` | Request/response DTOs (no business logic) |
| `repository` | Spring Data JPA repositories |
| `service` | Business logic; `TicketService`, `AttachmentService`, `CommentService`, etc. |
| `controller` | REST controllers under `/api/v1/` |
| `workflow` | Flowable BPMN delegates (`SlaCalculationDelegate`, `SlaBreachDelegate`, `TicketCloseDelegate`) |
| `config` | `SecurityConfig` (JWT converter), `AttachmentStorageProperties` |
| `security` | `JwtRealmRoles` helper — extracts Keycloak realm roles from the JWT |
| `web` | `GlobalExceptionHandler` |

### Authentication / authorization

- Keycloak issues JWTs. The backend is a pure OAuth2 resource server — no session, no form login.
- Roles come from `realm_access.roles` in the JWT and are mapped to Spring Security `ROLE_CUSTOMER`, `ROLE_AGENT`, `ROLE_MANAGER`.
- Controllers use `@PreAuthorize("hasAnyRole(...)")` for coarse-grained access; `TicketAccessService` enforces row-level "customer can only see their own tickets" logic.
- `JwtRealmRoles.isCustomer(jwt)` is the shared helper used in every controller to decide customer vs. staff path.

### Ticket lifecycle (Flowable BPMN)

Each ticket starts a `ticketFlow` process instance (`ticket-flow.bpmn20.xml`). The process:
1. `SlaCalculationDelegate` — calculates and persists the SLA deadline.
2. `waitInProgress` receive task — waits until the ticket is resolved/closed.
3. `SlaBreachDelegate` — fires if the SLA timer elapses before resolution.
4. `TicketCloseDelegate` — runs post-close cleanup.

`TicketWorkflowService` wraps all Flowable API calls so services never import Flowable directly.

### Database migrations

Flyway manages schema under `src/main/resources/db/migration/`. Flowable creates its own `ACT_*` tables via `flowable.database-schema-update: true`. The `application-local.yml` profile connects to `localhost:5433` (the Docker-mapped Postgres port).

### Attachment storage

Files are stored on disk (not in the DB). The path is controlled by `kaizendesk.attachments.directory` (`./data/attachments` locally, `/var/lib/kaizendesk/attachments` in Docker). `AttachmentFileStorage` handles read/write; `AttachmentMimeRules` validates MIME type and size; filenames are stored as UUIDs to avoid collisions.

### Observability stack

- **Metrics**: Micrometer → Prometheus (scraped at `/actuator/prometheus`)
- **Traces**: OpenTelemetry SDK → otel-collector → Jaeger (UI at `localhost:16686`)
- **Logs**: Log4j2 JSON → file → Fluent Bit → OpenSearch (dashboards at `localhost:5601`)

### Frontend (`frontend/src/`)

- `pages/` — one file per role-prefixed route (`Customer*`, `Agent*`, `Manager*`)
- `components/` — shared UI (`Sidebar`, `Topbar`, `TicketDrawer`, `AiChatWidget`)
- `services/api.js` — all Axios calls; Vite proxies `/api` → `http://localhost:8080` and `/auth` → `http://localhost:8081`

### Local vs. Docker ports

| Service | Docker host port | Local dev |
|---|---|---|
| API | 8080 | 8082 (`application-local.yml`) |
| Keycloak | 8081 | 8081 |
| Postgres | 5433 | 5433 |
| MailHog UI | 8025 | 8025 |
| Jaeger UI | 16686 | 16686 |
| OpenSearch UI | 5601 | 5601 |

> **Note**: The Vite proxy points `/api` to `localhost:8080`. When running the backend natively with `-Dspring-boot.run.profiles=local` (port 8082), update the Vite proxy target accordingly.
