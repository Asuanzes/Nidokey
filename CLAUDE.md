# Onboarding prompt — BuySell Asturias

> Pega este bloque al inicio de una sesión nueva de Claude Code (o cópialo en
> `CLAUDE.md` para que se cargue automáticamente). Está condensado desde
> `docs/blitzy-tech-spec.md` (tech-spec auto-generada) y `docs/ROADMAP.md`.
> Después puedes pedir tareas concretas; este brief le da contexto suficiente
> para no preguntar lo básico.

---

## 1. Qué es el proyecto

BuySell Asturias es una **plataforma personal de inteligencia inmobiliaria** que
consolida anuncios de varios portales españoles en un catálogo único del
propietario. Da: histórico de precios, deduplicación automática, enriquecimiento
catastral con la API pública OVC. Diseñada como **single-user activo** pero
**multi-tenant-ready** (toda entidad tiene `ownerId`).

Monorepo npm-workspaces:

| Workspace | Stack | Ubicación |
|---|---|---|
| Web | Next.js 15 App Router + React 19 + Tailwind 3 | `src/` |
| Mobile | Expo 54 + Expo Router 6 + React Native 0.81 | `apps/mobile/` |
| Shared | TypeScript ESM (tipos Zod, format, similarity, sanity) | `packages/shared/` |
| Scraping | 10 adapters de portal + sidecar Playwright | `src/features/scraping/`, `scripts/scraper-service.mjs` |
| Userscripts | 7 Tampermonkey + 1 bookmarklet | `public/bookmarklet/` |

## 2. Stack y versiones

- **Node 20+**, npm workspaces (`"workspaces": ["packages/*","apps/*"]`)
- **TypeScript** ES2022 strict, path aliases (`@/` → `src/`)
- **Next.js 15.5** App Router; `serverExternalPackages: ["sharp"]`,
  `transpilePackages: ["@buysell/shared"]`, `outputFileTracingRoot` apuntando al
  root del monorepo
- **Prisma 6** + **PostgreSQL 17** (alpine en docker-compose) — único host de datos
- **NextAuth v5** (`@auth/prisma-adapter`) — sesión JWT para que el middleware
  corra en Edge. Web: magic-link via Resend. Mobile: OTP de 6 dígitos vía
  email + JWT HS256 propio (issuer `buysell-mobile`, 90d) emitido con `jose`
- **Tailwind 3** con design tokens custom (`--primary: #3A5F8A`,
  `--brand-accent: #C49A4D`, surface `#FAFAF7`)
- **Recharts** para gráficos · **sharp** para dHash · **fast-xml-parser** para
  Catastro · **Playwright** sólo en el sidecar
- **Expo SDK 54**: `expo-router` 6, `expo-image`, `expo-secure-store`,
  `react-native-webview` ~13.16

## 3. Arquitectura (resumen)

Dos procesos en localhost:
- **Web app** en `:4200` (Next.js dev/start) — todas las interfaces
- **Sidecar Playwright** en `127.0.0.1:4201` (`npm run scraper`) — sólo loopback,
  cierra a los 5 min de idle, anti-detection scripts

Postgres en `:5432` (contenedor `buysell-postgres`, volumen `buysell-pgdata`).

Clientes (todos hablan con la misma API):
- Browser web (cookie session)
- App Expo (Bearer HS256 JWT)
- Tampermonkey userscripts (Bearer `bs_<64chars>` ApiToken)

## 4. Modelo de datos (Prisma)

Entidades principales (`prisma/schema.prisma`):

- **User**, **Account**, **Session**, **VerificationToken**, **ApiToken**
  (tablas estándar NextAuth)
- **Property** — agregado central. Campos: `ownerId`, `title`, `titleSlug`,
  10 tipos (PISO/HOUSE/ATICO/CHALET/DUPLEX/ESTUDIO/LOFT/LOCAL/TERRENO/OTRO),
  4 estados (FOR_SALE/RESERVED/SOLD/WITHDRAWN), 7 amenities boolean,
  `currentPrice` (integer **cents**), location (lat/lng/city/province/...),
  `cadastralRef`, `cadastralData JSON`, `matchDismissed[]`
- **Listing** — relación 1:N con Property por portal. 10 portales
  (IDEALISTA, FOTOCASA, PISOS_COM, MILANUNCIOS, HABITACLIA, YAENCONTRE,
  THINKSPAIN, INDOMIO, OTHER, MANUAL). Estados: ACTIVE/PRICE_DROP/PRICE_UP/
  SOLD/REMOVED/UNKNOWN. Unique en `url`
- **Media** — 5 kinds (PHOTO/FLOORPLAN/VIDEO/TOUR_3D/DOCUMENT), 5 sources
  (USER_UPLOAD/PORTAL_SCRAPE/CADASTRE/AI_SKETCH/AI_RECONSTRUCTION). Lleva
  `phash` (dHash 9×8 perceptual)
- **PriceSnapshot** — append-only, índice `(propertyId, observedAt)`
- **MatchSuggestion** — caché de duplicados detectados, con `score`, `reasons[]`,
  `dismissedAt`
- **ImportLog** — append-only forensics. `kind` ∈ {HASH, CATASTRO, GEOCODE,
  MATCH, MERGE_AUTO, MERGE_MANUAL, BORROW_FIELDS, RECHECK}. Indices compuestos
  `(propertyId, createdAt)`, `(kind, createdAt)`, `(createdAt)`
- **SavedSearch** (scaffold, no usado)

Convenciones:
- **Precios en cents** siempre (`Math.round(€ * 100)`). Formato en
  `packages/shared/src/format.ts:formatPrice`
- **ownerId obligatorio** en toda entidad. Filtrar siempre por
  `requireUserId()` de `src/lib/auth-helpers.ts`
- **Cascade-delete** desde Property a Listing/Media/PriceSnapshot

## 5. Features implementadas (28 totales, 26 done)

Catálogo en `docs/blitzy-tech-spec.md` §2.1 con detalles. Grupos:

- **Property Management** (F-001 CRUD, F-002 Multi-portal, F-003 Price history, F-023 Media)
- **Auth** (F-004 Web magic-link, F-005 Mobile OTP, F-006 API tokens)
- **Scraping & Import** (F-007 Automated HTTP+Playwright, F-008 Manual-only
  portals, F-009 Playwright sidecar, F-011 Bookmarklet, F-021 Recheck runner)
- **Enrichment** (F-010 Catastro OVC, F-015 dHash, F-016 Background pipeline,
  F-025 Geocoding Nominatim)
- **Dedup & Merge** (F-012 5-signal detection, F-013 Merge workflow,
  F-014 Field borrowing)
- **Discovery & Analytics** (F-017 Dashboard, F-018 Activity timeline,
  F-019 Global search, F-020 Filters & sort, F-026 External portal links)
- **Mobile** (F-022 — login OTP, tabs Inmuebles/Duplicados/Buscar/Cuenta,
  ficha detalle con galería swipeable)
- **Operational** (F-024 ImportLog)
- **Proposed/scaffold** (F-027, F-028 — no implementadas)

## 6. ADRs (decisiones arquitectónicas vivas)

Cualquier cambio que vulnere alguna debe documentarse:

| ADR | Decisión |
|---|---|
| 1 | Monolito modular (no microservicios) |
| 2 | Playwright en **sidecar separado** (no en proceso Next.js — bundling roto) |
| 3 | Sólo PostgreSQL (sin Redis todavía) |
| 4 | **Operaciones idempotentes** sobre transacciones (re-run seguro) |
| 5 | **Fire-and-forget** background tasks (sin queue inicialmente) |
| 6 | JSON-LD como señal **primaria** en parsers (CSS selectors fallback) |
| 7 | Edge middleware + JWT session (Prisma fuera del Edge) |
| 8 | Imágenes en `public/uploads/` local (R2 deferred) |

## 7. Portales y estrategia de scraping

| Tier | Portales | Modelo |
|---|---|---|
| Automated | Fotocasa, Pisos.com, Habitaclia, ThinkSpain, Indomio | Adapter HTTP + fallback Playwright |
| Manual-only | **Idealista, Milanuncios, Yaencontre** | DataDome → sólo userscript |
| Other | OTHER, MANUAL | Creación directa UI |

Adapters en `src/features/scraping/adapters/` siguen patrón
`_genericAdapter.ts`. Userscripts en `public/bookmarklet/*.user.js` son
servidos dinámicamente desde `src/app/api/bookmarklet/[portal]/route.ts` con
el `bs_<token>` inyectado.

## 8. Convenciones de código

- **Componentes UI**: en `src/components/ui/` hay un kit (Card, Section, Stat,
  Badge, Button, Chip, Input, Field, Table, EmptyState, PriceDelta,
  StatusBadge). Usar éstos antes de crear nuevos
- **Brand icons**: `IconKey` (master), `IconHorreo`, `IconPicos` en
  `src/components/brand/icons.tsx`
- **Forms**: Zod schemas en `src/lib/validators.ts`. Toda route handler valida
  el body con `safeParse`
- **API errors**: devuelven `NextResponse.json({ error, detail? }, { status })`
- **CORS**: solo `/api/listings/import` y `/api/auth/mobile/*` tienen
  `Access-Control-Allow-Origin: *` (clientes externos: bookmarklet + mobile)
- **Logging**: `console.log` con tag entre corchetes —
  `[scraper]`, `[auth]`, `[auth-mobile]`, `[import-listing]`, `[catastro]`,
  `[matcher]`. Sin librería de logging estructurado (todavía)
- **Background tasks**: `postImportTasks()` en `src/lib/import-listing.ts`
  encadena hash + catastro + geocode + match + borrow-fields. Cada paso
  escribe a `ImportLog`
- **Mobile**: archivos kebab-case (no PascalCase) salvo componentes (PascalCase).
  Estilos con `StyleSheet.create`. SecureStore via `apps/mobile/lib/secure-store.ts`
  con fallback localStorage para web

## 9. Comandos npm clave

| Script | Qué hace |
|---|---|
| `npm run dev` | Next.js dev server en `:4200` (escucha en todas las interfaces) |
| `npm run scraper` | Sidecar Playwright en `127.0.0.1:4201` |
| `npm run build` / `start` | Build / start prod |
| `npm run lint` | ESLint |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:generate` | `prisma generate` |
| `npm run db:studio` | Prisma Studio |
| `npm run check-listings` | Recheck batch (CLI) — emite ✓/✗/⊘/! por listing |
| `npm run hash-photos` | Backfill `Media.phash` NULL |
| `npm run fix-prices` | Limpia precios sanity-rejected |
| `npm run claim-orphans -- <email>` | Asigna `ownerId` a rows huérfanas |
| Mobile | `cd apps/mobile && npx expo start` |

## 10. Variables de entorno

Ver `.env.example`. Críticas:

- `DATABASE_URL` — Postgres
- `AUTH_SECRET` — NextAuth (32 bytes hex)
- `NEXTAUTH_URL` — `http://localhost:4200` en dev; dominio real en prod
- `RESEND_API_KEY` — sin esto, los códigos OTP y magic-links se imprimen en
  consola del dev server (útil para testing)
- `RESEND_FROM` — por defecto `"BuySell <onboarding@resend.dev>"` (sandbox
  Resend; sólo envía al email registrado en Resend mientras no haya dominio
  verificado)
- `CATASTRO_BASE_URL` — fijo, no cambiar
- `ANTHROPIC_API_KEY` — vacío todavía (reservado para scoring IA Fase 2)

## 11. Estado actual y bloqueantes conocidos

✅ **Hecho**: todo el pipeline end-to-end (import → enrichment → dedup → recheck),
auth web + mobile, dashboard, /matches, búsqueda global, ImportLog,
bookmarklet dinámico, app mobile básica.

⏳ **Pendiente (corto plazo)**:
1. **Verificar dominio Resend** (`onboarding@resend.dev` sólo envía al email
   del propietario de la cuenta Resend). Bloquea login para otros usuarios
2. **Fusionar/Descartar en /duplicados mobile** (actualmente read-only)
3. **Re-check + Catastro desde la ficha detalle mobile**
4. **WebView import desde mobile** — requiere Expo Development Build
   (no Expo Go)

🚧 **Phase 1 Roadmap** (`docs/ROADMAP.md`, 7 pasos): dominio + NEXTAUTH_URL →
Dockerfile + Railway/Fly.io → CI/CD GitHub Actions → R2 para uploads →
email bajada de precio → calculadora hipoteca → comparador → cron scraper
desacoplado → extensión Chrome MV3.

## 12. Cómo trabajar

- Antes de cambios grandes: leer `docs/ROADMAP.md` y `docs/blitzy-tech-spec.md`
  para alinear con decisiones existentes
- **No alterar precios** sin pasar por `isReasonablePriceChange` de
  `packages/shared/src/sanity.ts` (descarta cambios >5x o negativos)
- **No tocar `prisma/migrations/`** manualmente; usar `prisma migrate dev`
- **No instalar Playwright en el proceso de Next.js** (ADR-2) — siempre
  sidecar
- **No commitear `.env`** (gitignored) — usar `.env.example` para nuevos vars
- **Repo público en GitHub**: `https://github.com/Asuanzes/BuySell` — cuidado
  con secretos en código y commits
- Identidad git ya configurada como noreply de GitHub (`4410315+Asuanzes@users.noreply.github.com`)

## 13. Verificación / smoke tests

Sin suite automatizada todavía. Smoke manual tras cambios grandes:
1. `docker compose up -d` (Postgres) → `npm run dev` → `npm run scraper`
2. Login en `/login` con Belquivir@proton.me (único email que recibe OTP
   mientras no haya dominio verificado en Resend)
3. `/dashboard` carga en <1s con 100+ fichas
4. Importar URL nueva vía bookmarklet → aparece en `/properties` con phash,
   coords, catastro
5. `/matches` muestra duplicados sugeridos
6. `/api/healthz` no existe en web, pero el sidecar responde
   `GET http://127.0.0.1:4201/healthz`

## 14. Referencias clave en el repo

| Doc | Para qué |
|---|---|
| `CLAUDE.md` | Brief funcional original (objetivo + alcance) |
| `docs/ROADMAP.md` | Plan de escalado y evolución por fases |
| `docs/blitzy-tech-spec.md` | Tech-spec exhaustiva (28 features, ADRs, workflows, infra) |
| `apps/mobile/AGENTS.md` | "Expo HAS CHANGED — read versioned docs en v54" |
| `README.md` | Setup mínimo |

---

**Cuando recibas una tarea**, antes de editar:
1. Identifica el o los **F-XXX** afectados (mira §2.1 de la tech-spec)
2. Comprueba si rompe alguna **ADR** (sec 6 arriba)
3. Si toca background tasks, **escribe a `ImportLog`** con el `kind` adecuado
4. Si toca routes API, **filtra por `ownerId`** y valida con Zod
5. Si añade env vars, **actualiza `.env.example`** y este documento


---

# Anexo: Tech-spec completa (Blitzy)

> Especificación técnica exhaustiva auto-generada. Referencia normativa.

---

A
Alejandro
Free
BuySell
Tech spec up-to-date
Build
Source
Asuanzes/BuySell/main ↗
1
Codebase context
2
Tech spec
3
Build prompt
4
Contents
1.
Introduction
1.1
Executive Summary
1.2
System Overview
1.3
Scope
1.4
References
2.
Product Requirements
2.1
Feature Catalog
2.2
Functional Requirements Tables
2.3
Feature Relationships
2.4
Implementation Considerations
2.5
Traceability Matrix
2.6
Assumptions And Constraints
2.7
References
3.
Technology Stack
3.1
Programming Languages
3.2
Frameworks & Libraries
3.3
Open-Source Dependencies
3.4
Third-Party Services
3.5
Databases & Storage
3.6
Development & Deployment
3.7
Deviations From The Default Technology Stack
3.8
Security Posture Of The Stack
3.9
References
4.
Process Flowchart
4.1
System Workflows
4.2
Integration Workflows
4.3
State Management
4.4
Error Handling Workflows
4.5
Validation Rules And Decision Points
4.6
Timing And Sla Considerations
4.7
References
5.
System Architecture
5.1
High-Level Architecture
5.2
Component Details
5.3
Technical Decisions
5.4
Cross-Cutting Concerns
6.
System Components Design
6.1
Core Services Architecture
7.
User Interface Design
7.1
Ui Architecture Overview
7.2
Core Ui Technologies
7.3
Web Application Interface
7.4
Mobile Application Interface
7.5
Ui / Backend Interaction Boundaries
7.6
Ui Data Schemas
7.7
User Interactions And Workflows
7.8
Visual Design Considerations
7.9
References
8.
Infrastructure
8.1
Infrastructure Applicability Assessment
8.2
Deployment Environment
8.3
Cloud Services
8.4
Containerization
8.5
Orchestration
8.6
Ci/Cd Pipeline
8.7
Infrastructure Monitoring
8.8
Infrastructure Architecture Diagrams
8.9
Infrastructure Cost Estimates And Resource Sizing
8.10
External Dependencies
8.11
Roadmap-Documented Future Infrastructure
9.
Appendices
9.1
Additional Technical Information
9.2
Glossary Of Terms
9.3
Acronyms
9.4
References
Technical Specification
1. Introduction
1.1 Executive Summary
1.1.1 Project Overview

BuySell Asturias (package identifier buysell-asturias, version 0.1.0, marked private) is a personal real-estate intelligence platform that consolidates property-listing data from multiple Spanish portals into a single owner-managed catalog. The system delivers historical price tracking, automated duplicate detection, and authoritative cadastral enrichment through Spain's public OVC services.

The project is structured as an npm-workspace monorepo composed of five primary deliverables:

Deliverable	Technology	Location
Web application	Next.js 15 App Router (React 19)	src/
Mobile companion	Expo 54 + Expo Router (React Native 0.81)	apps/mobile/
Shared types & utilities	TypeScript ESM package	packages/shared/
Scraping subsystem	10 portal adapters + Playwright sidecar	src/features/scraping/, scripts/scraper-service.mjs
Bookmarklet toolkit	7 Tampermonkey userscripts + 1 bookmarklet	public/bookmarklet/

The tagline declared in README.md positions the product as a "webapp para registrar inmuebles en venta con seguimiento histórico de precios", with portal scrapers and Catastro integration as evolutionary phases.

1.1.2 Core Business Problem

Spanish property seekers who track favorite listings face a fragmented workflow across at least eight major portals (Idealista, Fotocasa, Pisos.com, Milanuncios, Habitaclia, Yaencontre, ThinkSpain, Indomio). The pain points BuySell Asturias addresses are:

Problem	BuySell Asturias Solution
No persistent price history across portals	PriceSnapshot model with [propertyId, observedAt] index and Recharts visualization
Same property listed multiple times, no deduplication	5-signal matching engine (cadastre, photo hash, title, geo, area)
Status changes (sold/reserved/withdrawn) lost when listing disappears	Recheck runner with discriminated outcome union (ok/gone/blocked/error)
Manual re-entry per device	Single-click bookmarklet import + mobile-web synchronization via shared DB
No link to authoritative sources	Catastro OVC XML integration by coordinates, address, and reference
1.1.3 Key Stakeholders And Users

The system is engineered as single-user-active, multi-tenant-ready. The data model includes User, Account, Session, VerificationToken, and ApiToken tables, and every domain entity (Property, Listing, Media, MatchSuggestion, SavedSearch, ImportLog) carries an ownerId foreign key.

Stakeholder	Phase	Capability Requirement
Project owner (initial sole user)	Current	Personal favorites tracking, price history
Couples/families	Phase 2	Shared lists via token URL
Real-estate agents	Phase 3	B2B multi-tenant, qualified leads
Investors	Phase 3	ROI/yield calculations, AVM
1.1.4 Expected Business Impact And Value Proposition
Value Lever	Mechanism	Measurable Outcome
Time savings	One-click portal import via Tampermonkey userscript	Replaces manual transcription
Decision quality	Historical evolution + city €/m² benchmarks	Dashboard KPIs (8+ city benchmarks)
Data integrity	Cadastral linkage via OVC public services	cadastralRef populated automatically
Cross-portal awareness	5-signal duplicate detection with merge workflow	MatchSuggestion review queue
Future revenue	Multi-tenant ready architecture	Designed for SaaS pivot
1.2 System Overview
1.2.1 Project Context
1.2.1.1 Business Context And Market Positioning

The Spanish real-estate listings market is dominated by Idealista, which protects its content using DataDome anti-bot infrastructure. Automated scraping of Idealista is therefore not legally or technically prudent. BuySell Asturias's positioning explicitly recognizes this constraint and stratifies portals by interaction model:

Tier	Portals	Interaction Model
Automated	Fotocasa, Pisos.com, Habitaclia, ThinkSpain, Indomio	Generic HTTP adapter + Playwright sidecar fallback
Manual-only	Idealista, Milanuncios, Yaencontre	User-initiated bookmarklet/userscript import
Other / Manual	OTHER, MANUAL	Direct property creation through web/mobile UI

The differentiating value is cross-portal aggregation with cadastral grounding, an angle that the dominant portals deliberately avoid (they compete with each other and have no incentive to deduplicate against rivals).

1.2.1.2 Current System Limitations

This is a greenfield project (version 0.1.0) and does not replace a predecessor system. It does, however, replace the user's prior manual workflow consisting of browser bookmarks, spreadsheets, and unaided memory.

Per docs/ROADMAP.md, the project is more advanced than the original brief in CLAUDE.md suggested. Technical limitations remaining before production-grade operation are:

Gap	Severity	Evidence
No cloud deployment	Critical	Only docker-compose.yml for local PostgreSQL 17
No CI/CD pipeline	Critical	No .github/workflows/ directory
Local image storage	High	Uploads stored in public/uploads/
No real-time sync	High	Pull-based mobile-web synchronization only
No decoupled cron for scraper	High	Recheck must be triggered manually
1.2.1.3 Integration With Existing Enterprise Landscape
External Service	Purpose	Integration Method
Catastro OVC (Spain)	Cadastral reference lookup	Public XML services OVCSWLocalizacionRC + OVCCallejero
Resend	Magic-link email + notifications	API key (RESEND_API_KEY)
Nominatim (OSM)	Reverse geocoding	Public REST
Anthropic API	Planned AI features (floorplan, scoring)	API key scaffolded in .env.example
PostgreSQL 17	Persistence	Local Docker container; production target TBD
Real-estate portals	Listing source data	Mix of HTTP scraping, Playwright, and bookmarklets
1.2.2 High-level Description
1.2.2.1 Primary System Capabilities

Twelve capability domains are currently implemented and verifiable in the codebase:

#	Capability	Implementation Anchor
1	Property CRUD with rich attributes	src/features/properties/PropertyForm.tsx, src/app/api/properties/
2	Multi-portal listing tracking (8 portals + manual)	Listing model, Portal enum
3	Historical price snapshots with charting	PriceSnapshot model, PriceHistoryChart.tsx
4	Web authentication (magic-link)	src/lib/auth.ts (NextAuth v5 + Resend)
5	Mobile authentication (OTP → JWT)	src/lib/mobile-jwt.ts
6	Automated portal scraping (5 portals)	src/features/scraping/adapters/_genericAdapter.ts
7	Browser sidecar (Playwright HTTP service)	scripts/scraper-service.mjs on port 4201
8	Catastro integration	src/features/cadastre/lookup.ts
9	Bookmarklet/userscript importers (7 portals)	public/bookmarklet/*.user.js
10	5-signal duplicate detection + merge	src/features/matching/find-similar.ts
11	Background enrichment pipeline	src/lib/import-listing.ts enrichInBackground
12	Owner-scoped dashboard with KPIs	src/app/dashboard/page.tsx
1.2.2.2 Major System Components

External Services

Data Layer

Sidecar Process

Application Core

Client Surfaces

Catastro OVC
Public XML

Resend Email

Nominatim/OSM

Real-Estate Portals
Fotocasa, Pisos.com, etc.

Prisma Client
src/lib/db.ts

PostgreSQL 17
docker-compose.yml

Playwright HTTP Service
scripts/scraper-service.mjs:4201

Next.js API Routes
src/app/api/

Edge Auth Middleware
src/middleware.ts

Domain Features
src/features/

Shared Package
packages/shared/

Next.js 15 Web App
src/

Expo Mobile App
apps/mobile/

Tampermonkey Userscripts
public/bookmarklet/

1.2.2.3 Core Technical Approach

The web application uses Next.js 15 App Router with React 19 as the unified UI + API runtime. PostgreSQL 17 is accessed through Prisma 6 with a singleton client cached on globalThis in development. Authentication is implemented as a dual model: NextAuth v5 cookie sessions for the web client and a custom HS256 JWT flow for the mobile client (issuer buysell-mobile, 90-day expiry), bridged through src/lib/auth-helpers.ts.

The following architectural patterns are observable in the codebase:

Pattern	Application
Edge auth middleware	src/middleware.ts — public path allowlist + Bearer-token bypass for API
Adapter pattern	PortalAdapter interface + 10 portal-specific scraping adapters
Sidecar pattern	Playwright isolated in a separate Node process (port 4201) — never bundled into Next.js
Discriminated unions	Scrape outcomes typed as `ok
Fire-and-forget enrichment	Import returns synchronously; geocode/cadastre/phash/match run async post-response
Path aliasing	@/* → ./src/*, @buysell/shared → workspace package
Singleton ORM client	Prisma cached on globalThis in development for hot-reload safety

Confirmed stack versions (from package.json and apps/mobile/package.json):

Layer	Technology	Version
Web framework	Next.js	^15.1.0
UI library	React	^19.0.0
Database	PostgreSQL	17 (alpine)
ORM	Prisma	^6.1.0
Authentication	NextAuth	^5.0.0-beta.31
Validation	Zod	^3.24.1
Styling	Tailwind CSS	^3.4.17
Charts	Recharts	^2.15.0
Email	Resend	^6.12.3
Image processing	Sharp	^0.34.5
Browser automation	Playwright	^1.60.0
HTML parsing	Cheerio	^1.2.0
XML parsing	fast-xml-parser	^5.8.0
Mobile framework	Expo	~54.0.33
Mobile router	expo-router	~6.0.23
React Native	React Native	0.81.5
Language	TypeScript	^5.7.2
1.2.3 Success Criteria
1.2.3.1 Measurable Objectives (from
Phase	Horizon	Objective
Fase 1	0–8 weeks	Production-usable; real user can import and track favorites
Fase 2	2–6 months	100 active users; AI scoring; PWA + push notifications
Fase 3	6–18 months	Recurring revenue from freemium/B2B model
1.2.3.2 Critical Success Factors

Critical success factors are stratified by priority indicators in the roadmap document:

Priority	Factor	Status
🔴 Critical	Cloud deployment, CI/CD, NEXTAUTH_URL configuration	Pending
🟠 High	Decoupled cron scraper, lightweight task queue, Chrome MV3 extension	Pending
🟠 High	Side-by-side comparator, mortgage calculator	Pending
🟡 Medium	tsvector full-text search, Redis cache, R2 image storage, PWA, SSE	Pending
1.2.3.3 Key Performance Indicators (kpis)

The dashboard at src/app/dashboard/page.tsx already computes the following KPIs for the authenticated owner:

KPI Category	Specific Metric
Inventory	Active properties (FOR_SALE), sold count, withdrawn count
Distribution	Total listings, listings per portal
Market signal	City average €/m² (top 8 cities with ≥2 records)
Activity	Price snapshots in last 30 days
Operational health	Stale automatic listings (configurable STALE_DAYS)
Operational health	Stale manual-portal listings (Idealista, Milanuncios, Yaencontre)
Quality	Pending duplicate match suggestions
Quality	Photos missing perceptual hash
1.3 Scope
1.3.1 In-scope: Core Features And Functionalities
1.3.1.1 Must-have Capabilities (currently Implemented)
Capability	Evidence
Property CRUD with type, status, energy rating	src/lib/validators.ts (PropertyTypeEnum, PropertyStatusEnum, EnergyRatingEnum)
Filter, sort, and search across catalog	src/lib/filters.ts, src/app/api/search/route.ts
Global search component	src/components/GlobalSearch.tsx
Historical price snapshots	PriceSnapshot model, PriceHistoryChart.tsx
Web magic-link authentication	src/lib/auth.ts (NextAuth v5 + Resend)
Mobile OTP-to-JWT authentication	src/lib/mobile-jwt.ts, apps/mobile/app/login.tsx
Per-user API tokens (for bookmarklets)	src/lib/api-token.ts, ApiToken Prisma model
Multi-portal scraping (5 automated)	_genericAdapter.ts factory in src/features/scraping/adapters/
Manual-only portal handling (3 portals)	Adapters returning blocked outcome
Browser sidecar fallback	scripts/scraper-service.mjs (Playwright on 127.0.0.1:4201)
Catastro reference resolution	src/features/cadastre/lookup.ts
Bookmarklet/userscript imports (7 portals)	public/bookmarklet/*.user.js
5-signal duplicate matching	src/features/matching/find-similar.ts
Merge workflow with field borrowing	src/features/matching/merge.ts, borrow-fields.ts
Background enrichment	src/lib/import-listing.ts enrichInBackground
Perceptual hashing (64-bit dHash)	src/lib/dhash.ts
Owner-scoped dashboard	src/app/dashboard/page.tsx
Activity timeline	src/app/activity/page.tsx
Mobile catalog, detail, matches, account	apps/mobile/app/
1.3.1.2 Primary User Workflows
Workflow	Entry Point	Outcome
Add property manually	/properties/new	Property row + initial PriceSnapshot
Import from portal (auto-scrape)	API POST /api/listings/import	Property + Listing + media + enrichment
Import via bookmarklet	Per-portal userscript → API endpoint	Same as above; bypasses anti-bot
Review duplicate suggestions	/matches	Merge or dismiss MatchSuggestion
Recheck listings	checkAllActiveListings()	Updates status, captures new prices
Browse catalog	/properties	Filtered/sorted property cards
View price evolution	/properties/[id]	Chart of historical snapshots
1.3.1.3 Essential Integrations
Integration	Use Case	Direction
Catastro OVC XML	Cadastral reference attached to property	Outbound HTTP
Resend	Magic-link delivery, future notifications	Outbound API
Nominatim	Reverse geocoding from address	Outbound HTTP
Portal HTTP endpoints	Listing scraping for 5 portals	Outbound HTTP
Playwright sidecar	Fallback when HTTP scraping is blocked	Internal IPC (127.0.0.1:4201)
Tampermonkey userscripts	Manual import from 7 portals	Inbound API (bearer-token)
1.3.1.4 Key Technical Requirements
Requirement	Implementation
Node 20+ runtime	Specified in README.md
TypeScript strict mode	tsconfig.json with path aliases
Workspace monorepo	npm workspaces declared in root package.json
Single Prisma schema	prisma/schema.prisma (11 models, 8 enums)
Edge-compatible middleware	src/middleware.ts
Shared types between web and mobile	@buysell/shared package
Bearer-token API access for scripts	Allowed by middleware
1.3.2 In-scope: Implementation Boundaries
Boundary	Value
System surface	Web app + Mobile app + Shared package + DB + Browser scripts
User groups	Authenticated owners (multi-tenant ready, single-active)
Geographic	Spain (default country España); initial focus Asturias
Language	Spanish (es-ES) for UI and number/date formatting
Currency	Euros (€), stored as integer cents in PostgreSQL
Portals covered	8 Spanish portals + manual entry + generic "OTHER"
Data domains	Properties, listings, media, prices, users, sessions, API tokens, match suggestions, import logs, saved searches
1.3.3 Out-of-scope Elements
1.3.3.1 Explicitly Future Phase Work

The roadmap document explicitly defers these capabilities. They are not part of the current technical specification and any references to them in documentation should be understood as forward-looking.

Capability	Deferred to Phase
Cloud deployment (production Dockerfile, hosting)	Fase 1 — pending
CI/CD pipeline (.github/workflows/)	Fase 1 — pending
R2/Cloudflare image storage	Fase 1 — pending
Email notification on price drop (wired trigger)	Fase 1 — pending
Decoupled cron for scraper	Fase 1 — pending
Side-by-side property comparator (/compare)	Fase 1 — pending
Mortgage calculator	Fase 1 — pending
Chrome MV3 extension (replacing Tampermonkey)	Fase 2
Real-time sync via SSE/WebSockets	Fase 2
Web Push + Expo push notifications	Fase 2
Shared lists via token URL	Fase 2
AI-powered property scoring	Fase 2
Visit management (Visit, VisitNote models)	Fase 2
Zone analysis (Overpass API for transit/schools)	Fase 2
Basic AVM from owner data (€/m² model)	Fase 2
PWA installation	Fase 2
Full-text search via tsvector GIN index	Fase 2
Premium subscription (freemium)	Fase 3
Property Registry consultation (€9.50/note)	Fase 3
Qualified leads to real-estate agents	Fase 3
Mortgage affiliate revenue	Fase 3
Investor mode (ROI/yield)	Fase 3
B2B multi-tenant for agencies	Fase 3
Meilisearch (only if >10k properties)	Fase 3
Real AVM (Tinsa/INE integration)	Fase 3
1.3.3.2 Integration Points Not Covered
Integration	Reason for Exclusion
Idealista automated scraping	DataDome anti-bot — explicitly manualOnly: true
Milanuncios automated scraping	Anti-bot protections — manual-only
Yaencontre automated scraping	Anti-bot protections — manual-only
Registro de la Propiedad as a free plan source	Public-but-not-free; no floor plan value; deferred to Phase 3 premium
Real-time push to mobile	No SSE/WebSocket layer yet
Object storage (S3, R2) for media	All uploads currently in public/uploads/
Production Anthropic API integration	Key scaffolded in .env.example, no live feature
1.3.3.3 Unsupported Use Cases
Use Case	Status
Multi-user collaborative editing of a property	Schema multi-tenant but no UI or sharing flow
Floorplan AI generation from photos	Function generateSketchFromPhotos throws "pending implementation"
Saved-search runner (alert on new matches)	SavedSearch model exists; runner not implemented
Rental listings	Project scope limited to "inmuebles en venta" (sale-only)
Markets outside Spain	Country defaults to España; no internationalization framework
Languages other than Spanish	UI strings hard-coded in Spanish; <html lang="es">
Non-Euro currencies	Price fields stored as integer cents assuming €
1.4 References
1.4.1 Files Examined
package.json — Root dependencies, scripts, npm workspaces configuration
README.md — Product overview, stack, structure, roadmap status, data model
CLAUDE.md — Original product brief, objectives, functional requirements
docs/ROADMAP.md — Detailed scaling plan, current state assessment, phased roadmap, risks
.env.example — Required env vars (DB, NextAuth, Resend, Anthropic, Catastro)
docker-compose.yml — Local PostgreSQL 17 setup
next.config.ts — Next.js build configuration, image patterns, package externals
tsconfig.json — TypeScript compiler options and path aliases
tailwind.config.ts — Design tokens and theme extension
prisma/schema.prisma — 11 models, 8 enums, complete data model
src/middleware.ts — Edge auth middleware, public path allowlist, bearer-token bypass
apps/mobile/package.json — Expo 54, React Native, mobile dependencies
apps/mobile/app.json — Expo manifest declaring "BuySell Asturias"
src/features/cadastre/lookup.ts — Catastro XML integration
src/app/dashboard/page.tsx — Dashboard KPIs and metrics
src/lib/import-listing.ts — Import orchestration and background enrichment
src/features/properties/PropertyForm.tsx — Property editor form
src/lib/auth.ts — NextAuth + Resend custom email provider setup
src/app/properties/page.tsx — Property catalog page
src/app/api/listings/import/route.ts — Import API endpoint
src/lib/validators.ts — Property validation Zod schemas
src/lib/mobile-jwt.ts — Mobile JWT issuance and verification
1.4.2 Folders Explored
src/ — Web app source tree
src/app/ — Next.js App Router routes
src/app/api/ — API routes namespace
src/lib/ — Shared infrastructure (auth, db, validators, filters, etc.)
src/components/ — UI components and design system
src/features/ — Domain modules (scraping, matching, properties, cadastre, floorplan-ai)
src/features/scraping/ — Scraping subsystem
src/features/scraping/adapters/ — 10 portal adapters
src/features/matching/ — Duplicate detection
prisma/ — Schema, migrations, and seed
packages/ — Workspace packages container
packages/shared/ — Shared TypeScript package (@buysell/shared)
packages/shared/src/ — Shared source modules
apps/ — Mobile workspace container
apps/mobile/ — Expo mobile app
apps/mobile/app/ — Expo Router routes
scripts/ — Operational toolbox (scraper service, hashing, fixes, claims)
public/bookmarklet/ — Tampermonkey userscripts and bookmarklet
2. Product Requirements

This section enumerates the discrete, testable features that constitute BuySell Asturias, expressed as a feature catalog, functional requirements matrices, feature relationship maps, and per-feature implementation considerations. Every feature documented here is grounded in observable code artifacts (Prisma models, API routes, React components, scripts, or workspace packages) and is therefore traceable to a specific deliverable in the repository. Forward-looking capabilities deferred per docs/ROADMAP.md (Section 1.3.3) are excluded except where the codebase contains a scaffold (F-027, F-028).

2.1 Feature Catalog

The catalog is organized into eight functional groupings that correspond to the major subsystems of the repository: Property Management, Authentication & Authorization, Scraping & Import, Data Enrichment, Duplicate Detection & Merging, Discovery & Analytics, Mobile, and Operational. Twenty-eight features are documented, twenty-six of which are fully implemented (Completed) and two of which exist as scaffolds (Proposed).

2.1.1 Property Management Features
2.1.1.1 F-001: Property Catalog Management (crud)
Attribute	Value
Unique ID	F-001
Feature Name	Property Catalog Management (CRUD)
Feature Category	Property Management
Priority Level	Critical
Status	Completed

Description

Aspect	Detail
Overview	Owner-scoped CRUD over the Property aggregate, exposing collection and detail endpoints with Zod-validated payloads. Implements 10 property types, 4 status values, and 7 amenity booleans.
Business Value	Provides the canonical, deduplicated catalog of real-estate interests for the owner — the central data product around which all other features orbit.
User Benefits	Single source of truth replacing browser bookmarks, spreadsheets, and unaided memory referenced in docs/ROADMAP.md.
Technical Context	Anchored in prisma/schema.prisma (Property model lines 144-205), src/lib/validators.ts (PropertyInput Zod schema), and src/app/api/properties/ (route handlers). Prices stored as integer cents.

Dependencies

Type	Dependency
Prerequisite Features	F-004 (Web Auth) or F-005 (Mobile Auth) for ownerId injection
System Dependencies	PostgreSQL 17, Prisma 6 client (src/lib/db.ts), Next.js App Router
External Dependencies	None — pure persistence operation
Integration Requirements	Owner-scoping via requireUserId from src/lib/auth-helpers.ts
2.1.1.2 F-002: Multi-portal Listing Tracking
Attribute	Value
Unique ID	F-002
Feature Name	Multi-Portal Listing Tracking
Feature Category	Property Management
Priority Level	High
Status	Completed

Description

Aspect	Detail
Overview	Models a one-to-many relationship between a Property and its Listing rows across 10 portal values (IDEALISTA, FOTOCASA, PISOS_COM, MILANUNCIOS, HABITACLIA, YAENCONTRE, THINKSPAIN, INDOMIO, OTHER, MANUAL).
Business Value	Captures the fragmentation of Spanish listings markets — the same dwelling can appear under several URLs across portals.
User Benefits	Owner sees all portal occurrences of a single dwelling unified in one view.
Technical Context	Listing model in prisma/schema.prisma lines 223-239 with unique constraint on url and composite index (portal, status). Status enum: ACTIVE, PRICE_DROP, PRICE_UP, SOLD, REMOVED, UNKNOWN.

Dependencies

Type	Dependency
Prerequisite Features	F-001 (Property must exist as parent)
System Dependencies	PostgreSQL with cascade-delete on propertyId
External Dependencies	URL is the natural key (unique across all owners)
Integration Requirements	Used by F-007 (scraping), F-011 (import), F-021 (recheck)
2.1.1.3 F-003: Historical Price Tracking
Attribute	Value
Unique ID	F-003
Feature Name	Historical Price Tracking
Feature Category	Property Management
Priority Level	High
Status	Completed

Description

Aspect	Detail
Overview	Append-only PriceSnapshot stream per property, capturing price, status, source portal, and timestamp. Visualized via Recharts in the property detail page.
Business Value	Solves the "no persistent price history across portals" problem identified in Section 1.1.2.
User Benefits	Empirical evidence of price evolution informs negotiation and timing decisions.
Technical Context	PriceSnapshot model in prisma/schema.prisma lines 241-253, composite index (propertyId, observedAt), snapshots created by src/lib/import-listing.ts and src/features/scraping/runner.ts.

Dependencies

Type	Dependency
Prerequisite Features	F-001 (Property), F-002 (Listing source)
System Dependencies	PostgreSQL with cascade-delete
External Dependencies	None
Integration Requirements	Sanity-guarded via isReasonablePriceChange from packages/shared/src/sanity.ts
2.1.1.4 F-023: Media Management
Attribute	Value
Unique ID	F-023
Feature Name	Media Management
Feature Category	Property Management
Priority Level	High
Status	Completed

Description

Aspect	Detail
Overview	Stores property media in five MediaKind values (PHOTO, FLOORPLAN, VIDEO, TOUR_3D, DOCUMENT) and five MediaSource provenance values (USER_UPLOAD, PORTAL_SCRAPE, CADASTRE, AI_SKETCH, AI_RECONSTRUCTION).
Business Value	Visual evidence is central to property comparison; provenance tracking distinguishes owner-uploaded content from scraped imagery.
User Benefits	Persistent photo gallery preserved even when source listing is removed from portal.
Technical Context	Media model in prisma/schema.prisma lines 207-221; refresh policy in src/lib/import-listing.ts lines 320-346 preserves USER_UPLOAD and rehydrates PORTAL_SCRAPE photos on re-import while preserving phashes by URL.

Dependencies

Type	Dependency
Prerequisite Features	F-001 (Property), F-015 (dHash for phash field)
System Dependencies	Local filesystem public/uploads/ (R2 deferred per Section 1.3.3)
External Dependencies	None
Integration Requirements	Indexed for matching by phash
2.1.2 Authentication & Authorization Features
2.1.2.1 F-004: Web Authentication (magic Link)
Attribute	Value
Unique ID	F-004
Feature Name	Web Authentication (Magic Link)
Feature Category	Authentication & Authorization
Priority Level	Critical
Status	Completed

Description

Aspect	Detail
Overview	NextAuth v5 magic-link authentication with custom Resend-based email provider; JWT session strategy so middleware operates in Edge runtime.
Business Value	Passwordless sign-in eliminates credential storage risk and password recovery overhead.
User Benefits	Frictionless sign-in: enter email, click link, authenticated.
Technical Context	src/lib/auth.ts (Node runtime), src/lib/auth-edge.ts (Edge variant), src/middleware.ts (public allowlist). 24-hour token validity, 32-byte hex verification tokens. Falls back to console logging when RESEND_API_KEY not set.

Dependencies

Type	Dependency
Prerequisite Features	None
System Dependencies	NextAuth Prisma adapter (User, Account, Session, VerificationToken tables)
External Dependencies	Resend API (optional — falls back to console in dev)
Integration Requirements	AUTH_SECRET and NEXTAUTH_URL env vars
2.1.2.2 F-005: Mobile Authentication (otp → Jwt)
Attribute	Value
Unique ID	F-005
Feature Name	Mobile Authentication (OTP → JWT)
Feature Category	Authentication & Authorization
Priority Level	Critical
Status	Completed

Description

Aspect	Detail
Overview	Two-step OTP flow: 6-digit numeric code (crypto.randomInt) emailed via Resend, exchanged for HS256 JWT with 90-day expiry. Issuer buysell-mobile, signed with the same AUTH_SECRET as NextAuth.
Business Value	Native mobile cannot use NextAuth cookie sessions; this provides a stateless bearer-token mechanism.
User Benefits	Long-lived sessions (90 days) avoid frequent reauthentication; secure storage via expo-secure-store.
Technical Context	src/lib/mobile-jwt.ts, src/app/api/auth/mobile/request/route.ts, src/app/api/auth/mobile/verify/route.ts. OTP stored as VerificationToken with mobile: identifier prefix, 10-minute expiry, single-use.

Dependencies

Type	Dependency
Prerequisite Features	None
System Dependencies	VerificationToken table reused from NextAuth schema
External Dependencies	Resend API (optional — falls back to console)
Integration Requirements	Shared AUTH_SECRET ensures single trust root; CORS preflight handled on both endpoints
2.1.2.3 F-006: Per-user Api Tokens
Attribute	Value
Unique ID	F-006
Feature Name	Per-User API Tokens
Feature Category	Authentication & Authorization
Priority Level	Critical
Status	Completed

Description

Aspect	Detail
Overview	Long-lived bearer tokens (bs_ prefix + 64 hex chars = 256 bits entropy) for headless API access from Tampermonkey userscripts. Token resolution updates lastUsed timestamp best-effort.
Business Value	Enables userscript-based imports from browsers that cannot share NextAuth cookies.
User Benefits	Automatic token injection into bookmarklet code on download; no manual configuration.
Technical Context	src/lib/api-token.ts, ApiToken model in prisma/schema.prisma lines 130-142, bypass via src/middleware.ts lines 37-40 (any Authorization: Bearer ... on /api/* passes through Edge to Node handlers).

Dependencies

Type	Dependency
Prerequisite Features	F-004 (must be signed-in to fetch userscript with embedded token)
System Dependencies	Prisma ApiToken table
External Dependencies	None
Integration Requirements	Consumed by F-011 (Bookmarklet) at /api/listings/import
2.1.3 Scraping & Import Features
2.1.3.1 F-007: Automated Portal Scraping
Attribute	Value
Unique ID	F-007
Feature Name	Automated Portal Scraping
Feature Category	Scraping & Import
Priority Level	High
Status	Completed

Description

Aspect	Detail
Overview	Adapter pattern over 5 automated portals (Fotocasa, Pisos.com, Habitaclia, ThinkSpain, Indomio) implementing the PortalAdapter interface (portal, matches, manualOnly?, scrape). Outcome is a discriminated union `ok
Business Value	Eliminates manual re-entry for portals lacking aggressive anti-bot defenses.
User Benefits	Background recheck keeps listing status current without user action.
Technical Context	src/features/scraping/types.ts, src/features/scraping/adapters/_genericAdapter.ts, src/features/scraping/adapters/_common.ts, plus per-portal modules. Price extraction strategy: (1) JSON-LD offers.price, (2) portal-specific CSS selectors, (3) body regex fallback.

Dependencies

Type	Dependency
Prerequisite Features	F-002 (Listing target), F-009 (Playwright fallback when HTTP blocked)
System Dependencies	Cheerio for HTML parsing, fast-xml-parser for JSON-LD extraction
External Dependencies	Portal HTTP endpoints
Integration Requirements	Sanity guard isReasonablePriceChange (0.5x–2x range)
2.1.3.2 F-008: Manual-only Portal Handling
Attribute	Value
Unique ID	F-008
Feature Name	Manual-Only Portal Handling
Feature Category	Scraping & Import
Priority Level	Medium
Status	Completed

Description

Aspect	Detail
Overview	Three portal adapters (Idealista, Milanuncios, Yaencontre) declare manualOnly: true and immediately return { kind: "blocked" } without HTTP attempts. Runner updates only lastCheckedAt.
Business Value	Avoids triggering anti-bot systems (DataDome on Idealista) that would block the system's IP.
User Benefits	UI prompts user toward bookmarklet/userscript instead of failing silently.
Technical Context	Three adapter modules under src/features/scraping/adapters/; runner branching in src/features/scraping/runner.ts lines 57-67.

Dependencies

Type	Dependency
Prerequisite Features	F-007 (extends the same adapter contract), F-011 (bookmarklet alternative path)
System Dependencies	None
External Dependencies	None
Integration Requirements	Recognized by runner via adapter.manualOnly flag
2.1.3.3 F-009: Playwright Browser Sidecar
Attribute	Value
Unique ID	F-009
Feature Name	Playwright Browser Sidecar
Feature Category	Scraping & Import
Priority Level	Medium
Status	Completed

Description

Aspect	Detail
Overview	Stand-alone Node HTTP server (scripts/scraper-service.mjs) exposing GET /healthz and POST /fetch. Renders pages via headless Chromium with anti-automation masking. Singleton browser with 5-minute idle shutdown.
Business Value	Allows fallback to a real browser when direct HTTP scraping returns 403/429 or captcha markers, without bundling Playwright into Next.js.
User Benefits	Higher scraping success rate on hardened portals; invisible to end user.
Technical Context	Bound to 127.0.0.1:SCRAPER_PORT (default 4201) for security; Chromium configured with es-ES locale, Europe/Madrid timezone, 1366×768 viewport. SIGINT/SIGTERM lifecycle hooks close browser cleanly.

Dependencies

Type	Dependency
Prerequisite Features	None
System Dependencies	Playwright 1.60.0, Chromium runtime
External Dependencies	None (loopback only)
Integration Requirements	Consumed by F-007 via src/features/scraping/browser-fetch.ts
2.1.3.4 F-011: Bookmarklet/userscript Import
Attribute	Value
Unique ID	F-011
Feature Name	Bookmarklet/Userscript Import
Feature Category	Scraping & Import
Priority Level	Critical
Status	Completed

Description

Aspect	Detail
Overview	Seven Tampermonkey/Greasemonkey/Violentmonkey userscripts (one per portal) inject a floating "📥 Importar a BuySell" button on listing pages. Dynamically generated per-user with embedded API token via /api/bookmarklet/[portal].
Business Value	Provides import path for portals that cannot be automatically scraped (F-008) without violating their anti-bot policies.
User Benefits	One-click capture from any listing page without leaving the portal.
Technical Context	Userscripts use GM_xmlhttpRequest for cross-origin posts, MutationObserver and history.pushState patching for SPA resilience, run at document-idle. Server route returns Content-Type: application/javascript, Cache-Control: no-store, X-Generated-For: <userId>.

Dependencies

Type	Dependency
Prerequisite Features	F-004 (must be signed in to download userscript), F-006 (token embedded in script)
System Dependencies	Userscript host extension on user's browser (Tampermonkey/Violentmonkey)
External Dependencies	Browser CORS bypass via GM_xmlhttpRequest
Integration Requirements	POSTs to /api/listings/import with Bearer token; payload validated by ImportListingInput Zod schema
2.1.3.5 F-021: Listing Recheck Runner
Attribute	Value
Unique ID	F-021
Feature Name	Listing Recheck Runner
Feature Category	Scraping & Import
Priority Level	High
Status	Completed

Description

Aspect	Detail
Overview	Orchestrates per-listing or batch rechecking. Single-listing endpoint accepts { listingId }; empty body triggers all-active sweep with sequential processing and 1-second pacing.
Business Value	Keeps Listing.status, Listing.lastPrice, and Property.currentPrice current as portal-side state evolves.
User Benefits	Status changes (sold/reserved/withdrawn/price drop) surfaced on dashboard without manual revisits.
Technical Context	src/features/scraping/runner.ts, src/app/api/listings/check/route.ts with maxDuration = 300 (5 minutes). Batches order by lastCheckedAt asc nulls first. Outcome dispatch: gone→REMOVED, blocked/error→touch lastCheckedAt only, ok→sanity-check then update.

Dependencies

Type	Dependency
Prerequisite Features	F-002, F-007, F-008
System Dependencies	Long-running request runtime (Node, 5-min timeout)
External Dependencies	Portal HTTP endpoints
Integration Requirements	Creates F-003 snapshots on price change; logs F-024 events
2.1.4 Data Enrichment Features
2.1.4.1 F-010: Catastro (ovc) Integration
Attribute	Value
Unique ID	F-010
Feature Name	Catastro (OVC) Integration
Feature Category	Data Enrichment
Priority Level	High
Status	Completed

Description

Aspect	Detail
Overview	Resolves Spanish cadastral reference (RC) by coordinates, address, or RC via OVC public XML services. Enriches NULL property fields (yearBuilt, builtArea, address, floor) and attaches a synthesized floorplan URL as Media(FLOORPLAN, CADASTRE).
Business Value	Authoritative cross-link between owner-curated data and Spain's official property registry.
User Benefits	Independent verification of declared characteristics; floorplan from official source.
Technical Context	src/features/cadastre/lookup.ts (387 lines), consumes OVCSWLocalizacionRC.Consulta_RCCOOR and OVCCallejero.Consulta_DNPLOC/Consulta_DNPRC. Sigla normalization via SIGLA_MAP (Calle→CL, Avenida→AV, etc.). HTML responses detected and surfaced as actionable errors.

Dependencies

Type	Dependency
Prerequisite Features	F-001 (target property)
System Dependencies	fast-xml-parser for OVC XML parsing
External Dependencies	Catastro OVC public XML services
Integration Requirements	Optional CATASTRO_BASE_URL env override; invoked from F-016 background pipeline
2.1.4.2 F-015: Perceptual Hashing (dhash)
Attribute	Value
Unique ID	F-015
Feature Name	Perceptual Hashing (dHash)
Feature Category	Data Enrichment
Priority Level	Medium
Status	Completed

Description

Aspect	Detail
Overview	64-bit difference-hash algorithm: resize to 9×8 grayscale via Sharp, compare adjacent pixels per row, encode as 16-character hex. Hamming distance ≤ 8 indicates same image.
Business Value	Photo overlap is one of the strongest signals (worth up to 90 of 100 score points) in F-012 duplicate detection.
User Benefits	Automated cross-portal matching despite different file names, sizes, or compressions.
Technical Context	src/lib/dhash.ts; backfill script scripts/hash-existing-photos.ts exposed as npm run hash-photos. dhashFromUrl filters images < 1000 bytes as likely placeholders. Media.phash column indexed in prisma/schema.prisma.

Dependencies

Type	Dependency
Prerequisite Features	F-023 (Media with image URL)
System Dependencies	Sharp 0.34.5
External Dependencies	Image URL must be HTTP-fetchable; AVIF/WebP/PNG/JPEG accepted
Integration Requirements	Consumed by F-012 (matching), F-013 (merge dedup)
2.1.4.3 F-016: Background Enrichment Pipeline
Attribute	Value
Unique ID	F-016
Feature Name	Background Enrichment Pipeline
Feature Category	Data Enrichment
Priority Level	High
Status	Completed

Description

Aspect	Detail
Overview	Fire-and-forget pipeline that runs after importListing returns. Stages: (1) dHash up to 60 photos with 800ms throttle, (2) Catastro lookup if RC missing, (3) Geocoding if lat/lng NULL but address present, (4) Field borrowing from similar properties, (5) Duplicate detection with auto-merge at score ≥ 95.
Business Value	Decouples slow enrichments from the user-facing import response; keeps perceived latency low.
User Benefits	Imports feel instant; enrichment results visible on subsequent page loads.
Technical Context	src/lib/import-listing.ts lines 455-575 (postImportTasks) and 577-630 (enrichInBackground). Each stage logs to F-024 via logImportEvent. Re-imports with no new media skip duplicate detection (skipAutoMerge: !mediaRefreshed).

Dependencies

Type	Dependency
Prerequisite Features	F-001, F-010, F-012, F-013, F-014, F-015, F-025
System Dependencies	Node setTimeout-based pacing; no external queue (deferred)
External Dependencies	All those of dependent features
Integration Requirements	Triggered from import flow; never blocks the HTTP response
2.1.4.4 F-025: Geocoding (nominatim/osm)
Attribute	Value
Unique ID	F-025
Feature Name	Geocoding (Nominatim/OSM)
Feature Category	Data Enrichment
Priority Level	Medium
Status	Completed

Description

Aspect	Detail
Overview	Forward geocoding through Nominatim public API with module-level throttling, query fallbacks, and Spain-specific request parameters. Returns { latitude, longitude, displayName } or null.
Business Value	Coordinates power F-010 (Catastro by coordinates) and F-012 (geographic proximity matching).
User Benefits	Properties imported with only an address gain map-able coordinates without user effort.
Technical Context	src/lib/geocode.ts; called from src/lib/import-listing.ts lines 489-516 only when both latitude and longitude are NULL but address or city is available.

Dependencies

Type	Dependency
Prerequisite Features	F-001 (property with address)
System Dependencies	None
External Dependencies	Nominatim public REST API
Integration Requirements	Invoked from F-016 pipeline
2.1.5 Duplicate Detection & Merging Features
2.1.5.1 F-012: 5-signal Duplicate Detection
Attribute	Value
Unique ID	F-012
Feature Name	5-Signal Duplicate Detection
Feature Category	Duplicate Detection & Merging
Priority Level	High
Status	Completed

Description

Aspect	Detail
Overview	Composite scoring engine combining: (1) cadastral RC equality, (2) photo perceptual hash overlap, (3) title Jaccard on bigrams, (4) haversine geographic distance, (5) built area difference percentage. Persists candidates ≥ 60 as MatchSuggestion; discards < 30.
Business Value	Eliminates the "same property listed multiple times" pain point identified in Section 1.1.2.
User Benefits	Review queue of probable duplicates instead of manual cross-referencing across portals.
Technical Context	src/features/matching/find-similar.ts engine, packages/shared/src/similarity.ts utilities (slugify, bigrams, Jaccard, haversine), MatchSuggestion model in prisma/schema.prisma lines 255-270. Bonus rule: ≥ 2 weak signals adds +15 (cap 95). Candidate set filtered by cadastralRef/city/phash overlap, max 50.

Dependencies

Type	Dependency
Prerequisite Features	F-010 (cadastral), F-015 (phash), F-025 (geo)
System Dependencies	Composite indexes on (sourceId, dismissedAt), (score, dismissedAt)
External Dependencies	None
Integration Requirements	Invoked from F-016; results surfaced in F-017 dashboard, web /matches page, mobile (tabs)/matches.tsx
2.1.5.2 F-013: Property Merge Workflow
Attribute	Value
Unique ID	F-013
Feature Name	Property Merge Workflow
Feature Category	Duplicate Detection & Merging
Priority Level	High
Status	Completed

Description

Aspect	Detail
Overview	Destructive consolidation of two property rows: moves listings and snapshots, dedups media by phash, fills NULL fields from source, unions tags, deletes source. Idempotent — returns zeros if source already deleted.
Business Value	Consolidates duplicate findings from F-012 into a single canonical property record.
User Benefits	Single property page with full history instead of fragmented duplicates.
Technical Context	src/features/matching/merge.ts, src/app/api/properties/[id]/merge/route.ts. 24-field whitelist for NULL backfill; energyRating only overwritten if target is UNKNOWN. Auto-merge safety guard (src/lib/import-listing.ts lines 542-551) blocks at score ≥ 95 if price diff > 30% or type mismatch.

Dependencies

Type	Dependency
Prerequisite Features	F-012 (provides merge candidates)
System Dependencies	Transactional Prisma operations
External Dependencies	None
Integration Requirements	Auto-invocation from F-016 at score ≥ 95; manual invocation from web /matches and mobile (tabs)/matches.tsx
2.1.5.3 F-014: Field Borrowing
Attribute	Value
Unique ID	F-014
Feature Name	Field Borrowing
Feature Category	Duplicate Detection & Merging
Priority Level	Medium
Status	Completed

Description

Aspect	Detail
Overview	Non-destructive enrichment that fills NULL or empty-string fields on a property using values from its top similar candidate (score ≥ 70). Whitelist of 19 fields including description, coordinates, room counts, areas, year, and amenity booleans.
Business Value	Captures information that one portal exposes but another omits, without overwriting owner-edited values.
User Benefits	Maximizes data completeness from cross-portal listings automatically.
Technical Context	src/features/matching/borrow-fields.ts; MIN_SCORE = 70; only fills where current value is null or "". Logged as ImportLogKind.BORROW_FIELDS.

Dependencies

Type	Dependency
Prerequisite Features	F-012 (provides candidate scoring)
System Dependencies	None
External Dependencies	None
Integration Requirements	Invoked from F-016 pipeline before F-012 final pass
2.1.6 Discovery & Analytics Features
2.1.6.1 F-017: Owner-scoped Dashboard
Attribute	Value
Unique ID	F-017
Feature Name	Owner-Scoped Dashboard
Feature Category	Discovery & Analytics
Priority Level	High
Status	Completed

Description

Aspect	Detail
Overview	Request-time rendered dashboard executing 10 parallel database queries via Promise.all, surfacing inventory KPIs, portal distribution, market signals, activity, and operational health flags.
Business Value	Unified pulse of the catalog across status, freshness, quality, and market dimensions.
User Benefits	Single page surfaces issues requiring attention (stale listings, pending merges, unhashed photos).
Technical Context	src/app/dashboard/page.tsx (268 lines). STALE_DAYS = 7, MANUAL_PORTALS = ["IDEALISTA", "MILANUNCIOS"]. €/m² aggregation via raw SQL with HAVING COUNT(*) >= 2, ordered by count desc, limit 8. export const dynamic = "force-dynamic".

Dependencies

Type	Dependency
Prerequisite Features	F-001, F-002, F-003, F-012, F-015
System Dependencies	PostgreSQL aggregation; Prisma groupBy
External Dependencies	None
Integration Requirements	Owner-scoping via requireUserId
2.1.6.2 F-018: Activity Timeline
Attribute	Value
Unique ID	F-018
Feature Name	Activity Timeline
Feature Category	Discovery & Analytics
Priority Level	Medium
Status	Completed

Description

Aspect	Detail
Overview	Chronological feed of the last 100 PriceSnapshot records grouped by property and classified as up/down/flat/sold. Renders relative time labels in Spanish ("Hoy", "Ayer", "Hace n días").
Business Value	Captures temporal dynamics ("what changed recently") that the static dashboard cannot.
User Benefits	Quick scan of recent market activity organized by day.
Technical Context	src/app/activity/page.tsx. Computes 30-day KPIs: price drop count, price increase count, sold count.

Dependencies

Type	Dependency
Prerequisite Features	F-003 (PriceSnapshot stream)
System Dependencies	None
External Dependencies	None
Integration Requirements	Owner-scoping via property join
2.1.6.3 F-019: Global Search
Attribute	Value
Unique ID	F-019
Feature Name	Global Search
Feature Category	Discovery & Analytics
Priority Level	Medium
Status	Completed

Description

Aspect	Detail
Overview	Owner-scoped server endpoint searching title, city, neighborhood, address, and cadastralRef (case-insensitive contains). Returns top 12 ordered by updatedAt desc, each augmented with primary photo.
Business Value	Fast retrieval across a growing catalog without leaving the current page.
User Benefits	Type-ahead search with photo previews on both web and mobile.
Technical Context	src/app/api/search/route.ts (API), src/components/GlobalSearch.tsx (web client with outside-click dismissal), apps/mobile/app/(tabs)/search.tsx (mobile with 250ms debounce, min 2 chars).

Dependencies

Type	Dependency
Prerequisite Features	F-001
System Dependencies	Prisma mode: "insensitive"; tsvector deferred per Section 1.3.3
External Dependencies	None
Integration Requirements	Used from both web and mobile clients
2.1.6.4 F-020: Property Filtering And Sorting
Attribute	Value
Unique ID	F-020
Feature Name	Property Filtering and Sorting
Feature Category	Discovery & Analytics
Priority Level	Medium
Status	Completed

Description

Aspect	Detail
Overview	URL-driven filter/sort schema parsed via parseFilters(URLSearchParams) and transformed into Prisma WHERE clauses via buildPropertyWhere. Supports text, location, type, status, price range, room count, amenities. Two view modes: table (default) or grid.
Business Value	Lets the owner narrow a growing catalog by any combination of attributes.
User Benefits	Bookmark-able filtered views; shareable URLs preserving state.
Technical Context	src/lib/filters.ts, src/features/properties/FiltersSidebar.tsx, src/features/properties/SortMenu.tsx, src/features/properties/ViewToggle.tsx. Sort options: updatedAt-desc (default), createdAt-desc, currentPrice-asc, currentPrice-desc. Hard limit 100 rows.

Dependencies

Type	Dependency
Prerequisite Features	F-001
System Dependencies	Composite indexes on (city, province), (type, status), currentPrice
External Dependencies	None
Integration Requirements	Used by F-001 catalog page
2.1.6.5 F-026: External Portal Search Links
Attribute	Value
Unique ID	F-026
Feature Name	External Portal Search Links
Feature Category	Discovery & Analytics
Priority Level	Low
Status	Completed

Description

Aspect	Detail
Overview	Generates Google site: search URLs for 7 portals (Idealista, Fotocasa, Pisos.com, Habitaclia, Yaencontre, ThinkSpain, Indomio) and a Google Lens reverse-image search URL. Title parsing strips portal names and identifies property type from a fixed vocabulary.
Business Value	Helps the owner discover additional listings of the same property across portals without manually crafting queries.
User Benefits	One-click jump to portal-scoped Google searches; reverse image search for photos.
Technical Context	src/features/matching/external-search.ts, src/features/properties/SearchOtherPortalsButton.tsx. Uses TYPE_WORDS and PORTAL_WORDS regex for cleaning.

Dependencies

Type	Dependency
Prerequisite Features	F-001
System Dependencies	None
External Dependencies	Google Search (external navigation only — no API integration)
Integration Requirements	None
2.1.7 Mobile Feature
2.1.7.1 F-022: Mobile App (expo)
Attribute	Value
Unique ID	F-022
Feature Name	Mobile App (Expo)
Feature Category	Mobile
Priority Level	High
Status	Completed

Description

Aspect	Detail
Overview	Expo Router app delivering five tab routes (index, matches, search, account, hidden explore), property detail with image gallery and listings, and a two-step OTP login screen. Tokens stored via expo-secure-store with localStorage web fallback.
Business Value	On-the-go access to the catalog; mobile-native UX for browsing and matches review.
User Benefits	Pull-to-refresh, native gestures, secure local credential storage, debounced search.
Technical Context	Expo 54.0.33, Expo Router 6.0.23, React Native 0.81.5, React 19.1.0. TOKEN_KEY = "buysell.mobile.token", API_URL from EXPO_PUBLIC_API_URL (default http://192.168.1.77:4200). _layout.tsx mounts AuthGate redirecting unauthenticated users to /login.

Dependencies

Type	Dependency
Prerequisite Features	F-005 (mobile auth), F-019 (search), F-012/F-013 (matches review)
System Dependencies	Expo runtime, expo-image, expo-symbols, expo-haptics, expo-linking
External Dependencies	None at runtime; Apple/Google stores for distribution
Integration Requirements	Consumes same web API surface; sends Authorization: Bearer <jwt>
2.1.8 Operational Features
2.1.8.1 F-024: Import Log / Audit Trail
Attribute	Value
Unique ID	F-024
Feature Name	Import Log / Audit Trail
Feature Category	Operational
Priority Level	Medium
Status	Completed

Description

Aspect	Detail
Overview	Append-only event log with 8 event kinds (HASH, CATASTRO, GEOCODE, MATCH, MERGE_AUTO, MERGE_MANUAL, BORROW_FIELDS, RECHECK), a boolean success flag, message, and JSON meta. Non-blocking — write errors are swallowed after console diagnostic.
Business Value	Diagnostic trail for the background enrichment pipeline; explains automated decisions.
User Benefits	Indirect — surfaces operational health metrics on dashboard (e.g., recent errors).
Technical Context	prisma/schema.prisma lines 272-295, src/lib/import-log.ts. Composite indexes on (propertyId, createdAt), (kind, createdAt), (createdAt).

Dependencies

Type	Dependency
Prerequisite Features	Logged by F-007, F-010, F-012, F-013, F-014, F-015, F-016, F-021, F-025
System Dependencies	PostgreSQL JSON column
External Dependencies	None
Integration Requirements	Optional FK propertyId allows orphaned logs
2.1.9 Proposed / Scaffold Features
2.1.9.1 F-027: Floorplan Ai (scaffold Only)
Attribute	Value
Unique ID	F-027
Feature Name	Floorplan AI Generation
Feature Category	Data Enrichment
Priority Level	Low
Status	Proposed

Description

Aspect	Detail
Overview	Type contracts (SketchRoom, SketchPlan) defined; implementation throws "floorplan-ai.generateSketchFromPhotos: pendiente de implementar". Intended to invoke a multimodal LLM with property photos and characteristics, produce JSON room layout, render SVG, and persist as Media(FLOORPLAN, AI_SKETCH).
Business Value	Visual representation when no official Catastro floorplan is available.
User Benefits	Spatial understanding of the dwelling from photos alone.
Technical Context	src/features/floorplan-ai/sketch.ts. ANTHROPIC_API_KEY scaffolded in .env.example.

Dependencies

Type	Dependency
Prerequisite Features	F-023 (input photos)
System Dependencies	None yet
External Dependencies	Anthropic API (planned)
Integration Requirements	Would persist via existing Media model
2.1.9.2 F-028: Savedsearch (model Only)
Attribute	Value
Unique ID	F-028
Feature Name	Saved Search with Alerts
Feature Category	Discovery & Analytics
Priority Level	Low
Status	Proposed

Description

Aspect	Detail
Overview	SavedSearch Prisma model (ownerId, name, portal, url, filters JSON, active, lastRunAt) exists; no UI for management; no runner that periodically executes searches and alerts on new matches.
Business Value	Proactive discovery of new properties matching owner criteria.
User Benefits	Notifications when new listings fit saved filters (deferred).
Technical Context	prisma/schema.prisma lines 297-307; initial table created in prisma/migrations/20260518190058_init/migration.sql.

Dependencies

Type	Dependency
Prerequisite Features	F-020 (filter schema), F-021 (recheck infrastructure as runner pattern)
System Dependencies	Scheduling layer (deferred per Section 1.3.3)
External Dependencies	None
Integration Requirements	Would consume F-020 filter schema
2.2 Functional Requirements Tables

Each feature exposes one or more atomic, testable requirements. Requirement IDs follow the pattern F-XXX-RQ-YYY. Priority values are Must-Have / Should-Have / Could-Have; complexity values are High / Medium / Low.

2.2.1 F-001: Property Catalog Management Requirements
2.2.1.1 Requirement Details — F-001-rq-001 Through Rq-004
Field	F-001-RQ-001	F-001-RQ-002
Description	Create property via POST /api/properties	List properties via GET /api/properties
Acceptance Criteria	Returns 201 with new row; ownerId from session; Zod schema validates required fields	Returns max 100 rows ordered by updatedAt desc; owner-scoped
Priority	Must-Have	Must-Have
Complexity	Medium	Low
Field	F-001-RQ-003	F-001-RQ-004
Description	Patch property via PATCH /api/properties/[id]	Soft validation of currentPrice
Acceptance Criteria	Partial Zod validation; owner-scoped; returns updated row	Stored as integer cents; UI converts via × 100 on submit, ÷ 100 on display
Priority	Must-Have	Must-Have
Complexity	Medium	Low
2.2.1.2 Technical Specifications — F-001
Aspect	Specification
Input Parameters	PropertyInput Zod schema: title (min 3), description, type (enum 10), status (enum 4), city, province, country (default "España"), prices in EUR, areas, amenity booleans, tags[]
Output / Response	Property row including media[], listings[], priceHistory[] on detail GET
Performance Criteria	List query backed by composite indexes (city, province), (type, status), currentPrice; sub-second response on catalogs < 1000 rows
Data Requirements	Property table cascade-deletes children; ownerId ON DELETE SET NULL
2.2.1.3 Validation Rules — F-001
Aspect	Rule
Business Rules	Title minimum 3 chars; default country "España"; default status FOR_SALE
Data Validation	EnergyRating ∈ {A,B,C,D,E,F,G,UNKNOWN}; PropertyType ∈ {HOUSE, PISO, ATICO, CHALET, DUPLEX, ESTUDIO, LOFT, LOCAL, TERRENO, OTRO}
Security Requirements	Every mutation gated by ensureOwner(id, ownerId); cross-owner access returns 404
Compliance Requirements	None — personal data only
2.2.2 F-002: Multi-portal Listing Tracking Requirements
2.2.2.1 Requirement Details — F-002
Field	F-002-RQ-001	F-002-RQ-002
Description	Multiple listings per property	URL uniqueness constraint
Acceptance Criteria	Listing.propertyId foreign key with cascade delete; one Property → many Listings	DB-level unique constraint on url; duplicate POSTs perform upsert
Priority	Must-Have	Must-Have
Complexity	Low	Low
2.2.2.2 Technical Specifications — F-002
Aspect	Specification
Input Parameters	Listing payload from import flow (F-011) or scraping (F-007)
Output / Response	Listing row with (portal, status) indexed
Performance Criteria	Composite index enables portal-status filtering in dashboard groupBy
Data Requirements	Portal enum (10 values); ListingStatus enum (6 values)
2.2.3 F-003: Historical Price Tracking Requirements
2.2.3.1 Requirement Details — F-003
Field	F-003-RQ-001	F-003-RQ-002
Description	Insert PriceSnapshot on price change	Reject prices outside 0.5x–2x prior price
Acceptance Criteria	Snapshot created with price, source portal, observedAt; Property.currentPrice updated	isReasonablePriceChange returns false; event logged with ok: false
Priority	Must-Have	Must-Have
Complexity	Low	Medium
2.2.3.2 Technical Specifications — F-003
Aspect	Specification
Input Parameters	New price (integer cents), source portal, previous price for sanity check
Output / Response	New PriceSnapshot row
Performance Criteria	Composite index (propertyId, observedAt) for chart range queries
Data Requirements	Sanity bands: isValidPriceEur 10,000–50,000,000; isValidBuiltArea 5–5,000; isValidYear 1700–(year+5)
2.2.4 F-004: Web Authentication Requirements
2.2.4.1 Requirement Details — F-004
Field	F-004-RQ-001	F-004-RQ-002
Description	Issue magic link via email	24-hour token validity
Acceptance Criteria	HTML + text Resend email with angle-bracketed <URL> text version; console fallback if RESEND_API_KEY unset	maxAge: 24 * 60 * 60 enforced server-side
Priority	Must-Have	Must-Have
Complexity	Medium	Low
2.2.4.2 Technical Specifications — F-004
Aspect	Specification
Input Parameters	Email address
Output / Response	Verification email; redirect to /login?check=email
Performance Criteria	Token generation via crypto.getRandomValues(32 bytes)
Data Requirements	NextAuth tables: User, Account, Session, VerificationToken
2.2.4.3 Validation Rules — F-004
Aspect	Rule
Business Rules	Custom pages signIn: "/login", verifyRequest: "/login?check=email"
Data Validation	Email format validated by NextAuth
Security Requirements	JWT session strategy for Edge middleware; trustHost: true; AUTH_SECRET required
Compliance Requirements	None
2.2.5 F-005: Mobile Authentication Requirements
2.2.5.1 Requirement Details — F-005
Field	F-005-RQ-001	F-005-RQ-002
Description	Issue 6-digit OTP via POST /api/auth/mobile/request	Verify OTP and return JWT via POST /api/auth/mobile/verify
Acceptance Criteria	Email sent; token persisted with mobile: identifier; old tokens for identifier deleteMany; 10-minute expiry	Single-use (token deleted on use); returns { token, user: {id,email,name} }
Priority	Must-Have	Must-Have
Complexity	Medium	Medium
2.2.5.2 Technical Specifications — F-005
Aspect	Specification
Input Parameters	Request: email; Verify: email + 6-digit code
Output / Response	HS256 JWT; issuer "buysell-mobile"; expiration "90d"; sub = userId; payload includes email
Performance Criteria	OTP generated via crypto.randomInt; signing via jose HS256
Data Requirements	Reuses NextAuth VerificationToken table
2.2.5.3 Validation Rules — F-005
Aspect	Rule
Business Rules	Signed with AUTH_SECRET (same as NextAuth — single trust root)
Data Validation	Code is numeric 6-digit; identifier must match mobile: prefix
Security Requirements	Tokens stored client-side in expo-secure-store; CORS preflight via OPTIONS handlers
Compliance Requirements	None
2.2.6 F-006: Per-user Api Tokens Requirements
2.2.6.1 Requirement Details — F-006
Field	F-006-RQ-001	F-006-RQ-002
Description	Auto-create or retrieve user token	Resolve user from Bearer token
Acceptance Criteria	getOrCreateUserToken(userId) returns existing or creates with label "Bookmarklet"	resolveUserFromToken validates token, returns userId, updates lastUsed best-effort
Priority	Must-Have	Must-Have
Complexity	Low	Low
2.2.6.2 Technical Specifications — F-006
Aspect	Specification
Input Parameters	Bearer header or ?token= query parameter (via extractTokenFromRequest)
Output / Response	Resolved userId or null
Performance Criteria	Unique index on token enables O(1) lookup
Data Requirements	Token format: bs_ + 32 bytes hex (64 chars; 256 bits entropy)
2.2.6.3 Validation Rules — F-006
Aspect	Rule
Business Rules	One default token per user labeled "Bookmarklet"; additional tokens supported by schema
Data Validation	Token presence on /api/* triggers middleware bypass to Node runtime
Security Requirements	Random bytes from crypto.randomBytes(32); no token displayed in UI after creation
Compliance Requirements	None
2.2.7 F-007: Automated Portal Scraping Requirements
2.2.7.1 Requirement Details — F-007
Field	F-007-RQ-001	F-007-RQ-002
Description	Adapter chooses correct portal	Outcome typed as discriminated union
Acceptance Criteria	pickAdapter(url) matches via adapter.matches(url) boolean predicate	Returns ok / gone / blocked / error consumed by runner branching
Priority	Must-Have	Must-Have
Complexity	Low	Medium
Field	F-007-RQ-003	F-007-RQ-004
Description	Price extraction with fallback strategy	Detect anti-bot markers
Acceptance Criteria	Order: JSON-LD offers.price → CSS selectors → body regex (only if no prior price)	403/429 HTTP, captcha text → blocked; 404/410/retired text → gone
Priority	Must-Have	Must-Have
Complexity	High	Medium
2.2.7.2 Technical Specifications — F-007
Aspect	Specification
Input Parameters	URL, optional ScrapeContext with previousPriceCents
Output / Response	ScrapeOutcome discriminated union
Performance Criteria	Generic adapter shares retry and parsing logic across portals
Data Requirements	Sanity-checked candidate price must satisfy 0.5x–2x previous price band
2.2.8 F-008: Manual-only Portal Handling Requirements
2.2.8.1 Requirement Details — F-008
Field	F-008-RQ-001	F-008-RQ-002
Description	Three portals declared manualOnly	Runner bypasses scraping
Acceptance Criteria	Idealista, Milanuncios, Yaencontre return { kind: "blocked" } with reason	Runner updates only lastCheckedAt when adapter.manualOnly === true
Priority	Must-Have	Must-Have
Complexity	Low	Low
2.2.9 F-009: Playwright Browser Sidecar Requirements
2.2.9.1 Requirement Details — F-009
Field	F-009-RQ-001	F-009-RQ-002
Description	Expose HTTP endpoints for fetch and health	Anti-automation masking
Acceptance Criteria	GET /healthz and POST /fetch with { url, timeoutMs?, waitForLoad? }; success { ok, html, status, finalUrl }, failure { ok:false, error, code }	addInitScript hides navigator.webdriver, fakes plugins, sets navigator.languages = ["es-ES","es","en"]
Priority	Must-Have	Should-Have
Complexity	Medium	High
Field	F-009-RQ-003	F-009-RQ-004
Description	Bind to loopback only	Singleton browser with idle shutdown
Acceptance Criteria	Server bound to 127.0.0.1:SCRAPER_PORT (default 4201); refuses external connections	5-minute idle timeout closes browser; recreated when disconnected
Priority	Must-Have	Should-Have
Complexity	Low	Medium
2.2.9.2 Technical Specifications — F-009
Aspect	Specification
Input Parameters	URL and optional timeout/load hints
Output / Response	Rendered HTML body and final URL
Performance Criteria	Chromium configured with es-ES locale, Europe/Madrid TZ, 1366×768 viewport, Spanish UA
Data Requirements	None (stateless)
2.2.10 F-010: Catastro Integration Requirements
2.2.10.1 Requirement Details — F-010
Field	F-010-RQ-001	F-010-RQ-002
Description	Lookup by coordinates	Lookup by address
Acceptance Criteria	lookupByCoordinates(lat, lng) calls Consulta_RCCOOR (EPSG:4326)	lookupByAddress({province,city,street,number,sigla}) calls Consulta_DNPLOC; sigla normalized through SIGLA_MAP
Priority	Must-Have	Should-Have
Complexity	High	High
Field	F-010-RQ-003	F-010-RQ-004
Description	Score candidate refs by richness	Conservative writeback
Acceptance Criteria	Deduplicate, score, return best { ref, info, method, warnings }	Update yearBuilt, builtArea, address, floor only when target is NULL
Priority	Should-Have	Must-Have
Complexity	Medium	Low
2.2.10.2 Technical Specifications — F-010
Aspect	Specification
Input Parameters	Property with optional coordinates and/or address fields
Output / Response	CadastreInfo plus persisted floorplan Media(FLOORPLAN, CADASTRE)
Performance Criteria	XML parsing via fast-xml-parser; HTML responses surfaced as actionable errors
Data Requirements	OVCSWLocalizacionRC + OVCCallejero endpoints; lerr.err nodes with cod ≠ 0 throw with cod and des
2.2.11 F-011: Bookmarklet/userscript Import Requirements
2.2.11.1 Requirement Details — F-011
Field	F-011-RQ-001	F-011-RQ-002
Description	Generate per-user userscript with embedded token	Accept CORS import via Bearer token
Acceptance Criteria	/api/bookmarklet/[portal] returns Content-Type: application/javascript, Cache-Control: no-store, X-Generated-For: <userId>; portal slug allowlisted	/api/listings/import responds to OPTIONS preflight; Access-Control-Allow-Origin: *; Bearer-validated
Priority	Must-Have	Must-Have
Complexity	Medium	Medium
Field	F-011-RQ-003	F-011-RQ-004
Description	Validate import payload	Idempotent create-or-update by URL
Acceptance Criteria	ImportListingInput Zod schema with url (required), title (min 2), price EUR int, amenity booleans, images[]	Returns 201 (created) or 200 (updated)
Priority	Must-Have	Must-Have
Complexity	Medium	High
2.2.11.2 Technical Specifications — F-011
Aspect	Specification
Input Parameters	Userscript payload includes url, portal, externalId, title, description, price, type, location fields, areas, room counts, amenity booleans, energyRating, images[], features[]
Output / Response	`{ property, listing, status: "created"
Performance Criteria	Synchronous response returns before F-016 background work; user perceives <1s import
Data Requirements	Userscripts use GM_xmlhttpRequest (cross-origin), run at document-idle
2.2.12 F-012: 5-signal Duplicate Detection Requirements
2.2.12.1 Requirement Details — F-012
Field	F-012-RQ-001	F-012-RQ-002
Description	Score candidates across 5 signals	Persist suggestions above threshold
Acceptance Criteria	Cadastre exact = 100; phash overlap 1→35, 2→60, ≥3→90; title Jaccard ≥0.5→50, ≥0.7→75; geo <50m→55, +builtArea ≤5%→80	Score ≥ 60 → upsert MatchSuggestion; < 30 → discard; 30-59 → keep for diagnostics, not surfaced
Priority	Must-Have	Must-Have
Complexity	High	Medium
Field	F-012-RQ-003	F-012-RQ-004
Description	Apply weak-signal bonus	Limit candidate set size
Acceptance Criteria	If ≥ 2 weak signals (photo, title ≥0.5, geo <50m) present, add +15 (cap 95)	OR filter on cadastralRef/city/matching phash; max 50 candidates loaded
Priority	Should-Have	Must-Have
Complexity	Medium	Medium
2.2.12.2 Technical Specifications — F-012
Aspect	Specification
Input Parameters	Property ID; reads its phashes, cadastralRef, slug, lat/lng, builtArea
Output / Response	Array of { id, score, reasons[] }
Performance Criteria	Hamming distance via Brian Kernighan bit count; bigram Jaccard linear in token count
Data Requirements	Slugify drops 25 stopwords including portal names and property type words; tokens ≥ 2 chars; capped at 120 chars
2.2.12.3 Validation Rules — F-012
Aspect	Rule
Business Rules	MatchSuggestion unique on (sourceId, targetId); symmetric pairs treated independently
Data Validation	Phash Hamming ≤ 8 considered same image
Security Requirements	Both source and target must belong to same ownerId
Compliance Requirements	None
2.2.13 F-013: Property Merge Workflow Requirements
2.2.13.1 Requirement Details — F-013
Field	F-013-RQ-001	F-013-RQ-002
Description	Move listings and snapshots	Deduplicate media by phash
Acceptance Criteria	Listing.updateMany and PriceSnapshot.updateMany reassign propertyId from source to target	If source media phash matches any target media within Hamming ≤ 8, delete source media; else move
Priority	Must-Have	Must-Have
Complexity	Low	Medium
Field	F-013-RQ-003	F-013-RQ-004
Description	Backfill NULL target fields	Block auto-merge on safety violations
Acceptance Criteria	Whitelist of 24 fields; tags unioned; energyRating only overwritten if target = UNKNOWN	Auto-merge BLOCKED if price diff > 30% or me.type !== them.type, even at score ≥ 95
Priority	Must-Have	Must-Have
Complexity	Medium	Medium
2.2.13.2 Technical Specifications — F-013
Aspect	Specification
Input Parameters	POST /api/properties/{sourceId}/merge with { intoId: string }
Output / Response	{ movedListings, movedSnapshots, movedMedia, skippedDuplicateMedia }
Performance Criteria	Idempotent: returns zeros if source already deleted
Data Requirements	Source property row deleted at end of merge
2.2.13.3 Validation Rules — F-013
Aspect	Rule
Business Rules	Auto-merge blocked logged via ImportLogKind.MATCH with blocked: true
Data Validation	Both properties must belong to same owner
Security Requirements	Owner check before transaction; safety guards prevent destructive auto-merge across types or wildly different prices
Compliance Requirements	None
2.2.14 F-014: Field Borrowing Requirements
2.2.14.1 Requirement Details — F-014
Field	F-014-RQ-001	F-014-RQ-002
Description	Only borrow when candidate score ≥ 70	Only fill NULL/empty fields
Acceptance Criteria	MIN_SCORE = 70 constant gates the operation	Never replaces existing values; only writes where current is null or ""
Priority	Must-Have	Must-Have
Complexity	Low	Low
2.2.14.2 Technical Specifications — F-014
Aspect	Specification
Input Parameters	Property ID; borrows from top similar candidate
Output / Response	Count of fields filled; logged via ImportLogKind.BORROW_FIELDS
Performance Criteria	Single property update statement
Data Requirements	Whitelist: description, address, postalCode, neighborhood, latitude, longitude, rooms, bathrooms, builtArea, usableArea, plotArea, floor, yearBuilt, hasElevator, hasGarage, hasStorage, hasTerrace, hasFireplace, hasGarden, hasPool
2.2.15 F-015: Perceptual Hashing Requirements
2.2.15.1 Requirement Details — F-015
Field	F-015-RQ-001	F-015-RQ-002
Description	Compute 64-bit dHash for an image	Reject placeholder-sized images
Acceptance Criteria	Sharp resize to 9×8 grayscale; compare adjacent pixels per row; return 16-char hex	Returns null if image body < 1000 bytes
Priority	Must-Have	Should-Have
Complexity	Medium	Low
Field	F-015-RQ-003	F-015-RQ-004
Description	Hamming distance comparator	Backfill existing photos
Acceptance Criteria	Byte-by-byte XOR with Brian Kernighan bit count; threshold ≤ 8 for "same image"	npm run hash-photos processes all kind: PHOTO, phash: null rows
Priority	Must-Have	Should-Have
Complexity	Low	Low
2.2.15.2 Technical Specifications — F-015
Aspect	Specification
Input Parameters	Image URL or buffer
Output / Response	16-char hex hash or null on failure
Performance Criteria	800ms throttle between fetches in batch pipeline (F-016)
Data Requirements	HTTP fetch with browser-like UA, accepts AVIF/WebP/PNG/JPEG, Spanish Accept-Language
2.2.16 F-016: Background Enrichment Pipeline Requirements
2.2.16.1 Requirement Details — F-016
Field	F-016-RQ-001	F-016-RQ-002
Description	Execute 5-stage pipeline after import returns	Skip auto-merge for media-less re-imports
Acceptance Criteria	Stages run in order: dHash → Catastro → Geocode → BorrowFields → FindSimilar → optional AutoMerge	skipAutoMerge: !mediaRefreshed set when re-import had no new media
Priority	Must-Have	Should-Have
Complexity	High	Medium
Field	F-016-RQ-003	F-016-RQ-004
Description	Auto-merge at score ≥ 95 with safety guards	Log each stage outcome
Acceptance Criteria	If top score ≥ 95 and no safety guard triggered, auto-merge; else log MATCH event	Each stage emits a ImportLog row with ok boolean and meta JSON
Priority	Must-Have	Must-Have
Complexity	Medium	Low
2.2.16.2 Technical Specifications — F-016
Aspect	Specification
Input Parameters	Property ID, media refresh flag
Output / Response	None — fire-and-forget via void
Performance Criteria	Up to 60 photos per dHash batch; 800ms throttle between requests
Data Requirements	Stage skip conditions: dHash skipped per-photo if phash already set; Catastro skipped if cadastralRef set; Geocode skipped if coords set
2.2.17 F-017: Owner-scoped Dashboard Requirements
2.2.17.1 Requirement Details — F-017
Field	F-017-RQ-001	F-017-RQ-002
Description	Run 10 KPI queries in parallel	Render request-time only
Acceptance Criteria	Promise.all over 10 queries: active/sold/withdrawn counts, listings by portal, snapshots last 30d, pending matches, stale autom/manual, missing phash, €/m² top 8 cities	export const dynamic = "force-dynamic"
Priority	Must-Have	Must-Have
Complexity	Medium	Low
2.2.17.2 Technical Specifications — F-017
Aspect	Specification
Input Parameters	Authenticated session
Output / Response	Dashboard UI
Performance Criteria	Constants: STALE_DAYS = 7, MANUAL_PORTALS = ["IDEALISTA","MILANUNCIOS"]; €/m² query uses raw SQL with HAVING COUNT(*) >= 2, limit 8
Data Requirements	Owner-scoping via requireUserId on every query
2.2.18 F-018: Activity Timeline Requirements
2.2.18.1 Requirement Details — F-018
Field	F-018-RQ-001	F-018-RQ-002
Description	Load last 100 price snapshots	Classify direction and bucket by day
Acceptance Criteria	Owner-scoped via property join; ordered by observedAt desc	Directions: up, down, flat, sold; relative time labels in Spanish
Priority	Must-Have	Should-Have
Complexity	Low	Low
2.2.19 F-019: Global Search Requirements
2.2.19.1 Requirement Details — F-019
Field	F-019-RQ-001	F-019-RQ-002
Description	Minimum query length	Search 5 fields case-insensitively
Acceptance Criteria	Minimum 2 characters; shorter queries return empty	contains on title, city, neighborhood, address, cadastralRef
Priority	Must-Have	Must-Have
Complexity	Low	Low
Field	F-019-RQ-003	F-019-RQ-004
Description	Limit and order results	Augment with primary photo
Acceptance Criteria	Top 12 ordered by updatedAt desc	Each result includes one Media(kind: PHOTO) with lowest order
Priority	Must-Have	Should-Have
Complexity	Low	Low
2.2.20 F-020: Property Filtering And Sorting Requirements
2.2.20.1 Requirement Details — F-020
Field	F-020-RQ-001	F-020-RQ-002
Description	Parse filters from URL	Transform to Prisma WHERE
Acceptance Criteria	parseFilters(URLSearchParams) returns PropertyFilters with q/city/province/type/status/minPrice/maxPrice/minRooms/amenity flags	buildPropertyWhere(filters) returns Prisma.PropertyWhereInput
Priority	Must-Have	Must-Have
Complexity	Low	Medium
Field	F-020-RQ-003	F-020-RQ-004
Description	Sort options enumeration	View mode toggle
Acceptance Criteria	updatedAt-desc (default), createdAt-desc, currentPrice-asc, currentPrice-desc via parseSort	?view=grid → grid mode; otherwise table
Priority	Must-Have	Should-Have
Complexity	Low	Low
2.2.21 F-021: Listing Recheck Runner Requirements
2.2.21.1 Requirement Details — F-021
Field	F-021-RQ-001	F-021-RQ-002
Description	Single-listing recheck	Batch all-active recheck
Acceptance Criteria	Body { listingId } rechecks one listing	Empty body sweeps all listings with status ACTIVE/PRICE_DROP/PRICE_UP/UNKNOWN
Priority	Must-Have	Must-Have
Complexity	Medium	High
Field	F-021-RQ-003	F-021-RQ-004
Description	Outcome-driven status update	Pacing and ordering for batch
Acceptance Criteria	gone→ status REMOVED; blocked/error→ only lastCheckedAt; ok with sane price → status update + PriceSnapshot	Order by lastCheckedAt asc nulls first; 1-second setTimeout between requests
Priority	Must-Have	Should-Have
Complexity	Medium	Low
2.2.21.2 Technical Specifications — F-021
Aspect	Specification
Input Parameters	POST /api/listings/check with optional { listingId }
Output / Response	Per-listing summary { listingId, outcome, detail?, priceChanged?, previousPrice?, newPrice? }
Performance Criteria	maxDuration = 300 (5 minutes); progress callbacks (idx, total, summary)
Data Requirements	Sequential execution; no parallelism (avoids triggering anti-bot)
2.2.22 F-022: Mobile App Requirements
2.2.22.1 Requirement Details — F-022
Field	F-022-RQ-001	F-022-RQ-002
Description	Tab navigation with 4 visible + 1 hidden	Token storage on device
Acceptance Criteria	Tabs: index, matches, search, account, hidden explore	expo-secure-store (native) or localStorage (web fallback) under key buysell.mobile.token
Priority	Must-Have	Must-Have
Complexity	Medium	Low
Field	F-022-RQ-003	F-022-RQ-004
Description	Auth gating	Debounced search
Acceptance Criteria	_layout.tsx AuthGate redirects unauthenticated users to /login	250ms debounce; minimum 2 chars
Priority	Must-Have	Should-Have
Complexity	Low	Low
2.2.23 F-023: Media Management Requirements
2.2.23.1 Requirement Details — F-023
Field	F-023-RQ-001	F-023-RQ-002
Description	Media re-import policy	Phash preservation
Acceptance Criteria	Existing PHOTO with source PORTAL_SCRAPE deleted and recreated on re-import; USER_UPLOAD preserved	Existing phashes by URL preserved on recreation (avoid rehashing)
Priority	Must-Have	Should-Have
Complexity	Medium	Low
2.2.24 F-024: Import Log Requirements
2.2.24.1 Requirement Details — F-024
Field	F-024-RQ-001	F-024-RQ-002
Description	Append-only audit events	Non-blocking write
Acceptance Criteria	8 event kinds; mandatory ok boolean; optional message, meta JSON	logImportEvent swallows write errors after console diagnostic
Priority	Must-Have	Must-Have
Complexity	Low	Low
2.2.25 F-025: Geocoding Requirements
2.2.25.1 Requirement Details — F-025
Field	F-025-RQ-001	F-025-RQ-002
Description	Trigger only when coords missing	Throttle Nominatim
Acceptance Criteria	Runs only if latitude and longitude are NULL but address or city is available	Module-level rate limiter respects Nominatim usage policy
Priority	Must-Have	Must-Have
Complexity	Low	Medium
2.2.26 F-026: External Portal Search Links Requirements
2.2.26.1 Requirement Details — F-026
Field	F-026-RQ-001	F-026-RQ-002
Description	Build Google site: URLs per portal	Reverse image search helper
Acceptance Criteria	Returns URLs for 7 portals using TYPE_WORDS + PORTAL_WORDS cleaning	googleLensUrl(photoUrl) returns valid lens search URL
Priority	Could-Have	Could-Have
Complexity	Low	Low
2.2.27 F-027 & F-028 Proposed Requirements

These features are scaffolded but not implemented. Requirements documented for future planning visibility.

Aspect	F-027 (Floorplan AI)	F-028 (SavedSearch Runner)
Description	Generate SVG floorplan from photos via multimodal LLM	Periodically execute saved searches and alert on new matches
Acceptance Criteria	Persists Media(FLOORPLAN, AI_SKETCH); respects existing media model	Reads SavedSearch rows where active=true; updates lastRunAt
Priority	Could-Have	Could-Have
Complexity	High	Medium
2.3 Feature Relationships
2.3.1 Feature Dependency Map

The following diagram captures the code-level dependencies observed in import statements and call sites. It excludes external dependencies (Catastro, Nominatim, Resend, portals) and focuses on inter-feature coupling.

Discovery & UI

Duplicate Detection

Enrichment Pipeline

Import Subsystem

Property Data Core

Authentication Layer

F-017
Dashboard

F-018
Activity

F-019
Search

F-020
Filtering

F-026
External Search

F-022
Mobile App

F-024
Audit Log

F-012
5-Signal Match

F-013
Merge

F-016
Background Pipeline

F-010
Catastro

F-025
Geocoding

F-015
dHash

F-014
Borrow Fields

F-011
Userscripts

F-007
Auto Scraping

F-008
Manual Portals

F-009
Playwright

F-021
Recheck Runner

F-001
Property CRUD

F-002
Listings

F-003
Price History

F-023
Media

F-004
Web Auth

F-005
Mobile Auth

F-006
API Tokens

2.3.2 Integration Points
Integration Type	From Feature(s)	To Feature / Endpoint
HTTP API call (synchronous)	F-011 (userscript)	POST /api/listings/import
HTTP API call (synchronous)	F-021 (runner)	Adapter scrape(url)
HTTP API call (synchronous)	F-007 (adapter)	F-009 sidecar POST /fetch
HTTP API call (synchronous)	F-010 (lookup)	Catastro OVC XML services
HTTP API call (synchronous)	F-025 (geocode)	Nominatim REST
HTTP API call (synchronous)	F-004, F-005	Resend mail API
Edge middleware bypass	F-006	Any /api/* with Authorization: Bearer
Cross-runtime trust	F-004 + F-005	Shared AUTH_SECRET
Fire-and-forget invocation	F-011, F-021	F-016 background pipeline
Auto-merge trigger	F-016	F-013 at score ≥ 95
UI surface	F-012	Web /matches, mobile (tabs)/matches.tsx, F-017
2.3.3 Shared Components

The packages/shared/ workspace package exposes utilities consumed across the web app, mobile app, and scripts:

Module	Exports	Consumed By
packages/shared/src/sanity.ts	isValidPriceEur, isValidBuiltArea, isValidPlotArea, isValidYear, isReasonablePriceChange	F-003, F-007, F-011, F-021
packages/shared/src/similarity.ts	slugify, bigrams, jaccard, haversine	F-012
packages/shared/src/format.ts	Number, currency, and area formatters	F-001 UI, F-017, F-018, F-022
packages/shared/src/types.ts	Shared types for web ↔ mobile	F-022, all web features
2.3.4 Common Services
Service	Implementation Location	Used By
Owner identity resolution	src/lib/auth-helpers.ts (requireUserId)	All authenticated endpoints
Prisma client singleton	src/lib/db.ts (cached on globalThis in dev)	All DB operations
Import event logging	src/lib/import-log.ts (logImportEvent)	F-016 stages, F-021
Token resolution	src/lib/api-token.ts (extractTokenFromRequest, resolveUserFromToken)	F-011 import endpoint
HTTP fetch with sidecar fallback	src/features/scraping/http.ts, browser-fetch.ts	F-007 adapters
Validation schemas	src/lib/validators.ts (PropertyInput, ImportListingInput)	F-001, F-011
Filter parsing	src/lib/filters.ts (parseFilters, buildPropertyWhere)	F-020, F-001
2.3.5 Api Endpoint Inventory

The following API endpoints implement the features above. Each is owner-scoped except where noted.

Endpoint	Methods	Feature
/api/properties	GET, POST	F-001
/api/properties/[id]	GET, PATCH, DELETE	F-001
/api/properties/[id]/similar	GET	F-012
/api/properties/[id]/merge	POST	F-013
/api/properties/[id]/cadastre	POST	F-010
/api/properties/[id]/dismiss-match	POST	F-012
/api/listings/import	POST, OPTIONS (CORS *)	F-011
/api/listings/check	POST (maxDuration 300s)	F-021
/api/search	GET	F-019
/api/matches	GET	F-012
/api/bookmarklet/[portal]	GET (returns .user.js)	F-011
/api/auth/[...nextauth]	GET, POST	F-004
/api/auth/mobile/request	POST, OPTIONS	F-005
/api/auth/mobile/verify	POST, OPTIONS	F-005
2.4 Implementation Considerations

This subsection captures cross-cutting non-functional concerns mapped to features. Constraints are stated as observable in the codebase; performance and scalability statements reflect the current single-user-active design with multi-tenant readiness.

2.4.1 Technical Constraints
Constraint	Affected Features	Source / Rationale
Node 20+ runtime	All web features	README.md declares Node 20+ requirement
TypeScript strict mode	All features	tsconfig.json strict settings; uniform across packages
Edge runtime restrictions	F-004 middleware portion	Only src/lib/auth-edge.ts (no Prisma, no Buffer) usable in Edge; full auth runs in Node
Playwright not bundled into Next.js	F-007, F-009	Playwright too heavy for serverless; runs as sidecar
Prisma client singleton in dev	All DB features	globalThis cache prevents hot-reload connection storms
JWT verification requires Buffer	F-005, F-006	jose HS256 verify uses Buffer; forces Node runtime on import/check endpoints
All FKs CASCADE on delete	F-001, F-002, F-003, F-023	Except Property.ownerId which is ON DELETE SET NULL
Local image storage	F-023	public/uploads/ only; R2 deferred per Section 1.3.3
Sale-only scope	F-001	Project explicitly excludes rentals (Section 1.3.3)
Spanish locale hardcoded	All UI features	<html lang="es">, default country "España", default province "Asturias"
EUR-only currency	F-001, F-003	Integer cents storage assumes single currency
2.4.2 Performance Requirements
Feature	Constraint	Mitigation in Place
F-001 list	< 1s on catalogs < 1000 rows	Composite indexes (city,province), (type,status), currentPrice
F-007 scraping	Avoid triggering anti-bot	Sequential processing, 1s pacing, Playwright fallback only when needed
F-009 sidecar	Memory pressure from long-lived browser	5-minute idle shutdown; singleton browser recreated on disconnect
F-011 import endpoint	Perceived latency < 1s	F-016 enrichment runs fire-and-forget after response
F-012 matching	Quadratic blowup on growing catalog	Candidate set filtered by cadastralRef/city/phash; max 50 candidates
F-015 dHash batch	Image fetch flooding	800ms throttle between fetches; max 60 photos per batch
F-017 dashboard	10 KPI queries in parallel	Promise.all; raw SQL for €/m² aggregate
F-019 search	No tsvector index	Acceptable on small catalog; Phase 2 GIN index planned per Section 1.3.3
F-021 batch recheck	5-minute API timeout	maxDuration = 300 set on route; sequential pacing
F-025 geocoding	Nominatim rate limits	Module-level throttle in geocode.ts
2.4.3 Scalability Considerations
Dimension	Current State	Forward-Looking Path
Catalog size	Optimized for personal scale (< 1000 properties)	tsvector full-text index, Redis cache, Meilisearch >10k items (per Section 1.3.3)
Background jobs	void fire-and-forget; no queue	pg-boss or Trigger.dev (per docs/ROADMAP.md)
Cron / scheduling	Manual npm run check-listings invocation	Decoupled cron service (per Section 1.2.1.2 gap matrix)
Image storage	Local filesystem	R2/Cloudflare migration planned
Real-time sync	Pull-based, no push	SSE/WebSocket layer deferred to Phase 2
Multi-tenant isolation	Schema-ready (every entity has ownerId); query-time scoping enforced	UI/sharing flow deferred
CI/CD	None	GitHub Actions deferred per Section 1.2.1.2
Cloud deployment	Docker Postgres local only	Production Dockerfile deferred per Section 1.2.1.2
2.4.4 Security Implications
Concern	Mitigation	Feature Scope
Owner data isolation	Every query filters by ownerId via requireUserId and ensureOwner helpers	All authenticated features
Token entropy	32 bytes (256 bits) random hex	F-006
Token transport	Bearer header preferred; ?token= query supported for userscripts	F-006, F-011
Session binding	JWT (NextAuth + Mobile) signed with AUTH_SECRET HS256	F-004, F-005
Cross-origin policy	CORS open * only on /api/listings/import (Bearer-validated)	F-011
Sidecar exposure	Bound to 127.0.0.1 only; refuses external connections	F-009
Magic link validity	24-hour expiration	F-004
OTP validity	10-minute expiration; single-use; old tokens cleared on new request	F-005
Scraping politeness	1s pacing, anti-automation masking only where needed	F-007, F-009
Email content safety	HTML + plaintext fallback; explicit angle-bracketed URLs	F-004, F-005
Auto-merge safety	Blocked at score ≥95 if price diff >30% or type mismatch	F-013
Sanity rejection	Price changes outside 0.5x–2x logged and rejected	F-003, F-007, F-021
2.4.5 Maintenance Requirements
Aspect	Mechanism
Schema evolution	Prisma migrations under prisma/migrations/; named with timestamp + description
Operational scripts	npm run check-listings, npm run hash-photos, npm run fix-prices, npm run claim-orphans, npm run scraper
Local development	npm run db:up/db:down for PostgreSQL container; npm run dev for Next.js on port 4200; npm run mobile for Expo
Migration provisioning	npm run db:migrate, db:generate, db:studio, db:seed
Backfill jobs	scripts/hash-existing-photos.ts for retrofitting phashes after F-015 introduction
Diagnostic surface	ImportLog table (F-024) records every enrichment outcome with meta JSON
Console fallback	Resend mail provider falls back to console when RESEND_API_KEY unset (F-004, F-005)
Manifest of features	docs/ROADMAP.md with priority indicators (🔴 Critical, 🟠 High, 🟡 Medium)
Documentation	README.md, CLAUDE.md, docs/ROADMAP.md collectively narrate intent and state
2.5 Traceability Matrix

The following matrices link features to their source artifacts and to higher-level capabilities described in Section 1. Use these to navigate from any requirement back to its codebase evidence or up to its business motivation.

2.5.1 Feature → Source Artifact Matrix
Feature ID	Primary Source	Database Model
F-001	src/app/api/properties/, src/lib/validators.ts	Property
F-002	prisma/schema.prisma lines 223-239	Listing
F-003	prisma/schema.prisma lines 241-253	PriceSnapshot
F-004	src/lib/auth.ts, src/middleware.ts	User, Account, Session, VerificationToken
F-005	src/lib/mobile-jwt.ts, src/app/api/auth/mobile/	VerificationToken (reused)
F-006	src/lib/api-token.ts	ApiToken
F-007	src/features/scraping/adapters/_genericAdapter.ts	n/a
F-008	src/features/scraping/adapters/{idealista,milanuncios,yaencontre}.ts	n/a
F-009	scripts/scraper-service.mjs	n/a
F-010	src/features/cadastre/lookup.ts	Property.cadastralRef, cadastralData
F-011	public/bookmarklet/*.user.js, src/app/api/bookmarklet/[portal]/route.ts, src/app/api/listings/import/route.ts	n/a
F-012	src/features/matching/find-similar.ts	MatchSuggestion
F-013	src/features/matching/merge.ts	mutates Property, Listing, Media, PriceSnapshot
F-014	src/features/matching/borrow-fields.ts	mutates Property
F-015	src/lib/dhash.ts, scripts/hash-existing-photos.ts	Media.phash
F-016	src/lib/import-listing.ts lines 455-630	logs to ImportLog
F-017	src/app/dashboard/page.tsx	reads all owner tables
F-018	src/app/activity/page.tsx	reads PriceSnapshot
F-019	src/app/api/search/route.ts, src/components/GlobalSearch.tsx, apps/mobile/app/(tabs)/search.tsx	reads Property, Media
F-020	src/lib/filters.ts, src/features/properties/FiltersSidebar.tsx	reads Property
F-021	src/features/scraping/runner.ts, src/app/api/listings/check/route.ts	mutates Listing, PriceSnapshot, Property
F-022	apps/mobile/app/, apps/mobile/lib/	n/a
F-023	src/features/properties/Gallery.tsx, src/lib/import-listing.ts lines 320-346	Media
F-024	src/lib/import-log.ts	ImportLog
F-025	src/lib/geocode.ts, src/lib/import-listing.ts lines 489-516	mutates Property
F-026	src/features/matching/external-search.ts	n/a
F-027	src/features/floorplan-ai/sketch.ts	(would write Media)
F-028	prisma/schema.prisma lines 297-307	SavedSearch
2.5.2 Feature → Capability Domain Matrix (per Section 1.2.2.1)
Capability Domain (Section 1.2.2.1)	Feature(s)
Property CRUD with rich attributes	F-001
Multi-portal listing tracking	F-002, F-008
Historical price snapshots with charting	F-003
Web authentication (magic-link)	F-004
Mobile authentication (OTP → JWT)	F-005
Automated portal scraping	F-007
Browser sidecar (Playwright HTTP service)	F-009
Catastro integration	F-010
Bookmarklet/userscript importers	F-011
5-signal duplicate detection + merge	F-012, F-013, F-014
Background enrichment pipeline	F-016
Owner-scoped dashboard with KPIs	F-017
2.5.3 Feature → Kpi Matrix (per Section 1.2.3.3)
KPI (Section 1.2.3.3)	Producing Feature(s)
Active properties (FOR_SALE), sold count, withdrawn count	F-001, F-017
Total listings, listings per portal	F-002, F-017
City average €/m² (top 8 cities)	F-001, F-017
Price snapshots in last 30 days	F-003, F-017
Stale automatic listings	F-021, F-017
Stale manual-portal listings	F-008, F-017
Pending duplicate match suggestions	F-012, F-017
Photos missing perceptual hash	F-015, F-017
2.5.4 Feature → Workflow Matrix (per Section 1.3.1.2)
Workflow (Section 1.3.1.2)	Implementing Feature(s)
Add property manually	F-001
Import from portal (auto-scrape)	F-007, F-011, F-016
Import via bookmarklet	F-006, F-011, F-016
Review duplicate suggestions	F-012, F-013
Recheck listings	F-021
Browse catalog	F-001, F-020
View price evolution	F-003
2.6 Assumptions And Constraints
2.6.1 Documented Assumptions
Assumption	Source
Single user is actively using the system; multi-tenant plumbing is in place but unused	Section 1.1.3
Spanish portals dominate the geography of interest; no plans for non-Spain markets	Section 1.3.2
Idealista, Milanuncios, and Yaencontre cannot be reliably scraped automatically	Section 1.2.1.1 and docs/ROADMAP.md
Catastro OVC will remain a stable public XML service	Section 1.2.1.3
The Resend free tier or paid plan is sufficient for the user's email volume	F-004, F-005 environment fallback design
Nominatim public API rate limits are respected with the existing module-level throttle	F-025
User has Tampermonkey/Greasemonkey/Violentmonkey installed for manual portal imports	F-011
The user's mobile app instance can reach EXPO_PUBLIC_API_URL (default a LAN IP)	F-022
AUTH_SECRET is the single trust root for both web and mobile sessions	F-004, F-005
Sale-only listings (no rentals)	Section 1.3.3
2.6.2 Hard Constraints
Constraint	Effect
EUR-only currency, integer cents storage	Cannot represent fractional cents or other currencies
Spanish UI, <html lang="es">	Cannot localize without significant rework
Default country "España", default province "Asturias"	Imports default to Spain unless overridden
Portal enum closed set (10 values)	Adding a portal requires schema migration
EnergyRating enum 8 values (A-G, UNKNOWN)	No partial ratings (e.g., A+)
PropertyType enum 10 values	New types require schema migration
MediaKind 5 values, MediaSource 5 values	New media classifications require schema migration
Listing.url UNIQUE constraint	Same URL across owners would conflict (multi-tenant concern)
Max 100 rows per list response	Pagination not implemented; deeper browsing requires filtering
Max 50 candidates in F-012 matching	Some edge cases may miss matches if candidate pool is large
5-minute API timeout on /api/listings/check	Very large batches require splitting
Playwright sidecar bound to 127.0.0.1	Must run on same host as Next.js for browser fallback
2.6.3 Version Tracking
Item	Version
Specification Section	2.0 (initial)
Application	0.1.0 (root package.json)
Prisma Schema	11 models, 8 enums
Migrations Applied	Init (20260518), Portals (20260519), Matching Fields (20260519), Match Suggestion (20260519), Import Log (20260519), Auth Tables (20260520)
Mobile App	Expo SDK 54.0.33, RN 0.81.5, Expo Router 6.0.23
Node Runtime	20+ required
PostgreSQL	17 (alpine container)
2.7 References
2.7.1 Files Examined
package.json — Root workspace declaration, dependencies, npm scripts mapping (dev, scraper, check-listings, hash-photos, fix-prices, claim-orphans, mobile)
apps/mobile/package.json — Mobile dependencies and Expo SDK version verification
.env.example — Environment variable contract (DATABASE_URL, AUTH_SECRET, NEXTAUTH_URL, RESEND_API_KEY, RESEND_FROM, EXPO_PUBLIC_API_URL, SCRAPER_PORT, SCRAPER_URL, CATASTRO_BASE_URL, ANTHROPIC_API_KEY)
docker-compose.yml — Local PostgreSQL 17 alpine container setup
prisma/schema.prisma — Complete data model: 11 models (User, Account, Session, VerificationToken, ApiToken, Property, Media, Listing, PriceSnapshot, MatchSuggestion, ImportLog, SavedSearch) and 8 enums
prisma/migrations/20260518190058_init/migration.sql — Initial schema baseline
prisma/migrations/20260519094949_add_portals/migration.sql — Addition of THINKSPAIN, INDOMIO, YAENCONTRE, HABITACLIA portals
prisma/migrations/[ID]/migration.sql — Media.phash and matching infrastructure
prisma/migrations/20260519135431_import_log/migration.sql — ImportLog table and ImportLogKind enum
prisma/migrations/[ID]/migration.sql — MatchSuggestion table
prisma/migrations/20260520181751_auth_tables/migration.sql — NextAuth/Auth.js Prisma adapter tables
src/middleware.ts — Edge auth middleware with public allowlist and Bearer-token bypass
src/lib/auth.ts — NextAuth v5 configuration with custom Resend email provider
src/lib/auth-edge.ts — Edge-safe NextAuth variant (no Prisma dependency)
src/lib/auth-helpers.ts — requireUserId, getUserId, ensureOwner helpers
src/lib/mobile-jwt.ts — HS256 JWT issue/verify for mobile (buysell-mobile issuer, 90d expiry)
src/lib/api-token.ts — getOrCreateUserToken, resolveUserFromToken, extractTokenFromRequest
src/lib/validators.ts — PropertyInput and ImportListingInput Zod schemas
src/lib/filters.ts — parseFilters and buildPropertyWhere
src/lib/import-listing.ts — 631-line import orchestration including importListing, postImportTasks, enrichInBackground
src/lib/dhash.ts — 64-bit perceptual hashing via Sharp
src/lib/import-log.ts — Non-blocking import event logger
src/lib/geocode.ts — Nominatim integration with module-level throttle
src/lib/db.ts — Prisma singleton client cached on globalThis
src/features/scraping/runner.ts — Single and batch recheck orchestrator
src/features/scraping/types.ts — PortalAdapter interface and ScrapeOutcome union
src/features/scraping/adapters/_genericAdapter.ts — Adapter factory shared by automated portals
src/features/scraping/adapters/_common.ts — Shared parsing/extraction utilities
src/features/scraping/adapters/{fotocasa,pisos,habitaclia,thinkspain,indomio}.ts — Five automated portal adapters
src/features/scraping/adapters/{idealista,milanuncios,yaencontre}.ts — Three manual-only adapters
src/features/scraping/http.ts — Direct HTTP fetch with anti-bot detection
src/features/scraping/browser-fetch.ts — Sidecar HTTP client
src/features/cadastre/lookup.ts — 387-line Catastro OVC integration
src/features/cadastre/types.ts — CadastreInfo type
src/features/matching/find-similar.ts — 5-signal scoring engine
src/features/matching/merge.ts — Property merge workflow
src/features/matching/borrow-fields.ts — Field borrowing from similar candidates
src/features/matching/external-search.ts — Google portal-scoped search URL generator
src/features/floorplan-ai/sketch.ts — Floorplan AI scaffold (throws not-implemented)
src/features/properties/PropertyForm.tsx — Create/edit property UI
src/features/properties/PriceHistoryChart.tsx — Recharts price history visualization
src/features/properties/Gallery.tsx — Media gallery component
src/features/properties/{FiltersSidebar,SortMenu,ViewToggle}.tsx — Catalog UI controls
src/features/properties/CadastreCard.tsx — Catastro data display
src/features/properties/SearchOtherPortalsButton.tsx — External search UI
src/features/matching/MatchesList.tsx — Match review queue UI
src/components/GlobalSearch.tsx — Web global search component
src/app/properties/page.tsx — Catalog listing page
src/app/properties/new/ — Property creation route
src/app/properties/[id]/ — Property detail/edit route
src/app/dashboard/page.tsx — 268-line dashboard with 10 parallel KPI queries
src/app/activity/page.tsx — Activity timeline
src/app/login/ — Login UI flow
src/app/bookmarklet/page.tsx — Bookmarklet/userscript download page
src/app/matches/ — Web matches review page
src/app/api/properties/route.ts — Property collection endpoint
src/app/api/properties/[id]/route.ts — Property detail endpoint
src/app/api/properties/[id]/similar/route.ts — Similar property suggestions
src/app/api/properties/[id]/merge/route.ts — Merge endpoint
src/app/api/properties/[id]/cadastre/route.ts — Catastro lookup endpoint
src/app/api/properties/[id]/dismiss-match/route.ts — Dismiss match suggestion
src/app/api/listings/import/route.ts — Import endpoint (CORS-open, Bearer-validated)
src/app/api/listings/check/route.ts — Recheck endpoint (maxDuration 300s)
src/app/api/search/route.ts — Global search endpoint
src/app/api/matches/route.ts — Match suggestion listing endpoint
src/app/api/bookmarklet/[portal]/route.ts — Dynamic userscript generator
src/app/api/auth/[...nextauth]/route.ts — NextAuth catch-all handler
src/app/api/auth/mobile/request/route.ts — Mobile OTP issuance
src/app/api/auth/mobile/verify/route.ts — Mobile OTP verification + JWT exchange
packages/shared/src/sanity.ts — Validation predicates (isValidPriceEur, isReasonablePriceChange, etc.)
packages/shared/src/similarity.ts — slugify, bigrams, jaccard, haversine
packages/shared/src/format.ts — Locale formatters
packages/shared/src/types.ts — Shared TypeScript types
apps/mobile/app.json — Expo manifest
apps/mobile/app/_layout.tsx — Root layout with AuthGate
apps/mobile/app/login.tsx — Two-step OTP login UI
apps/mobile/app/property/[id].tsx — Property detail screen
apps/mobile/app/modal.tsx — Modal route
apps/mobile/app/(tabs)/{index,matches,search,account,explore}.tsx — Tab screens
apps/mobile/lib/api.ts — HTTP client and auth endpoints
apps/mobile/lib/auth-context.tsx — Mobile auth state
apps/mobile/lib/secure-store.ts — Cross-platform secure token storage
scripts/scraper-service.mjs — Playwright sidecar HTTP server
scripts/hash-existing-photos.ts — phash backfill batch script
scripts/check-listings.ts — CLI invocation of recheck runner
public/bookmarklet/buysell-{fotocasa,idealista,pisos,habitaclia,yaencontre,thinkspain,indomio}.user.js — Seven Tampermonkey userscripts
public/bookmarklet/_buysell-common.js — Reference design document for userscripts
public/bookmarklet/idealista.js — Bookmarklet variant
README.md — Product description, stack, data model summary
CLAUDE.md — Original product brief
docs/ROADMAP.md — Phased roadmap, current state assessment, risks and mitigations
2.7.2 Folders Explored
src/ — Web app source tree
src/lib/ — Utility/infrastructure layer
src/app/ — Next.js App Router
src/app/api/ — API namespaces (properties, listings, auth, search, matches, bookmarklet)
src/app/api/properties/[id]/ — Property detail workflows including merge, similar, cadastre, dismiss-match
src/app/api/listings/ — Import and check endpoints
src/app/api/auth/mobile/ — Mobile OTP flow
src/app/api/bookmarklet/[portal]/ — Dynamic userscript generation
src/components/ — Shared UI components and design system
src/features/ — Domain modules (scraping, matching, properties, cadastre, floorplan-ai)
src/features/scraping/adapters/ — Ten portal adapters
src/features/matching/ — Duplicate detection and merge
src/features/cadastre/ — Catastro integration
src/features/properties/ — UI components for property management
prisma/ — Schema definition
prisma/migrations/ — Migration history
packages/ — Workspace packages container
packages/shared/src/ — Shared TypeScript source
apps/mobile/app/ — Expo Router routes
apps/mobile/app/(tabs)/ — Tab route group
apps/mobile/lib/ — Mobile infrastructure (API client, auth context, secure store)
public/bookmarklet/ — Tampermonkey userscripts and bookmarklet
scripts/ — Operational toolbox
2.7.3 Cross-references To Other Sections
Section 1.1.2 — Core Business Problem (motivates F-002, F-003, F-010, F-012)
Section 1.2.1.1 — Portal stratification (anchors F-007 vs F-008)
Section 1.2.1.2 — Current System Limitations (informs Section 2.4.3 scalability)
Section 1.2.1.3 — Integration with Existing Enterprise Landscape (anchors F-010, F-025, F-004, F-005)
Section 1.2.2.1 — Primary System Capabilities (mapped in Section 2.5.2)
Section 1.2.2.2 — Major System Components diagram (referenced by Section 2.3.1)
Section 1.2.2.3 — Core Technical Approach (anchors Section 2.4.1 constraints)
Section 1.2.3.2 — Critical Success Factors (priority indicators applied to feature priorities)
Section 1.2.3.3 — Key Performance Indicators (mapped in Section 2.5.3)
Section 1.3.1.1 — Must-Have Capabilities (priority anchor)
Section 1.3.1.2 — Primary User Workflows (mapped in Section 2.5.4)
Section 1.3.3 — Out-of-Scope Elements (anchors F-027, F-028 as Proposed and constrains Section 2.4 scalability)
Section 1.4 — References (extended in Section 2.7)
3. Technology Stack

This section catalogs the languages, frameworks, libraries, services, and tooling that compose the BuySell Asturias platform. All version numbers reflect what is currently declared in source manifests (package.json, apps/mobile/package.json, packages/shared/package.json, docker-compose.yml) and verified against feature implementations. The stack is deliberately uniform around a single-language (TypeScript) monorepo with one runtime persistence engine (PostgreSQL 17 via Prisma 6), enabling code reuse between the web and mobile surfaces through the @buysell/shared workspace package.

Deviation from the project's default technology stack: the boilerplate "default stack" (AWS, Flask/Python, Auth0, MongoDB, Langchain, native Swift/Kotlin/Objective-C, Electron) does not apply to this repository. The actual stack — described below — diverges intentionally. See Section 3.7 for the full mapping.

3.1 Programming Languages
3.1.1 Languages By Platform And Component

The codebase is overwhelmingly TypeScript, with three carefully scoped exceptions: ESM JavaScript for the Playwright sidecar (to keep it independent of the Next.js build), SQL for Prisma-generated migrations, and Tampermonkey-flavoured JavaScript for browser userscripts.

Component	Language	Declared Version	Anchor
Web application (Next.js)	TypeScript	^5.7.2	Root package.json devDependencies
Mobile application (Expo)	TypeScript	~5.9.2	apps/mobile/package.json devDependencies
Shared workspace package	TypeScript	inherits	packages/shared/tsconfig.json (target ES2022)
Operational scripts (tsx)	TypeScript	runtime ^4.19.2	scripts/check-listings.ts, hash-existing-photos.ts, claim-orphan-properties.ts, fix-corrupt-prices.ts
Playwright sidecar service	JavaScript ESM (.mjs)	Node 20+	scripts/scraper-service.mjs
Database migrations	SQL	PostgreSQL 17 dialect	prisma/migrations/*/migration.sql
Browser userscripts (Tampermonkey)	JavaScript	—	public/bookmarklet/*.user.js
Styling pipeline	CSS (PostCSS)	—	Tailwind-generated
3.1.2 Typescript Configuration
3.1.2.1 Strict-mode Configuration

TypeScript strict mode is enforced uniformly across every package. Three distinct tsconfig.json files govern compilation:

Root tsconfig.json — targets ES2022, strict: true, moduleResolution: bundler, jsx: preserve. Declares path aliases @/* → ./src/* and @buysell/shared → ./packages/shared/src/index.ts. Excludes apps/mobile from the web compilation graph.
Mobile apps/mobile/tsconfig.json — extends expo/tsconfig.base, retains strict mode, mirrors path aliases for @/* and @buysell/shared.
Shared packages/shared/tsconfig.json — target: ES2022, module: ESNext, moduleResolution: Bundler, strict: true, declaration: true, noEmit: true, isolatedModules: true.
3.1.2.2 Runtime And Compilation Constraints
Constraint	Source	Effect
Node 20+ required	README.md	Minimum runtime for Next.js 15 / React 19 / Expo SDK 54
TypeScript strict mode uniform	All tsconfig.json	Enforces null-safety; per Section 2.4.1
Edge runtime restrictions	src/lib/auth-edge.ts	Edge variants cannot use Prisma or Buffer; JWT verification therefore forces Node runtime on import/check endpoints
isolatedModules in shared	packages/shared/tsconfig.json	Ensures each file is a standalone module, compatible with Metro and Turbopack
3.1.3 Selection Rationale

TypeScript was chosen as the single language across all layers to:

Share types end-to-end between the web app, the mobile app, and the operational scripts through the @buysell/shared package (re-exported as five subpath entries: ./sanity, ./similarity, ./format, ./types, ./schemas).
Reduce cognitive switching — every domain module under src/features/ follows the same conventions as those under apps/mobile/.
Pair with Zod for boundary validation — runtime schemas defined in shared modules double as compile-time type sources via z.infer.
Stay portable across runtimes — the same source compiles for Next.js (server + browser), React Native (Hermes), and Node CLI execution via tsx.
3.2 Frameworks & Libraries
3.2.1 Core Web Framework Stack

The web application is a single Next.js 15 process unifying the UI, API routes, and edge middleware.

Library	Version	Role
next	^15.1.0	Next.js 15 App Router; unified UI + API runtime
react	^19.0.0	React 19 (server + client components)
react-dom	^19.0.0	DOM renderer
next-auth	^5.0.0-beta.31	Authentication (NextAuth v5 / Auth.js) with JWT session strategy
@auth/prisma-adapter	^2.11.2	NextAuth ↔ Prisma persistence adapter
@prisma/client	^6.1.0	Prisma ORM client
prisma (dev)	^6.1.0	Prisma CLI, codegen, Studio
3.2.1.1 Justification For Next.js 15 + React 19

Next.js 15 with the App Router was selected because it delivers a single runtime that handles server-rendered pages, API routes, and edge middleware. This collapses what would otherwise be three separate deployable surfaces (frontend, REST API, edge auth gateway) into one codebase under src/app/. React 19 is mandated by the Next.js 15 baseline and is reused on the mobile side via React Native 0.81.5, ensuring component idioms remain identical.

3.2.1.2 Next.js Build Configuration

The web build configuration (next.config.ts) declares three crucial settings that anchor the technology stack:

Configuration	Value	Rationale
outputFileTracingRoot	Pinned to project root	Correctly traces workspace dependencies in a monorepo
transpilePackages	["@buysell/shared"]	Forces the shared TypeScript package through Next's compiler
serverExternalPackages	["sharp"]	Keeps Sharp's native binaries out of the bundler
images.remotePatterns	**.idealista.com, **.fotocasa.es, **.pisos.com, **.milanuncios.com	Allowlist for next/image remote sources
3.2.2 Mobile Framework Stack

The mobile workspace (apps/mobile) is a managed Expo project using the Expo Router for file-based navigation. It is published as @buysell/mobile inside the npm workspace.

Library	Version	Role
expo	~54.0.33	Expo SDK 54
expo-router	~6.0.23	File-based routing
react-native	0.81.5	React Native runtime
react	19.1.0	React (mobile)
react-dom	19.1.0	React DOM for react-native-web exports
react-native-web	~0.21.0	RN-on-web rendering
@react-navigation/native	^7.1.8	Navigation primitives
@react-navigation/bottom-tabs	^7.4.0	Tab navigator
@react-navigation/elements	^2.6.3	Navigation building blocks
react-native-gesture-handler	~2.28.0	Gesture handling
react-native-reanimated	~4.1.1	Animations
[ID]	~5.6.0	Safe-area insets
react-native-screens	~4.16.0	Native screen containers
react-native-webview	~13.16.0	Embedded webview component
react-native-worklets	0.5.1	Worklets backing Reanimated
expo-constants	~18.0.13	Runtime constants
expo-font	~14.0.11	Custom font loading
expo-haptics	~15.0.8	Haptic feedback
expo-image	~3.0.11	Optimized image component
expo-linking	~8.0.11	Deep linking
expo-secure-store	~15.0.7	Encrypted token storage on device
expo-splash-screen	~31.0.13	Splash screen plugin
expo-status-bar	~3.0.9	Status-bar management
expo-symbols	~1.0.8	iOS SF Symbols
expo-system-ui	~6.0.9	System UI theming
expo-web-browser	~15.0.10	In-app browser
@expo/vector-icons	^15.0.3	Icon set
3.2.2.1 Expo Manifest Features

The Expo app manifest (apps/mobile/app.json) declares:

App name "BuySell Asturias", slug buysell-asturias, deep-link scheme buysell.
newArchEnabled: true — React Native New Architecture (Fabric + TurboModules).
iOS: supportsTablet: true.
Android: edgeToEdgeEnabled: true, adaptive icon configuration.
Web: output: static for static web export via react-native-web.
Plugins: expo-router, expo-splash-screen.
Experiments: typedRoutes: true (compile-time route checking), reactCompiler: true (React 19 compiler).
3.2.3 Supporting Libraries
3.2.3.1 Domain And Infrastructure Libraries (web)
Library	Version	Role
zod	^3.24.1	Runtime schema validation; bridges TS types and HTTP boundaries
cheerio	^1.2.0	Server-side HTML parsing for portal scrapers
fast-xml-parser	^5.8.0	XML parsing for Catastro OVC services (selected because Catastro JSON endpoints return inconsistent data)
playwright	^1.60.0	Headless Chromium driver; runs only in the sidecar, never bundled into Next.js
sharp	^0.34.5	Image processing pipeline for 64-bit dHash perceptual hashing (F-015); declared in serverExternalPackages because of native binaries
recharts	^2.15.0	Charts for price-history visualization (PriceHistoryChart.tsx)
resend	^6.12.3	Transactional email SDK (magic links + OTP)
@react-email/render	^2.0.8	React-based email templating
lucide-react	^0.469.0	Icon library for the web UI
clsx	^2.1.1	Class-name composition (wrapped by src/lib/cn.ts)
jose	transitive (via NextAuth)	JWT signing/verification (HS256) for the mobile token bridge
3.2.3.2 Styling Stack

The styling pipeline is fully utility-first.

Library	Version	Role
tailwindcss	^3.4.17	Utility-first CSS framework
postcss	^8.5.0	CSS processor
autoprefixer	^10.4.20	Vendor prefixing

The Tailwind configuration (tailwind.config.ts) scans ./src/**/*.{ts,tsx} and extends a semantic design-token layer powered by CSS custom properties (var(--bg), var(--surface), etc.), with custom radii, shadows, the Inter font family, and an eight-tier font-sizing scale.

3.2.3.3 Typescript Type Definitions
Package	Version	Scope
@types/node	^22.10.0	Root
@types/react	^19.0.0 (web) / ~19.1.0 (mobile)	Both workspaces
@types/react-dom	^19.0.0	Web
3.2.4 Shared Workspace Package

The packages/shared workspace exposes the universal contract between the web and mobile apps.

Package identity: @buysell/shared@0.1.0, private.
Subpath exports: ., ./sanity, ./similarity, ./format, ./types, ./schemas.
Peer dependency: zod ^3.24.0 (declared as a peer so each consumer pins a compatible major).
No runtime dependencies — deliberately lightweight to keep the dependency footprint small for mobile.
Capabilities: locale-aware formatting helpers, plausibility/sanity checks (price-range gates), similarity utilities (slugify, bigrams, Jaccard, haversine distance), and shared types.

The web app declares it in next.config.ts under transpilePackages: ["@buysell/shared"] so Next compiles the package directly from TypeScript source.

3.2.5 Major Choice Rationale Summary
Choice	Justification (per README.md, Section 1.2.2.3, Section 2.4)
Next.js 15 App Router + React 19	Unified UI + API in one runtime; supports server components and edge middleware natively
PostgreSQL 17 + Prisma 6	Relational integrity (cascade deletes, composite indexes, transactions for the merge workflow). Chosen explicitly over MongoDB for the multi-table aggregation model
NextAuth v5 (no Auth0)	Lightweight passwordless flow with magic links; JWT session strategy enables Edge middleware (Prisma is not Edge-compatible)
Custom mobile JWT via `jose`	Native mobile cannot use cookie-based NextAuth sessions; HS256 JWT signed with the same AUTH_SECRET bridges both worlds
Playwright as sidecar	next.config.ts comments document that Playwright is too heavy and binary-incompatible with Next.js bundling; it runs on port 4201 as a separate Node process
Sharp externalized	Native binaries require serverExternalPackages: ["sharp"] to escape the bundler
Cheerio + fast-xml-parser	Cheerio handles portal HTML; fast-xml-parser is used for Catastro OVC because its JSON endpoints are unreliable
Tailwind over component library	Custom semantic tokens accommodate the Spanish-language UI without theming-engine overhead
3.3 Open-source Dependencies
3.3.1 Package Registry And Workspace Topology
Aspect	Configuration
Registry	Public npm registry
Workspace manager	npm workspaces
Workspaces declared	["packages/*", "apps/*"] in root package.json
Lockfile	package-lock.json (root)
Workspace packages	@buysell/shared (resolved from packages/shared), @buysell/mobile (resolved from apps/mobile)
3.3.2 Dependency Inventory
3.3.2.1 Root Web Application Dependencies
Package	Version
@auth/prisma-adapter	^2.11.2
@prisma/client	^6.1.0
@react-email/render	^2.0.8
cheerio	^1.2.0
clsx	^2.1.1
fast-xml-parser	^5.8.0
lucide-react	^0.469.0
next	^15.1.0
next-auth	^5.0.0-beta.31
playwright	^1.60.0
react	^19.0.0
react-dom	^19.0.0
recharts	^2.15.0
resend	^6.12.3
sharp	^0.34.5
zod	^3.24.1
3.3.2.2 Root Devdependencies
Package	Version
@types/node	^22.10.0
@types/react	^19.0.0
@types/react-dom	^19.0.0
autoprefixer	^10.4.20
postcss	^8.5.0
prisma	^6.1.0
tailwindcss	^3.4.17
tsx	^4.19.2
typescript	^5.7.2
3.3.2.3 Mobile Workspace Dependencies

The mobile workspace pulls 28 runtime dependencies and 2 dev dependencies (@types/react ~19.1.0, typescript ~5.9.2). The complete runtime list is given in Section 3.2.2.

3.3.2.4 Shared Workspace Dependencies

The @buysell/shared package declares no runtime dependencies, only a peer dependency on zod ^3.24.0. This keeps the shared module slim for mobile bundling.

3.3.3 Compatibility Considerations
React 19 alignment: the web app (react ^19.0.0) and mobile app (react 19.1.0) both run on the React 19 major. The React Native New Architecture (newArchEnabled: true) requires React 19.
Zod peer pinning: shared package peer-depends on zod ^3.24.0; both consumers ship ^3.24.1, satisfying the peer range.
Next.js / Prisma: Prisma 6 is fully compatible with Next.js 15's server-only contexts; the client must remain in Node runtime (not Edge).
NextAuth beta: the project depends on a beta (5.0.0-beta.31); breaking changes may occur. The Edge variant in src/lib/auth-edge.ts is deliberately kept narrow to limit blast radius.
3.4 Third-party Services
3.4.1 External Apis And Integrations

The platform integrates with six external surfaces, each with carefully scoped responsibility.

Service	Purpose	Integration Method	Authentication
Catastro OVC (Spain)	Cadastral reference resolution via OVCSWLocalizacionRC and OVCCallejero	Public XML services parsed with fast-xml-parser	None — public
Resend	Magic-link delivery for web auth (F-004), OTP delivery for mobile auth (F-005)	REST SDK + API key	Bearer API key (RESEND_API_KEY)
Nominatim (OpenStreetMap)	Reverse and forward geocoding	Public REST API	None — identifiable User-Agent header "BuySell-Asturias/1.0" and ≥1s rate-limit enforced via module-level throttle in src/lib/geocode.ts
Anthropic API	Planned AI features (floorplan generation, scoring)	API key scaffolded in .env.example only	Not active — function generateSketchFromPhotos throws "pendiente de implementar" per Section 1.3.3
Real-estate portals (Fotocasa, Pisos.com, Habitaclia, ThinkSpain, Indomio)	Listing source data via scraping	HTTP fetch via Cheerio with optional Playwright sidecar fallback	None (anonymous scraping with browser-like headers)
Google Search	Portal-scoped site: searches (F-026)	URL generation only; no API call	None
3.4.1.1 Endpoint Reference
Endpoint	URL
Catastro coordinates lookup	https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC
Catastro callejero	https://ovc.catastro.meh.es/ovcservweb/OVCCallejero
Nominatim search	https://nominatim.openstreetmap.org/search
Playwright sidecar	http://127.0.0.1:4201 (loopback only, overridable via SCRAPER_URL)
3.4.2 Authentication Services

Authentication is implemented in-house using NextAuth v5 and a custom JWT bridge — there is no Auth0 integration, contrary to the default stack.

Component	Implementation	Library	Lifetime
Web cookie session	NextAuth v5 with a custom Resend email provider	next-auth ^5.0.0-beta.31 + @auth/prisma-adapter	NextAuth default (JWT session strategy)
Web Edge middleware	NextAuth Edge variant (src/lib/auth-edge.ts) without Prisma	next-auth	Same as above
Mobile Bearer JWT	Custom HS256 JWT, issuer buysell-mobile	jose	90 days
Per-user API tokens	Random prefix bs_ + 64 hex chars (256-bit entropy) for userscripts	Custom (src/lib/api-token.ts)	No expiry; revocable
OTP delivery	6-digit numeric code, single-use	Resend or console fallback	10 minutes
Magic-link delivery	32-byte hex token	Resend or console fallback	24 hours

The shared AUTH_SECRET environment variable is the single trust root: it both signs NextAuth's JWT cookies and the mobile HS256 tokens. The helper src/lib/auth-helpers.ts exposes getUserId() / requireUserId() that detect which session type is present.

3.4.3 Monitoring And Observability

There is no external monitoring service wired in. Observability is implemented locally:

Mechanism	Source	Scope
ImportLog table	F-024 — every enrichment outcome with meta JSON	Persistent diagnostic surface
Console logging	Sidecar (scripts/scraper-service.mjs), NextAuth fallback, scripts	Development-time
docs/ROADMAP.md	Lists APM/Sentry as out-of-scope	Forward-looking
3.4.4 Cloud Services

There is no cloud deployment yet. Per Section 1.2.1.2, the only containerized service is the local PostgreSQL 17 container declared in docker-compose.yml. All cloud topics — hosting, R2/Cloudflare image storage, managed Postgres — are deferred per docs/ROADMAP.md Phase 1.

3.4.5 Environment Variable Contract

The integration boundary is defined by .env.example:

Variable	Purpose
DATABASE_URL	PostgreSQL connection string (default postgresql://buysell:buysell@localhost:5432/buysell?schema=public)
ANTHROPIC_API_KEY	Reserved for future AI features
CATASTRO_BASE_URL	Overridable base URL for Catastro OVC
AUTH_SECRET	HS256 signing secret for NextAuth and mobile JWT
NEXTAUTH_URL	Public URL of the web app (default http://localhost:4200)
RESEND_API_KEY	API key for Resend email delivery
RESEND_FROM	Default From: address
EXPO_PUBLIC_API_URL	Mobile-side base URL for the API
SCRAPER_PORT	Sidecar port (default 4201)
SCRAPER_URL	Optional override for sidecar URL
3.5 Databases & Storage
3.5.1 Primary Database
Component	Specification
Engine	PostgreSQL 17 (alpine)
Deployment	Docker container (postgres:17-alpine)
Container name	buysell-postgres
Host : Port	localhost:5432
Credentials (dev)	buysell / buysell
Persistent volume	buysell-pgdata
ORM	Prisma 6 (@prisma/client ^6.1.0, CLI prisma ^6.1.0)
Provider lock	prisma/migrations/migration_lock.toml pins provider to postgresql
3.5.1.1 Data Model Summary

The schema (prisma/schema.prisma) declares 11 models and 8 enums:

Models: User, Account, Session, VerificationToken, ApiToken, Property, Media, Listing, PriceSnapshot, MatchSuggestion, ImportLog, SavedSearch.
Enums: PropertyType (10 values), PropertyStatus (4), EnergyRating (8: A–G + UNKNOWN), Portal (10), ListingStatus (6), MediaKind (5), MediaSource (5), ImportLogKind.
3.5.1.2 Migration History
Migration	Description
20260518190058_init	Initial schema baseline
20260519094949_add_portals	Adds THINKSPAIN, INDOMIO, YAENCONTRE, HABITACLIA
[ID]	Adds Media.phash and matching infrastructure
20260519135431_import_log	Introduces ImportLog table + ImportLogKind enum
[ID]	Introduces MatchSuggestion table
20260520181751_auth_tables	NextAuth Prisma adapter tables
3.5.2 Data Persistence Strategies
Strategy	Implementation
Singleton Prisma client	src/lib/db.ts caches the client on globalThis in development to survive hot-reload reconnections
Owner data isolation	Every domain entity carries an ownerId foreign key; queries are filtered through requireUserId and ensureOwner helpers
Cascade rules	All foreign keys CASCADE on delete except Property.ownerId, which is ON DELETE SET NULL
Price storage	Integer cents (EUR-only)
Append-only event log	ImportLog retains diagnostic outcomes across 8 event kinds
Composite indexes	(city, province), (type, status), currentPrice, (propertyId, observedAt), (sourceId, dismissedAt), (score, dismissedAt), (propertyId, createdAt), (kind, createdAt), (createdAt)
3.5.3 Caching Solutions

There is no caching layer in the current implementation. Per Section 2.4.3, Redis is deferred to Phase 2. The only in-memory cache today is the module-level Nominatim throttle in src/lib/geocode.ts, which is single-process.

3.5.4 Storage Services
Storage Surface	Current Implementation	Forward-Looking
Image media	Local filesystem public/uploads/	R2/Cloudflare migration deferred to Fase 1
Mobile secure storage	expo-secure-store on native; localStorage fallback on web (apps/mobile/lib/secure-store.ts)	—
Persistent DB volume	Docker volume buysell-pgdata	Managed Postgres TBD
3.6 Development & Deployment
3.6.1 Development Tools
Tool	Version	Purpose
tsx	^4.19.2	Direct TypeScript execution for scripts and seed
Prisma CLI	^6.1.0	Migrations, codegen, Studio GUI, seeding
Expo CLI	shipped via expo ~54.0.33	Mobile dev server and platform launchers
ESLint (Expo flat config)	eslint-config-expo/flat	Mobile linting
Next.js lint	next lint	Web linting
3.6.2 Npm Scripts
3.6.2.1 Root Workspace Scripts
Script	Command	Purpose
dev	next dev -p 4200	Web dev server on port 4200
build	next build	Production web build
start	next start -p 4200	Production web server
lint	next lint	ESLint over the web codebase
db:up	docker compose up -d	Start PostgreSQL container
db:down	docker compose down	Stop PostgreSQL container
db:migrate	prisma migrate dev	Apply migrations interactively
db:generate	prisma generate	Regenerate Prisma Client
db:studio	prisma studio	Launch Prisma Studio
db:seed	tsx prisma/seed.ts	Seed sample data
check-listings	tsx scripts/check-listings.ts	Recheck active listings
hash-photos	tsx scripts/hash-existing-photos.ts	Backfill perceptual hashes
fix-prices	tsx scripts/fix-corrupt-prices.ts	Repair malformed price data
scraper	node scripts/scraper-service.mjs	Start the Playwright sidecar
claim-orphans	tsx scripts/claim-orphan-properties.ts	Reassign orphaned properties
mobile	npm --workspace @buysell/mobile run start	Start Expo dev server
3.6.2.2 Mobile Workspace Scripts

apps/mobile/package.json declares the standard Expo trio (start, android, ios, web), each delegating to expo start with platform flags.

3.6.3 Build System
Build Layer	Tool / Configuration
Web bundling	Next.js 15 (Turbopack in dev, webpack in production)
Web build configuration	outputFileTracingRoot pinned to repo root; transpilePackages: ["@buysell/shared"]; serverExternalPackages: ["sharp"]
Mobile bundling	Metro (apps/mobile/metro.config.js) configured for monorepo: workspace root watched, multiple node_modules paths, disableHierarchicalLookup: true
CSS pipeline	PostCSS with Tailwind + Autoprefixer (postcss.config.mjs)
Script execution	tsx runtime for .ts operational scripts
3.6.4 Containerization
Container	State
PostgreSQL container	postgres:17-alpine via docker-compose.yml (local dev only)
Application container	No Dockerfile present. Production Dockerfile is a Fase 1 critical gap per Section 1.2.1.2
3.6.5 Ci/cd Status
Concern	Current State
GitHub Actions workflows	Absent — no .github/workflows/ directory; listed as a critical gap in Section 1.2.1.2
Deployment automation	None — deferred to docs/ROADMAP.md Fase 1
Static analysis in CI	Not configured
Test runs in CI	Not configured
3.6.6 Sidecar Architecture

The Playwright scraper sidecar deserves special attention because it is the only non-bundled runtime in the stack.

Aspect	Specification
Entry point	scripts/scraper-service.mjs
Bind address	127.0.0.1 only (refuses external connections by design)
Default port	4201 (overridable via SCRAPER_PORT)
Endpoints	GET /healthz, POST /fetch
Browser	Headless Chromium via Playwright, with anti-automation masking
Locale	es-ES, timezone Europe/Madrid, viewport 1366×768
Lifecycle	Singleton browser with 5-minute idle shutdown; SIGINT/SIGTERM hooks
3.6.6.1 Sidecar Boundary Diagram

External Portals

Sidecar Process (port 4201)

Next.js Process (port 4200)

Fotocasa

Pisos.com

Habitaclia

ThinkSpain

Indomio

HTTP Server
scripts/scraper-service.mjs

Playwright
Headless Chromium

API Route
src/app/api/...

browser-fetch.ts
src/features/scraping/

POST /fetch
127.0.0.1:4201

3.6.7 Integration Requirements Across Components
Integration	Mechanism
Shared types contract	Web and mobile both import from @buysell/shared via the workspace alias; Next.js transpiles it via transpilePackages
Path aliases	@/* resolves to ./src/* in both web (tsconfig.json) and mobile (apps/mobile/tsconfig.json)
Authentication trust root	The same AUTH_SECRET signs NextAuth JWT cookies (web) and HS256 mobile JWTs; src/lib/auth-helpers.ts bridges both surfaces
Mobile → Web API	Mobile reads EXPO_PUBLIC_API_URL and sends Authorization: Bearer <jwt> headers; default value is a LAN IP for development
Userscripts → API	Tampermonkey userscripts POST to /api/listings/import with Bearer API token; CORS open * only on that endpoint, validated by token
Edge middleware bypass	src/middleware.ts lets any Authorization: Bearer ... request on /api/* pass through to Node handlers because JWT verification requires Buffer (unavailable in Edge)
Scraping pipeline	HTTP fetch via http.ts first; falls back to Playwright sidecar via browser-fetch.ts on 403/429/captcha detection
Background enrichment	enrichInBackground in src/lib/import-listing.ts runs fire-and-forget post-response; no message queue (deferred per roadmap)
3.6.8 Stack Integration Overview

Development Tooling

Sidecar Runtime

Data & Storage

Shared Layer

Mobile Stack

Web Stack

Languages

npm workspaces

Docker Compose
local PG only

tsx 4.19
script runner

Playwright 1.60
port 4201

Sharp 0.34.5
perceptual hashing

Prisma 6.1

PostgreSQL 17 alpine

Local FS
public/uploads/

@buysell/shared
workspace package

Zod 3.24

Expo SDK 54.0.33

React Native 0.81.5
New Architecture

Expo Router 6.0.23

expo-secure-store

Next.js 15.1
App Router

React 19

Tailwind 3.4

NextAuth v5
+ Prisma adapter

TypeScript 5.7 / 5.9
strict mode

SQL
PostgreSQL 17 dialect

JS ESM
sidecar + userscripts

3.7 Deviations From The Default Technology Stack

The default stack supplied to the documentation pipeline does not describe this repository. The actual stack diverges as follows; deviations are intentional and rooted in the architectural decisions documented in Sections 1.2.2 and 2.4.

Default Stack Component	Actual Implementation	Disposition
AWS cloud platform	None — local Docker only	Deferred per Section 1.2.1.2
Docker (general)	Docker — only for the local PostgreSQL container	✅ Partially aligned
Terraform IaC	Not present	Not adopted
GitHub Actions CI/CD	Not present	Deferred per Section 1.2.1.2
Python primary backend language	TypeScript everywhere	Replaced
Flask backend framework	Next.js 15 (server + API routes unified)	Replaced
Auth0 authentication	NextAuth v5 + custom mobile HS256 JWT (via jose)	Replaced — see Section 3.4.2
MongoDB database	PostgreSQL 17 + Prisma 6	Replaced for relational integrity
Langchain AI framework	None — ANTHROPIC_API_KEY scaffolded but unused	Not yet active per Section 1.3.3
React with TypeScript (web)	React 19 + TypeScript	✅ Aligned
TailwindCSS	Tailwind CSS ^3.4.17	✅ Aligned
React Native with TypeScript	React Native 0.81.5 + TypeScript via Expo SDK 54	✅ Aligned
Swift / Kotlin / Objective-C	Not used — Expo manages native code	Not applicable
ElectronJS	Not present	Not adopted
3.8 Security Posture Of The Stack

Per Section 2.4.4, security implications of stack choices are explicit:

Concern	Mitigation Rooted in the Stack
Token entropy	32 bytes (256 bits) of random hex for API tokens (src/lib/api-token.ts)
Token transport	Authorization: Bearer preferred; ?token= query supported for userscripts only
Session binding	NextAuth + mobile JWT share AUTH_SECRET (HS256)
CORS surface	Open * only on /api/listings/import (Bearer-validated)
Sidecar exposure	Playwright sidecar bound to 127.0.0.1 only
Magic-link validity	24-hour expiration
OTP validity	10-minute single-use expiration
Scraping politeness	1-second pacing; anti-automation masking only when needed
Sanity rejection	Price changes outside 0.5x–2x logged and rejected
Auto-merge safety	Blocked at score ≥95 when price diff >30% or type mismatch
3.9 References
3.9.1 Repository Files Examined
package.json — Root npm workspace declaration, dependencies, scripts
apps/mobile/package.json — Mobile workspace dependencies (Expo SDK 54)
apps/mobile/app.json — Expo app manifest with plugins and experiments
apps/mobile/tsconfig.json — Mobile TypeScript configuration and path aliases
apps/mobile/metro.config.js — Metro bundler with monorepo support
apps/mobile/eslint.config.js — Expo ESLint flat config
apps/mobile/lib/api.ts — Mobile API client with Bearer token injection
apps/mobile/lib/secure-store.ts — expo-secure-store + localStorage fallback
packages/shared/package.json — Shared package manifest with subpath exports
packages/shared/tsconfig.json — Shared package TypeScript configuration
tsconfig.json — Root TypeScript configuration with path aliases and exclusions
next.config.ts — Next.js configuration (image allowlist, transpilePackages, serverExternalPackages)
tailwind.config.ts — Tailwind design system tokens
postcss.config.mjs — PostCSS with Tailwind + Autoprefixer
docker-compose.yml — Local PostgreSQL 17 alpine setup
.env.example — Environment variable contract
README.md — Project overview and declared runtime requirements
prisma/schema.prisma — Prisma datasource, generator, models, enums
prisma/migrations/migration_lock.toml — Provider lock
src/lib/auth.ts — Full NextAuth configuration with the custom Resend provider
src/lib/auth-edge.ts — Edge-safe NextAuth variant
src/lib/auth-helpers.ts — Web + mobile session bridge
src/lib/mobile-jwt.ts — HS256 JWT issuance via jose
src/lib/db.ts — Prisma singleton client
src/lib/api-token.ts — Per-user API token generation
src/lib/geocode.ts — Nominatim integration with module-level throttle
src/lib/dhash.ts — Sharp-based perceptual hashing
src/middleware.ts — Edge middleware with Bearer bypass
src/features/cadastre/lookup.ts — fast-xml-parser usage for Catastro
src/features/scraping/browser-fetch.ts — Sidecar HTTP client
scripts/scraper-service.mjs — Playwright sidecar with headless Chromium
3.9.2 Repository Folders Examined
/ (root) — Top-level configuration manifests
apps/ — Monorepo apps container
apps/mobile/ — Expo workspace
apps/mobile/lib/ — Mobile client utilities
packages/ — Workspace packages container
packages/shared/ — Shared TypeScript package
prisma/ — Database schema and migrations
prisma/migrations/ — Timestamped migration directory tree
public/ — Tampermonkey userscripts and bookmarklets
scripts/ — Operational toolbox (sidecar + maintenance scripts)
src/ — Web app source tree
src/lib/ — Utility and infrastructure layer
src/features/ — Domain modules
src/features/scraping/ — Scraping subsystem with adapters
3.9.3 Technical Specification Cross-references
Section 1.2 SYSTEM OVERVIEW — Confirmed stack versions table, primary capabilities, architectural patterns
Section 1.3 SCOPE — In/out-of-scope boundaries, essential integrations, deferred items
Section 2.4 IMPLEMENTATION CONSIDERATIONS — Technical constraints, performance requirements, scalability considerations, security implications
Section 2.6 ASSUMPTIONS AND CONSTRAINTS — Hard constraints, version tracking, documented assumptions
4. Process Flowchart

This section documents the end-to-end behavioral workflows of the BuySell Asturias platform, translating the feature catalog and architectural primitives established in Sections 1 and 2 into executable process diagrams. Every flowchart below is anchored to specific source artifacts in the repository and reflects the decision points, validation rules, persistence boundaries, and error handling behaviors observed in the code. The diagrams use Mermaid.js notation and follow the swim-lane convention of grouping actors (clients, edge layer, API routes, domain logic, data layer, sidecars, external services) into discrete subgraphs.

4.1 System Workflows
4.1.1 High-level System Workflow

The BuySell Asturias platform is composed of three client surfaces, an Edge auth gate, a Node-runtime API layer, a domain feature layer, a singleton Prisma data layer, an isolated Playwright sidecar process, and six external integration boundaries. The following diagram captures the canonical request paths and the fire-and-forget enrichment dispatch that sits behind every successful import.

External Services

Sidecar Process

Data Layer

Domain Features

Next.js API Routes (Node)

Edge Layer

Client Surfaces

Resend API

Nominatim/OSM

Catastro OVC

Real-Estate Portals

Playwright Service
127.0.0.1:4201

Prisma Singleton
src/lib/db.ts

PostgreSQL 17

importListing()
src/lib/import-listing.ts

checkListing /
checkAllActiveListings

findSimilar()
5-signal engine

mergeProperties()

postImportTasks
(fire-and-forget)

POST /api/listings/import

POST /api/listings/check
maxDuration 300s

/api/auth/*
+/api/auth/mobile/*

/api/properties/*

/api/matches

Auth Middleware
src/middleware.ts

Web Browser
Next.js 15 App

Expo Mobile App
apps/mobile/

Tampermonkey Userscripts
public/bookmarklet/

401 / Redirect

Authorized

Authorized

Public

Authorized

Authorized

Fire-and-forget

4.1.2 Authentication & Authorization Workflows

The platform implements a dual authentication model that bridges NextAuth cookie sessions (web) and HS256 Bearer JWTs (mobile) through a shared AUTH_SECRET trust root. A third token type — per-user API tokens with bs_ prefix — supports headless userscript imports. All three converge on the helper requireUserId() exposed by src/lib/auth-helpers.ts.

4.1.2.1 Edge Middleware Decision Flow

Every request that is not statically excluded by the matcher (excluding _next/static, _next/image, favicon, icon) traverses the Edge middleware (src/middleware.ts) before reaching any Node-runtime API handler. The middleware enforces a three-tier check: public allowlist → Bearer bypass → session validation.

Incoming Request

Path in public allowlist?
/login, /api/auth/*,
/api/listings/import,
/_next/*, /favicon.*, /icon.*

Authorization: Bearer ...
AND path matches /api/* ?

NextAuth session
cookie valid?

Path matches /api/* ?

NextResponse.next
delegate to Node handler

401 JSON
error: No autenticado

302 Redirect to
/login?callbackUrl=<pathname>

Yes

No

Yes

No

Yes

No

Yes

No

Key behaviors:

The Bearer bypass on /api/* does not validate the token at the Edge — validation is delegated to the Node-runtime handler via resolveUserFromToken() so that the Edge runtime remains Prisma-free.
verifyRequest redirects to /login?check=email while signIn lands on /login — both are public per the allowlist.
Unauthenticated API calls receive a JSON error with HTTP 401 rather than a redirect, so userscripts and the mobile client can parse the failure deterministically.
4.1.2.2 Web Magic-link Sequence (f-004)

NextAuth v5 is configured in src/lib/auth.ts with a custom EmailResendProvider implemented inline (avoiding the nodemailer dependency) and a JWT session strategy (trustHost: true) that allows the Edge middleware to verify cookies without database access. Tokens are 32-byte hex strings generated via crypto.getRandomValues(new Uint8Array(32)) and persist for 24 hours.

PostgreSQL
Resend
NextAuth Route
/api/auth/*
/login page
Browser
PostgreSQL
Resend
NextAuth Route
/api/auth/*
/login page
Browser
alt
[RESEND_API_KEY present]
[Fallback]
User
Open /login
GET /login
Submit email
POST /api/auth/signin/email
Generate 32-byte hex token
(crypto.getRandomValues)
INSERT VerificationToken
identifier=email, expires=+24h
POST email (HTML + plaintext,
angle-bracketed URL)
Magic-link email
console.log magic URL
302 → /login?check=email
Click link in email
GET /api/auth/callback?token=...
SELECT VerificationToken
+ DELETE (single use)
UPSERT User, set emailVerified
jwt callback: token.id = user.id
Issue HS256 JWT session
cookie
Set-Cookie + redirect to callbackUrl
User
4.1.2.3 Mobile Otp → Jwt Sequence (f-005)

The mobile flow trades the magic-link click for a 6-digit code entered in the Expo app. Codes are persisted in the same VerificationToken table as NextAuth but prefixed with "mobile:" to namespace them, expire in 10 minutes, and are consumed (deleted) on first successful verification. Successful verification issues an HS256 JWT with issuer "buysell-mobile" and 90-day expiry via src/lib/mobile-jwt.ts.

Syntax error in text
mermaid version 11.14.0
Original Mermaid Code:
sequenceDiagram
    actor User
    participant App as Expo App
    participant Req as POST /api/auth/mobile/request
    participant Ver as POST /api/auth/mobile/verify
    participant Resend
    participant DB
    participant JWT as mobile-jwt.ts

    User->>App: Enter email
    App->>Req: { email }
    Req->>Req: Zod validate email
    Req->>DB: prisma.user.upsert (signup-on-demand)
    Req->>DB: deleteMany VerificationToken WHERE identifier=email
    Req->>Req: randomInt(100000, 1000000) → 6-digit code
    Req->>DB: INSERT VerificationToken<br/>token=mobile:&lt;code&gt;, expires=+10min
    alt RESEND_API_KEY present
        Req->>Resend: POST OTP email
        Resend-->>User: 6-digit code
    else
        Req->>Req: console.log code
    end
    Req-->>App: 200 OK (CORS allowed)

    User->>App: Enter 6-digit code
    App->>Ver: { email, code }
    Ver->>Ver: Zod validate /^\d{6}$/
    Ver->>DB: SELECT VerificationToken<br/>WHERE identifier=email<br/>AND token=mobile:&lt;code&gt;
    alt Token not found
        Ver-->>App: 401 "Código incorrecto"
    else Token expired
        Ver->>DB: DELETE VerificationToken
        Ver-->>App: 401 "Código caducado"
    else Valid
        Ver->>DB: DELETE VerificationToken (one-time use)
        Ver->>DB: UPSERT User, set emailVerified
        Ver->>JWT: issueMobileJwt(userId, email)
        JWT-->>Ver: HS256 JWT (iss=buysell-mobile, exp=90d)
        Ver-->>App: { token, user: { id, email, name } }
        App->>App: expo-secure-store SET<br/>buysell.mobile.token
    end
4.1.3 Listing Import Workflow (f-011)

The listing import workflow is the platform's busiest write path. It is invoked by Tampermonkey userscripts that POST normalized listing JSON to POST /api/listings/import with a per-user Bearer bs_<64-hex> token. The endpoint is on the Edge middleware public allowlist (since the Bearer bypass cannot itself validate userscript tokens at the Edge) and validates the token in the Node handler.

The end-to-end sequence below covers token validation, Zod parsing, sanitization, the create-vs-update decision, and the fire-and-forget dispatch to the background enrichment pipeline.

postImportTasks
DB
@buysell/shared/sanity
importListing()
Zod (ImportListingInput)
api-token.ts
/api/listings/import
Userscript
(Tampermonkey)
postImportTasks
DB
@buysell/shared/sanity
importListing()
Zod (ImportListingInput)
api-token.ts
/api/listings/import
Userscript
(Tampermonkey)
opt
[priceChanged]
alt
[Sanity fail (outside 0.5x-2x)]
[Sanity pass]
opt
[priceCents != null]
alt
[Existing listing]
[New listing]
Fire-and-forget,
does not block response
alt
[Invalid]
[Valid]
alt
[Malformed JSON]
[Parsed]
alt
[Not resolved]
[userId resolved]
alt
[No token]
[Token present]
OPTIONS preflight
204 + CORS headers
POST + Authorization Bearer + JSON
body
extractTokenFromRequest(req)
401 (CORS)
resolveUserFromToken(token)
SELECT ApiToken WHERE token=...
401
best-effort UPDATE ApiToken.lastUsed
req.json()
400
ImportListingInput.safeParse(body)
400 + parsed.error.flatten()
importListing(data, { ownerId })
sanitizePayload
(isValidPriceEur, isValidBuiltArea,
isValidYear, lat/lng range, features fallback)
findFirst Listing WHERE url = X
isReasonablePriceChange
(prev, new)
Log RECHECK ok:false
touch lastSeen/lastChecked
existing (no update)
UPDATE Listing
(lastPrice, status, lastSeenAt)
INSERT PriceSnapshot
UPDATE Property.currentPrice
fillIfEmpty Property scalars
DELETE Media (PHOTO+PORTAL_SCRAPE)
preserve USER_UPLOAD
INSERT Media
preserve phash by URL
200 OK (updated)
INSERT Property
(nested: Media + Listing)
INSERT PriceSnapshot
201 Created
postImportTasks(propertyId,
{ skipAutoMerge: !mediaRefreshed })

Sanitization and create/update branching highlights:

sanitizePayload nulls any value failing the shared sanity validators (isValidPriceEur 10k–50M, isValidBuiltArea 5–5000, isValidYear 1700–year+5, lat/lng range). When primary fields are missing, it re-parses the features[] array to recover builtArea, usableArea, plotArea, rooms, bathrooms, yearBuilt, floor.
The "fillIfEmpty" pattern protects owner-edited fields: only null or empty values on the existing Property are overwritten.
Media refresh is destructive for PORTAL_SCRAPE photos only; USER_UPLOAD is preserved unconditionally, and phash values are migrated by URL identity so previously hashed photos do not need to be re-hashed.
The skipAutoMerge: !mediaRefreshed flag short-circuits Stage 5 of the enrichment pipeline on re-imports that don't change images, preventing redundant duplicate detection passes.
4.1.4 Background Enrichment Pipeline (f-016)

After every successful import, postImportTasks() (src/lib/import-listing.ts lines 455–575) executes five sequential enrichment stages in a fire-and-forget continuation. Each stage independently catches and logs its own exceptions to the ImportLog table so that a failure in one stage does not abort the subsequent stages.

Stage 5: MATCH / MERGE_AUTO

Stage 4: BORROW_FIELDS

Stage 3: GEOCODE

Stage 2: CATASTRO

Stage 1: HASH

opts.skipAutoMerge?

findSimilar candidates

top.score >= 95?

price diff > 30%
OR me.type != them.type?

Log MATCH
blocked: true, reason

mergeProperties
(propertyId, top.propertyId)

Log MERGE_AUTO
movedListings, Snapshots,
Media, skippedDuplicateMedia

Log MATCH
score + reasons[]

findSimilar → top candidate

score >= 70?

Fill NULL or empty:
19 whitelisted fields
(description, postalCode, coords,
rooms, bathrooms, areas, floor,
yearBuilt, 7 amenities)

Log BORROW_FIELDS
+ list of borrowed fields

lat AND lng both set?

address OR city?

geocodeAddress
1100ms throttle
Spain ES; UA BuySell-Asturias/1.0

Multiple query variants:
full address, city+province, ...

UPDATE Property.lat/lng

Log GEOCODE event

cadastralRef already set?

enrichProperty
(lat, lng, province, city, address)

Parallel attempts:
Consulta_RCCOOR (coords) +
Consulta_DNPLOC (address)

Score by richness
(addr+2, area+2, year+2,
use+1, floor+1)

Pick best score (or warning)

Consulta_DNPRC(ref)
for full record

HTML response
(not XML)?

throw 'datos no disponibles'

UPDATE Property
(NULL fields only:
yearBuilt, builtArea,
address, floor)

INSERT Media
(FLOORPLAN, CADASTRE)
if absent

Log CATASTRO event

Query Media where
kind=PHOTO AND phash IS NULL
take: 60

For each: dhashFromUrl
+ 800ms inter-photo throttle

size < 1000 bytes?

Skip (placeholder)

Sharp 9x8 grayscale
compare adjacent pixels
→ 16-char hex

UPDATE Media.phash

Log HASH event
ok count, fail count, total

postImportTasks propertyId, opts

Return; per-stage
exceptions swallowed + logged

Yes

No

Yes

No

Yes

No

Yes

No

No

Yes

No

Yes

Yes

No

No

Yes

Yes

No

4.1.5 Listing Recheck Workflow (f-021)

The recheck workflow is invoked via POST /api/listings/check (configured with export const maxDuration = 300 for a 5-minute Node runtime budget) and can operate in two modes: single-listing ({ listingId } body) or batch (empty body, processes all listings in ACTIVE/PRICE_DROP/PRICE_UP/UNKNOWN statuses ordered by oldest lastCheckedAt first with 1-second inter-listing pacing).

POST /api/listings/check
maxDuration: 300s

Body has listingId?

checkListing single

Query Listings
status IN ACTIVE, PRICE_DROP,
PRICE_UP, UNKNOWN
ORDER BY lastCheckedAt ASC
NULLS FIRST

Next listing?

setTimeout 1000ms
(anti-bot pacing)

Load Listing
from DB

pickAdapter url:
first adapter.matches=true

Adapter found?

Touch lastCheckedAt
outcome=error
'Sin adaptador'

adapter.manualOnly?

Touch lastCheckedAt
outcome=blocked
'Manual-only (anti-bot)'

adapter.scrape url
{ previousPriceCents }

outcome.kind

UPDATE Listing
status=REMOVED
+ touch lastCheckedAt

Touch lastCheckedAt only
(state preserved)

isReasonablePriceChange
0.5x – 2x?

Touch lastCheckedAt
Log RECHECK ok:false

Compute new status:
PRICE_DROP if lower,
PRICE_UP if higher,
else scrape-reported

UPDATE Listing:
status, lastPrice,
lastSeenAt (from scrape),
lastCheckedAt (now)

priceChanged?

INSERT PriceSnapshot
UPDATE Property.currentPrice

Outcome summary returned;
onProgress callback invoked

Yes

No

Yes

No

No

Yes

Yes

No

gone

blocked / error

ok

No

Yes

Yes

No

4.1.6 Scraping Adapter Selection And Escalation (f-007, F-008, F-009)

Each portal adapter implements the PortalAdapter contract (portal, matches, manualOnly?, scrape) and is registered in an ordered list in runner.ts. The generic adapter (_genericAdapter.ts) applies a three-tier price extraction strategy (JSON-LD → CSS → body regex) over content loaded by the loadPage helper, which transparently escalates from direct HTTP to the Playwright sidecar when anti-bot indicators are detected.

404 or 410

403 or 429

2xx OK

Yes

No

Yes

No

Yes

No

No or ECONNREFUSED

Yes

No

No

No

Yes

No

Yes

adapter.scrape url, opts

loadPage url
_common.ts

fetchPage url
http.ts
browser-like UA
15s default timeout

HTTP status

outcome=gone

Body matches
cf-chl-bypass / cloudflare /
captcha / just a moment /
datadome / verify human?

Body matches
anuncio retirado / no disponible /
caducado / no longer available /
propiedad vendida?

outcome=ok with HTML

BUYSELL_DISABLE_
BROWSER_FETCH=1?

browserFetchPage
POST 127.0.0.1:4201/fetch
30s+5s timeout

Sidecar 200 OK?

outcome=blocked
'usa el userscript'

Tier 1: priceFromJsonLd
offers.price or
offers.lowPrice

Tier 2: portal CSS
priceSelectors array

Tier 3: body regex
only if previousPriceCents == null
first match wins

Price found?

withinRange
0.5x – 2x of previous?

outcome=error

outcome=ok
price*100, status=ACTIVE,
title, observedAt=now

Manual-only short-circuit: Three adapters (Idealista, Milanuncios, Yaencontre) declare manualOnly: true and bypass loadPage entirely — they immediately return { kind: "blocked", reason: <portal message> } so no HTTP request is ever issued. The runner recognizes this flag (see Section 4.1.5) and updates only lastCheckedAt, prompting the user toward bookmarklet/userscript imports instead.

4.1.7 Duplicate Detection And Auto-merge Workflow (f-012, F-013, F-014)

The 5-signal duplicate detection engine (src/features/matching/find-similar.ts) scores candidate properties on a 0–100 scale and persists results as MatchSuggestion rows when the score crosses ≥ 60. During the import enrichment pipeline (Stage 5), any candidate scoring ≥ 95 also triggers an automatic merge — but only after a safety guard rejects suspicious matches (price diff > 30% or property type mismatch).

findSimilar propertyId

Candidate filter:
same cadastralRef
OR same city case-insensitive
OR phash overlap
NOT dismissed
NOT self
take 50

For each candidate

cadastralRef same?

phash matches >= 3?

phash matches == 2?

phash matches == 1?

geo < 50m AND
area diff <= 5%?

geo < 50m?

title Jaccard >= 0.7?

title Jaccard >= 0.5?

>= 2 weak signals
photo 1-2 OR title>=0.5 OR geo<50m?

100: Misma referencia catastral

90: 3+ fotos coincidentes

60: 2 fotos coincidentes

35: 1 foto coincidente

80: < 50m + areas casi iguales

55: a distancia < 50m

75: title Jaccard >= 0.7

50: title Jaccard >= 0.5

score += 15, cap at 95

Cap final at 100

Score band

Discard silently

Keep in returned list
NOT persisted

Upsert MatchSuggestion
preserve dismissedAt

Called from postImportTasks
AND top.score >= 95?

price diff > 30%?

type mismatch?

Log MATCH
blocked: true,
priceTooDifferent / typeMismatch

mergeProperties
source → target

Log MERGE_AUTO

Return

Yes

No

Yes

No

Yes

No

Yes

No

Yes

No

Yes

No

Yes

No

Yes

No

Yes

No

< 30

30 – 59

>= 60

No

Yes

Yes

No

Yes

No

4.1.7.1 Merge Execution Subflow

When invoked (either automatically by Stage 5 or manually via POST /api/properties/[id]/merge), mergeProperties performs a five-step destructive consolidation that is idempotent (returns zero counts when the source is already deleted). The merge is not wrapped in a Prisma $transaction — idempotency and per-step recoverability are favored over atomic rollback.

mergeProperties sourceId, targetId

sourceId == targetId?

throw error

Parallel load source and target

source found?

Return zero counts
idempotent

target found?

throw error

Step 1: updateMany Listing
propertyId source → target

Step 2: updateMany PriceSnapshot
propertyId source → target

Step 3: Move Media with dedup

Next source media?

Target has phash
with hamming <= 8?

DELETE source media
skippedDuplicateMedia++

UPDATE Media.propertyId
movedMedia++

Step 4: fillIfEmpty backfill
24-field whitelist
only NULL or empty target
EnergyRating: only if UNKNOWN
Tags: union

Step 5: DELETE source Property
CASCADE removes residuals

Return movedListings,
movedSnapshots, movedMedia,
skippedDuplicateMedia

Done

Yes

No

No

Yes

No

Yes

Yes

Yes

No

No

4.1.8 Dashboard Kpi Aggregation Workflow (f-017)

The dashboard at /dashboard is rendered server-side with export const dynamic = "force-dynamic" to guarantee fresh KPIs on every visit. After owner identity is established, ten queries fan out in parallel via Promise.all, recombining into the operational view consumed by Inventory, Por portal, Top €/m², and Necesita atención sections.

PostgreSQL
Prisma
auth-helpers.ts
dashboard/page.tsx
(force-dynamic)
Browser
PostgreSQL
Prisma
auth-helpers.ts
dashboard/page.tsx
(force-dynamic)
Browser
par
​
alt
[No session]
[userId resolved]
User
GET /dashboard
SSR request
requireUserId()
throw / redirect /login
Promise.all([Q1..Q10])
Q1 count Property status=FOR_SALE
Q2 count Property status=SOLD
Q3 count Property status=WITHDRAWN
Q4 groupBy Listing.portal
Q5 count PriceSnapshot last 30d
Q6 count MatchSuggestion
score>=60 dismissedAt=null
Q7 count stale Listing
(<lastCheckedAt - 7d)
NOT IN MANUAL_PORTALS
Q8 count stale Listing
IN MANUAL_PORTALS
(IDEALISTA, MILANUNCIOS)
Q9 count Media kind=PHOTO phash=null
Q10 raw SQL €/m² by city
HAVING COUNT(*) >= 2
result sets
KPI bundle
SSR HTML
User
4.1.9 Activity Timeline Workflow (f-018)

The /activity page loads the 100 most recent PriceSnapshot rows scoped to the owner via property join, ordered by observedAt desc. It then builds two maps — by-property (to resolve the previous snapshot for direction classification) and by-day (to group rendered sections) — and classifies each event as up / down / flat / sold. The sold classification has priority via the status === "SOLD" short-circuit. Relative time labels ("Hoy", "Ayer", "Hace N días", "Hace N sem.", or absolute date) come from the formatRelative helper.

4.2 Integration Workflows

This subsection documents the external boundary integrations enumerated in Section 3.4 from a process perspective: the sequences, decision points, and error degradation paths observed at each touchpoint.

4.2.1 Catastro Ovc Integration Sequence (f-010)

The Catastro integration in src/features/cadastre/lookup.ts queries Spain's official property registry through three public XML services. The enrichment attempt always runs both coordinate and address paths in parallel, scores the results by information richness, and proceeds with the winner. HTML responses (which Catastro returns when its public services are unavailable) are detected by content sniffing and surfaced as actionable errors.

DB
fast-xml-parser
Catastro OVC
lookup.ts
Stage 2 (CATASTRO)
DB
fast-xml-parser
Catastro OVC
lookup.ts
Stage 2 (CATASTRO)
par
[Coordinate Path]
[Address Path]
alt
[HTML response (service degraded)]
[XML response]
alt
[score == 0]
[has ref]
enrichProperty
(lat, lng, province, city, address)
GET Consulta_RCCOOR
EPSG:4326 lat,lng
XML response
Parse → candidate (RC + meta)
score by richness
(addr+2, area+2, year+2, use+1, floor+1)
parseAddress
(SIGLA_MAP: Calle→CL,
Avenida→AV, ...)
GET Consulta_DNPLOC
province + sigla + name
XML response
Parse → candidate
score by richness
Pick best (highest score)
result with warning
(rustic parcel?)
GET Consulta_DNPRC(ref)
detailed lookup
XML or HTML
throw 'Catastro devolvió HTML
(datos no disponibles)'
Parse detailed record
{ref, yearBuilt, builtArea, address, floor,
floorplanUrl}
UPDATE Property
(NULL fields only)
INSERT Media
(FLOORPLAN, CADASTRE)
if absent
Log CATASTRO event
(ok, meta)
4.2.2 Playwright Sidecar Integration (f-009)

The Playwright sidecar (scripts/scraper-service.mjs) is a Node HTTP server bound to 127.0.0.1:SCRAPER_PORT (default 4201) — loopback-only as a security boundary. The adapter layer escalates from direct HTTP to the sidecar only when an anti-bot indicator is detected, and degrades gracefully to a blocked outcome with a "usa el userscript" hint when the sidecar is not running (ECONNREFUSED).

Playwright
Chromium
Sidecar (4201)
browser-fetch.ts
Adapter
Playwright
Chromium
Sidecar (4201)
browser-fetch.ts
Adapter
alt
[404/410]
[403/429]
[OK]
alt
[Sidecar process not running]
[Sidecar reachable]
browserFetchPage(url, timeoutMs)
POST /fetch
{url, timeoutMs}
AbortSignal.timeout(+5s)
ECONNREFUSED
{ kind: blocked,
error: 'Scraper sidecar no está
arrancado (npm run scraper)' }
getBrowser() singleton
scheduleIdleClose 5min
browserContext.newPage()
UA + 1366x768 + es-ES + Europe/Madrid
addInitScript anti-automation
page ready
page.goto url
waitUntil=domcontentloaded
+ waitForLoadState networkidle
status response
{ kind: gone }
status response
{ kind: blocked }
content (HTML)
{ kind: ok, html, finalUrl }
page.close() + context.close()
outcome
4.2.3 Resend Email Integration

Resend is invoked from two distinct paths — NextAuth's custom EmailResendProvider (web magic-link) and the mobile OTP request endpoint — both of which share the same fallback behavior: if RESEND_API_KEY is not present, the message is written to console.log so that local development without an API key still produces working sign-ins.

Caller	Endpoint	Payload	Fallback
NextAuth (Web)	Resend REST	HTML + plaintext body with angle-bracketed callback URL to prevent linkifier injection	console.log magic URL
Mobile OTP request	Resend REST	6-digit code in plain Spanish template	console.log code
4.2.4 Nominatim Geocoding Integration (f-025)

The geocodeAddress helper in src/lib/geocode.ts is the sole caller of Nominatim and enforces an 1100 ms inter-request throttle via a module-level lastCall timestamp to remain within the public API's 1-request-per-second courtesy policy. Spain is enforced via countrycodes=es and Accept-Language: es, and the User-Agent identifies the application as BuySell-Asturias/1.0 (personal real estate app).

geocodeAddress
address, city, province, postalCode, country

Module-level throttle:
sleep until 1100ms since lastCall

Build query variants:
(1) full address + city + province
(2) city + province
(3) postal code + country
(...)

Next variant?

GET nominatim.openstreetmap.org/search
?q=...&countrycodes=es&format=json
UA: BuySell-Asturias/1.0
Accept-Language: es

Result array
non-empty?

Return {latitude, longitude, displayName}

Return null

Yes

Yes

No

No

4.2.5 Userscript ↔ Api Integration (f-011)

The userscripts in public/bookmarklet/buysell-<portal>.user.js are served per-user by GET /api/bookmarklet/[portal], which authenticates the requesting browser session, calls getOrCreateUserToken(userId), and dynamically injects const BUYSELL_TOKEN = "<token>"; into the script template along with an Authorization: "Bearer " + BUYSELL_TOKEN headers block. The response carries Content-Type: application/javascript, Cache-Control: no-store, and X-Generated-For: <userId> so that the userscript is never cached cross-user.

Syntax error in text
mermaid version 11.14.0
Original Mermaid Code:
sequenceDiagram
    actor User
    participant Browser
    participant BMRoute as /api/bookmarklet/[portal]
    participant Token as api-token.ts
    participant DB
    participant TM as Tampermonkey
    participant Portal as Portal Page<br/>(e.g., fotocasa.es)
    participant Import as /api/listings/import

    User->>Browser: Click "Download userscript"
    Browser->>BMRoute: GET /api/bookmarklet/fotocasa
    BMRoute->>BMRoute: requireUserId() (web session)
    alt VALID_PORTALS check fails
        BMRoute-->>Browser: 404
    else Valid
        BMRoute->>Token: getOrCreateUserToken(userId)
        Token->>DB: Find or INSERT ApiToken<br/>label="Bookmarklet"
        BMRoute->>BMRoute: Read public/bookmarklet/<br/>buysell-fotocasa.user.js
        BMRoute->>BMRoute: Inject const BUYSELL_TOKEN<br/>+ Authorization header
        BMRoute-->>Browser: .user.js (no-store)
    end
    Browser->>TM: Install userscript
    User->>Portal: Navigate to listing
    TM->>Portal: Inject @run-at document-idle<br/>+ MutationObserver
    TM->>Portal: Render floating button
    User->>TM: Click "📥 Importar a BuySell"
    TM->>TM: Extract data from __NEXT_DATA__,<br/>JSON-LD, breadcrumbs, meta,<br/>up to 80 deduped images
    TM->>Import: GM_xmlhttpRequest POST<br/>Authorization: Bearer + JSON
    Import-->>TM: 201 / 200 / 4xx
    TM->>Portal: Toast notification<br/>(success / price-change /<br/>media-refresh / network-error)
4.3 State Management

This subsection enumerates the explicit and implicit state machines in the system, the persistence points that materialize state transitions, and the caching strategies that mediate read paths.

4.3.1 Listing State Machine

The ListingStatus enum (ACTIVE, PRICE_DROP, PRICE_UP, SOLD, REMOVED, UNKNOWN) is the primary state machine driven by the recheck runner. Transitions are derived from the ScrapeOutcome discriminated union returned by the adapter layer.

ACTIVE

PRICE_DROP

PRICE_UP

SOLD

REMOVED

UNKNOWN

scrape blocked/error: state unchanged, lastCheckedAt only.
sanity-fail (outside 0.5x-2x): state unchanged, log RECHECK ok:false.

Import / Create

scrape ok, price decreased

scrape ok, price increased

scrape ok status=SOLD

scrape gone (404/410/text)

edge case

same price observed

price decreased

price increased

scrape gone

scrape ok SOLD

same price observed

price decreased

price increased

scrape gone

scrape ok SOLD

scrape ok recovered

Terminal

Terminal

4.3.2 Property State Machine

The PropertyStatus enum (FOR_SALE, RESERVED, SOLD, WITHDRAWN) is driven by user edits and by SOLD propagation from listings. New properties default to FOR_SALE on import.

Create / Import (default)

User edit

User edit or scrape SOLD propagation

User edit

Reservation cancelled

Sale completed

Reservation cancelled and listing pulled

Terminal

Re-listed

Terminal

FOR_SALE

RESERVED

SOLD

WITHDRAWN

4.3.3 Matchsuggestion Lifecycle

MatchSuggestion rows persist across import cycles via upsert on the unique (sourceId, targetId) constraint, which means dismissedAt is preserved across re-runs of findSimilar. The lifecycle distinguishes computed suggestions (in-memory only), persisted suggestions, dismissed suggestions, blocked auto-merges (kept as suggestions with blocked: true), and merged results (which delete the suggestion alongside the source property via CASCADE).

Computed

Discarded

Diagnostic

Pending

AutoMergeAttempt

Dismissed

Merged

Refreshed

Blocked

findSimilar runs

score < 30 (silent)

30 <= score < 60 (not persisted)

score >= 60 (upserted)

score >= 95 (import path)

POST /properties/[id]/dismiss-match

POST /properties/[id]/merge (manual)

Re-import re-runs findSimilar

dismissedAt preserved via upsert

price diff > 30% OR type mismatch

Safety guards pass

Persisted with blocked=true

4.3.4 Persistence Points And Transaction Boundaries

The system favors idempotency and per-step recoverability over strict atomicity. None of the multi-step workflows are wrapped in prisma.$transaction; instead, every operation is designed to be safely re-runnable.

Workflow	Persistence Points	Atomicity Strategy
Import (Create Path)	Nested Property + Media + Listing create (atomic per Prisma); conditional PriceSnapshot insert	Single nested create is atomic; snapshot insert is independent
Import (Update Path)	Listing update; conditional PriceSnapshot insert; fillIfEmpty Property update; Media re-create with phash preservation by URL	Sequential — no explicit transaction; fillIfEmpty semantics make repeat application safe
Recheck	Always update lastCheckedAt; conditional lastPrice, lastSeenAt, status; conditional PriceSnapshot and Property.currentPrice on priceChanged	Independent updates; sanity gate prevents anomalous writes
Merge	updateMany Listing → updateMany PriceSnapshot → loop Media with phash dedup → fillIfEmpty Property → delete source Property (CASCADE)	Idempotent: source-not-found returns zero counts; failures leave partial state recoverable on retry
Background Enrichment	One persisted change per stage (HASH writes Media.phash; CATASTRO writes Property NULL fields + FLOORPLAN media; GEOCODE writes lat/lng; BORROW_FIELDS writes whitelisted fields; MATCH writes MatchSuggestion)	Each stage is independently try/catch-protected; per-stage failure logged but does not abort pipeline
4.3.5 Caching Strategy

The platform deliberately avoids external caches (Redis is deferred per Section 1.2.3.2 critical success factors). Caching is instead implemented at the process level.

Cache	Location	Purpose	Lifetime
Prisma client singleton	src/lib/db.ts (globalThis cache in non-production)	Prevent hot-reload connection storms in dev	Process lifetime
Browser instance	scripts/scraper-service.mjs getBrowser()	Avoid Chromium startup cost between requests	5 minutes idle, then browser.close()
Nominatim throttle marker	src/lib/geocode.ts lastCall module variable	Enforce 1100 ms inter-call gap	Process lifetime
Userscript no-store	Cache-Control: no-store on /api/bookmarklet/[portal]	Prevent stale tokens after rotation	None (uncached)
Dashboard freshness	export const dynamic = "force-dynamic"	Guarantee live KPIs	None (uncached)
4.4 Error Handling Workflows
4.4.1 Error Classification And Handling

The platform classifies errors into six categories and applies distinct handling strategies to each. The classification is encoded in the ScrapeOutcome discriminated union for scraping operations (ok | gone | blocked | error) and in conventional try/catch boundaries elsewhere.

Error Categories

Timeout / Network
AbortError, ECONNREFUSED

Validation
Zod safeParse

Authentication
no session, bad token

Sanity violation
price band, area band

External service
Catastro HTML, Resend, portals

Database
constraint, deadlock

Any operation boundary

Browser sidecar escalation
(one shot, HTTP → Playwright)

Console fallback
(Resend → console.log)

400 Bad Request
+ parsed.error.flatten()

401 Unauthorized
'No autenticado' /
'Código incorrecto' / 'caducado'

500 + trimmed stack

logImportEvent
ok: false + meta JSON

console.error
swallow exception

State unchanged
touch lastCheckedAt only

status = REMOVED
(only on 'gone')

Still blocked

'gone'

4.4.2 Retry And Fallback Mechanisms

The platform implements no automatic retry loops in the scraper or the enrichment pipeline. Instead, the design favors:

One-shot browser escalation: A single HTTP→Playwright escalation per scrape attempt. If the sidecar also fails, the outcome degrades to blocked with an actionable user hint.
Anti-bot pacing: 1000 ms between batch listings, 800 ms between photo hashes, 1100 ms between Nominatim queries — these throttles substitute for retries.
Future-attempt resilience: Failed enrichment stages do not block subsequent imports — the next call to postImportTasks will re-attempt the same stage if the underlying data is still missing (e.g., cadastralRef IS NULL re-triggers Stage 2).
Retry Class	Mechanism	Where
Browser fallback	One escalation to Playwright sidecar	_common.ts loadPage
Resend → console	Implicit fallback when RESEND_API_KEY not set	auth.ts, mobile/request/route.ts
Catastro dual-path	Coordinate + address attempts always run; best score wins	cadastre/lookup.ts
Geocode query variants	Multiple query strings tried sequentially	geocode.ts
Sidecar dead detection	browser?.isConnected() re-launches singleton	scraper-service.mjs
4.4.3 Error Notification Flow

Operational error visibility is implemented through three coordinated mechanisms:

Notification Channels

Error Sources

Scraper outcomes
(blocked, error, gone)

Enrichment stage failures
(HASH, CATASTRO, GEOCODE,
BORROW_FIELDS, MATCH, MERGE_AUTO)

Recheck sanity failures

External service failures
(Resend, Nominatim, Catastro)

ImportLog table
append-only
ok flag + meta JSON
8 event kinds

Console diagnostics
(dev only)

Dashboard 'Necesita atención'
stale listings,
pending matches,
unhashed photos

Userscript toast
(transient client UI)

4.4.4 Recovery Procedures

Operational recovery is supported by command-line scripts exposed as npm-script aliases in package.json:

Script	Command	Purpose
Hash backfill	npm run hash-photos → scripts/hash-existing-photos.ts	Reprocesses photos with phash IS NULL, fixing dashboard "missing phash" alerts
Price cleanup	npm run fix-prices → scripts/fix-corrupt-prices.ts	Clears invalid currentPrice/lastPrice rows that escaped sanity validation
Orphan claim	npm run claim-orphans	Reassigns properties with ownerId IS NULL (from prior NextAuth schema migrations)
Manual batch recheck	npm run check-listings	Invokes checkAllActiveListings() with CLI progress logging — useful when the API route times out
Idempotent merge	n/a (built into mergeProperties)	Re-running a merge after partial failure returns zero counts if source is already gone
4.5 Validation Rules And Decision Points
4.5.1 Business Rules Per Workflow Step
Step	Rule	Source
Property create	Title minimum 3 characters	PropertyInput Zod schema
Property create	Country defaults to "España"	validators.ts
Property create (import)	Province defaults to "Asturias"	import-listing.ts
Property create (import)	City defaults to "Desconcida" if missing	import-listing.ts
Property create	Status defaults to FOR_SALE	prisma/schema.prisma
Property create	EnergyRating defaults to UNKNOWN	prisma/schema.prisma
All prices	Stored as integer cents (× 100 on submit, ÷ 100 on display)	validators.ts, throughout
Field borrowing	Only fills NULL or empty strings; never overwrites	borrow-fields.ts
Merge	EnergyRating only overwritten if target is UNKNOWN	merge.ts
Merge	Tags merged as union (deduplicated)	merge.ts
4.5.2 Data Validation Requirements

The shared package @buysell/shared/sanity exposes uniform validators consumed across the web, mobile, and script surfaces:

Validator	Acceptance Band	Used By
isValidPriceEur	10,000 ≤ p ≤ 50,000,000 EUR	F-003, F-007, F-011, F-021
isValidBuiltArea	5 ≤ a ≤ 5,000 m²	F-011 sanitize
isValidPlotArea	Plot-specific bounds	F-011 sanitize
isValidYear	1700 ≤ y ≤ currentYear + 5	F-011 sanitize
isReasonablePriceChange(prev, new)	New must lie within [0.5 × prev, 2.0 × prev]	F-007 generic adapter, F-011 import, F-021 runner
Mobile OTP regex	^\d{6}$	/api/auth/mobile/verify
API token length	≥ 16 characters	resolveUserFromToken
Search minimum query	≥ 2 characters	/api/search
Image minimum size	≥ 1000 bytes (placeholder filter)	dhashFromUrl
4.5.3 Authorization Checkpoints

Authorization is layered at four levels, each with its own concern:

Edge middleware (src/middleware.ts): Public allowlist OR Bearer header OR valid session.
Route handler entry (every authenticated endpoint): requireUserId() from src/lib/auth-helpers.ts resolves either a NextAuth session or a mobile JWT.
Owner scoping (every mutation on a Property): The ensureOwner(id, ownerId) pattern returns 404 (not 403, to avoid leaking existence) when the property is owned by a different user.
Cross-owner exposure guards (matching and merging):
Match suggestions filtered by sourceId IN (owner's property IDs) — cross-owner candidates are never surfaced.
Manual merge requires both source and target to belong to the same owner.
4.5.4 Auto-merge Safety Guards

The auto-merge path (Stage 5 of the enrichment pipeline) is the only place where the system performs destructive operations without human confirmation. It applies a defense-in-depth ladder:

Layer	Threshold	Effect on Violation
Score gate	top.score < 95	No merge attempted; suggestion persisted at score ≥ 60
Price diff	Math.abs(priceA - priceB) / Math.max(priceA, priceB) > 0.3	Block, log MATCH blocked: true, priceTooDifferent: true
Type mismatch	me.type !== them.type	Block, log MATCH blocked: true, typeMismatch: true
Skip flag	opts.skipAutoMerge === true (re-imports with no media refresh)	Entire match stage short-circuits
4.5.5 Regulatory And Operational Compliance

While the platform does not yet operate under any specific regulatory regime (it is a personal greenfield project per Section 1.2), several operational compliance behaviors are codified:

Nominatim courtesy throttle: 1100 ms inter-call enforcement to respect OpenStreetMap's 1 rps usage policy.
Identifiable User-Agent: BuySell-Asturias/1.0 (personal real estate app) per Nominatim's identification requirement.
Anti-bot citizenship: Manual-only adapters for Idealista, Milanuncios, Yaencontre prevent the system from triggering DataDome/Cloudflare defenses (Section 1.2.1.1).
One-time OTP enforcement: Verification tokens deleted on first successful match, preventing replay.
Sidecar loopback binding: 127.0.0.1:4201 ensures the Playwright service is not exposed beyond the host.
No-store on token-bearing responses: /api/bookmarklet/[portal] returns Cache-Control: no-store so that an embedded token never enters intermediary caches.
4.6 Timing And Sla Considerations

The system's timing behavior is composed of three categories: HTTP-level timeouts, inter-request throttles, and token lifetimes. All values are observed in the code and summarized below.

4.6.1 Timeout Inventory
Aspect	Value	Source
HTTP fetch timeout (direct)	15,000 ms	src/features/scraping/http.ts
Browser fetch timeout (sidecar call)	30,000 ms + 5,000 ms buffer	src/features/scraping/browser-fetch.ts
Sidecar browser idle close	5 minutes (scheduleIdleClose)	scripts/scraper-service.mjs
Recheck route maxDuration	300 seconds (5 minutes)	src/app/api/listings/check/route.ts
Web magic-link validity	24 hours	src/lib/auth.ts (maxAge: 24 * 60 * 60)
Mobile OTP validity	10 minutes	/api/auth/mobile/request/route.ts
Mobile JWT expiry	90 days	src/lib/mobile-jwt.ts (setExpirationTime("90d"))
Stale listing threshold	7 days	src/app/dashboard/page.tsx (STALE_DAYS = 7)
4.6.2 Throttling And Pacing Constraints
Throttle	Value	Source
Recheck inter-listing pacing	1,000 ms (1 s)	runner.ts
dHash inter-photo throttle	800 ms	import-listing.ts (Stage 1)
Nominatim inter-call throttle	1,100 ms	src/lib/geocode.ts
Mobile search debounce	250 ms	apps/mobile/app/(tabs)/search.tsx
4.6.3 Numeric Thresholds Governing Workflows
Threshold	Value	Purpose
Sanity price band	0.5× – 2× previous	isReasonablePriceChange
Photo hamming threshold (match)	≤ 8 (out of 64 bits)	PHOTO_HAMMING_THRESHOLD
Photo minimum size	1,000 bytes	dhashFromUrl (placeholder filter)
MatchSuggestion persist threshold	score ≥ 60	find-similar.ts upsert gate
MatchSuggestion discard threshold	score < 30	find-similar.ts
Field borrowing minimum score	70	borrow-fields.ts MIN_SCORE
Auto-merge trigger threshold	score ≥ 95	postImportTasks
Auto-merge price diff guard	> 30%	import-listing.ts
Candidate set cap	50 properties	find-similar.ts take: 50
dHash batch cap per import	60 photos	import-listing.ts take: 60
Userscript image extraction cap	80 deduplicated URLs	public/bookmarklet/buysell-*.user.js
Search result limit	12 (default)	/api/search
Property filter limit	100 rows	parseFilters / buildPropertyWhere
Activity feed limit	100 snapshots	src/app/activity/page.tsx
4.7 References
4.7.1 Technical Specification Sections Consulted
1.2 SYSTEM OVERVIEW — Architecture diagram, stack versions, and integration landscape grounding the high-level workflow.
2.1 FEATURE CATALOG — Feature IDs (F-001 through F-026) referenced inline across all workflows.
2.3 FEATURE RELATIONSHIPS — Inter-feature dependency edges informing the cross-cutting integration paths.
3.4 THIRD-PARTY SERVICES — External service endpoints and authentication contracts for Catastro, Resend, Nominatim, and the sidecar.
4.7.2 Source Files Examined
src/middleware.ts — Edge auth gate with public allowlist and Bearer bypass logic.
src/lib/auth.ts — NextAuth v5 setup with custom EmailResendProvider (24-hour token, JWT session strategy).
src/lib/auth-helpers.ts — getUserId / requireUserId dual-path resolver (web session + mobile JWT).
src/lib/mobile-jwt.ts — HS256 JWT issuance/verification with buysell-mobile issuer and 90-day expiry.
src/lib/api-token.ts — bs_-prefixed 256-bit token generation, resolution, and best-effort lastUsed update.
src/lib/db.ts — Prisma singleton cached on globalThis in development.
src/lib/import-listing.ts — Full import workflow including sanitizePayload, create/update branching, postImportTasks orchestrating 5 enrichment stages, and enrichInBackground Catastro coordinator.
src/lib/import-log.ts — Non-blocking append-only event logger with console.error exception swallowing.
src/lib/geocode.ts — Nominatim wrapper with 1100 ms throttle, query variants, and Spain-specific parameters.
src/lib/dhash.ts — 64-bit dHash algorithm via Sharp resize to 9×8 grayscale and Hamming distance helper.
src/lib/validators.ts — Zod schemas including PropertyInput and ImportListingInput.
src/middleware.ts — Edge runtime auth gate.
src/features/scraping/runner.ts — checkListing and checkAllActiveListings orchestrator with outcome dispatch.
src/features/scraping/types.ts — PortalAdapter contract and ScrapeOutcome discriminated union.
src/features/scraping/http.ts — Direct HTTP fetch with anti-bot status classification and content sniffing.
src/features/scraping/browser-fetch.ts — Sidecar HTTP client with ECONNREFUSED degradation.
src/features/scraping/adapters/_common.ts — loadPage HTTP→browser escalation logic.
src/features/scraping/adapters/_genericAdapter.ts — 3-tier price extraction (JSON-LD → CSS → body regex).
src/features/scraping/adapters/idealista.ts, milanuncios.ts, yaencontre.ts — Manual-only adapter stubs.
src/features/matching/find-similar.ts — 5-signal candidate filter, scoring, and threshold gating.
src/features/matching/merge.ts — 5-step destructive merge with phash dedup and fillIfEmpty backfill.
src/features/matching/borrow-fields.ts — Non-destructive enrichment with MIN_SCORE = 70 gate and 19-field whitelist.
src/features/cadastre/lookup.ts — Parallel coordinate/address Catastro resolution with richness scoring and HTML detection.
src/app/api/listings/import/route.ts — CORS preflight, token validation, Zod parsing, importer dispatch.
src/app/api/listings/check/route.ts — Single/batch recheck dispatcher with 5-minute maxDuration.
src/app/api/auth/mobile/request/route.ts — OTP generation, Verification token persistence, Resend dispatch.
src/app/api/auth/mobile/verify/route.ts — OTP verification, one-time consumption, JWT issuance.
src/app/api/properties/[id]/merge/route.ts — Manual merge endpoint with Zod body validation.
src/app/api/bookmarklet/[portal]/route.ts — Per-user userscript generation with token injection and no-store cache control.
src/app/dashboard/page.tsx — 10-query parallel KPI aggregation with force-dynamic rendering.
src/app/activity/page.tsx — Snapshot timeline with by-property/by-day classification and relative time labels.
scripts/scraper-service.mjs — Playwright sidecar with loopback binding, anti-automation init scripts, and 5-minute idle close.
scripts/hash-existing-photos.ts — Offline phash backfill recovery procedure.
scripts/fix-corrupt-prices.ts — Price sanitization recovery procedure.
prisma/schema.prisma — Complete data model including 8 enums, 11 models, indexes, and cascade rules.
public/bookmarklet/buysell-fotocasa.user.js — Representative userscript with GM_xmlhttpRequest, MutationObserver, and toast notifications.
packages/shared/src/sanity.ts — Cross-surface validators (isValidPriceEur, isValidBuiltArea, isValidYear, isReasonablePriceChange).
packages/shared/src/similarity.ts — slugify, bigrams, jaccard, haversine consumed by the matching engine.
4.7.3 Folders Explored
src/ — Web app source tree.
src/lib/ — Shared utility and infrastructure layer.
src/app/api/ — Next.js App Router API endpoint namespace.
src/app/api/listings/ — Import and recheck endpoints.
src/app/api/auth/mobile/ — Mobile OTP request/verify endpoints.
src/features/scraping/ — Scraping subsystem with adapter registry.
src/features/scraping/adapters/ — Per-portal adapter implementations.
src/features/matching/ — Duplicate detection, merge, and review UI.
src/features/cadastre/ — Catastro integration module.
scripts/ — Operational utilities (scraper sidecar, hash backfill, recheck CLI, price cleanup).
prisma/ — Schema, seed, and migrations.
public/bookmarklet/ — Per-portal userscripts and shared documentation reference.
apps/mobile/app/ — Expo Router tree with login, tabs, and property detail screens.
packages/shared/src/ — Cross-surface sanity and similarity helpers.
5. System Architecture
5.1 High-level Architecture
5.1.1 System Overview

BuySell Asturias is organized as a modular monolith with a Playwright sidecar, distributed across an npm-workspaces monorepo (package.json declares "workspaces": ["packages/*", "apps/*"]). A single Next.js 15 application encapsulates the user-facing pages, the JSON API, server components, and background orchestration; a dedicated Node process running Playwright Chromium handles anti-bot scraping behind a loopback HTTP interface; and an Expo/React Native mobile client shares business rules with the web through a TypeScript package. The entire system persists state in a single PostgreSQL 17 instance managed by Prisma.

The architectural intent is explicit and conservative: keep the deployable surface small, defer distributed-systems complexity until the user base warrants it, and isolate only the components that must be isolated (Playwright, because of binary weight and runtime constraints). The product targets a single-tenant operator, but every domain entity is multi-tenant-ready at the schema level (ownerId on Property, ApiToken, SavedSearch).

Architectural style is a layered composition of three patterns:

Modular monolith for the core web/API surface — feature modules are vertically sliced under src/features/ (scraping/, matching/, cadastre/, properties/, floorplan-ai/), each owning its types, helpers, and integration adapters.
Sidecar pattern for headless browser work — scripts/scraper-service.mjs runs a Playwright Chromium instance on 127.0.0.1:4201 and exposes a minimal POST /fetch endpoint; the web application calls it only after direct HTTP fetch returns a blocked outcome.
Polyglot client surface — packages/shared/ exposes sanity.ts, similarity.ts, format.ts, and types.ts consumed by both the web (next.config.ts transpilePackages: ["@buysell/shared"]) and the mobile app (workspace dependency).
5.1.1.1 Key Architectural Principles

The repository reveals five guiding principles applied consistently across modules:

Idempotency over atomicity. Both mergeProperties() (src/features/matching/merge.ts) and importListing() (src/lib/import-listing.ts) deliberately avoid prisma.$transaction. Each step is safe to re-run because steps are gated on null/empty columns or on existence checks. The 5-step merge can be interrupted at any point without leaving destructive partial state.
Fire-and-forget enrichment. After the synchronous portion of an import completes, void postImportTasks(propertyId) schedules a 5-stage background pipeline that runs without blocking the HTTP response. The pipeline is observable through ImportLog rows rather than tracked via a job queue.
Defaults over rejection. The import create-path defaults missing fields rather than returning a 4xx (city: payload.city ?? "Desconocida", province: payload.province ?? "Asturias", type: payload.type ?? "PISO", energyRating: payload.energyRating ?? "UNKNOWN"). Userscripts can always push partial data.
Edge bypass for Bearer tokens. src/middleware.ts short-circuits authentication for any /api/* request that carries an Authorization: Bearer header because the Edge runtime cannot perform HS256 verification (jose depends on Node Buffer). Validation is delegated to the Node-runtime route handler.
Sanity-first defensive computation. Every scraped price passes through isReasonablePriceChange (0.5x–2x band) before any DB mutation. Auto-merges are blocked when prices differ by more than 30% or types mismatch. These guards prevent destructive cascades from noisy scraper output.
5.1.1.2 System Boundaries

The system has four distinct trust and runtime boundaries:

Edge runtime (src/middleware.ts) — authentication gate; cannot use Prisma, Buffer, or HS256 JWT verification.
Node runtime (src/app/api/**/route.ts) — all API handlers, server components, server actions; full Node API surface including Prisma, jose, and sharp.
Sidecar process (scripts/scraper-service.mjs) — Playwright Chromium; bound explicitly to 127.0.0.1 with no authentication (host-level isolation only); idle-closes after 5 minutes.
External tier — Catastro OVC, Nominatim, Resend, and 8 Spanish real-estate portals; all reached over HTTPS.

The public surface (no authentication required) is limited to /login, NextAuth routes (/api/auth/*), the userscript import endpoint (/api/listings/import), and Next.js static assets. Every other route requires either a NextAuth cookie session, a mobile HS256 JWT, or a bs_-prefixed API token. CORS * is granted only on /api/listings/import and /api/auth/mobile/{request,verify} — all other endpoints are same-origin.

5.1.1.3 High-level Component Diagram

External Services (HTTPS)

Persistence

Sidecar Process

Next.js 15 Application (Single Deployable)

Client Surfaces

Cookie session

Bearer HS256 JWT

Bearer bs_token
CORS *

Allowed

Allowed

HTTP POST /fetch

Navigate

Direct HTTPS

XML/HTTPS

HTTPS + UA

SDK

Image serve

Web Browser
Next.js pages

Mobile App
Expo/React Native

Tampermonkey
Userscripts

Edge Middleware
src/middleware.ts

Node API Routes
src/app/api/**

Server Components
src/app/**/page.tsx

Domain Features
src/features/**

Prisma Singleton
src/lib/db.ts

Playwright Chromium
127.0.0.1:4201

PostgreSQL 17
buysell-postgres

public/uploads/
local filesystem

Catastro OVC
XML SOAP-style

Nominatim
OSM Geocoder

Resend
Email API

8 Real-Estate
Portals

5.1.2 Core Components

The following table enumerates the major architectural building blocks. All paths are relative to the repository root.

Component	Primary Responsibility	Key Dependencies	Critical Considerations
Web Application (src/)	Next.js 15 monolith serving pages, API, server components, and orchestrating background pipelines	Next.js 15.1, React 19, NextAuth 5 beta, Prisma 6, Tailwind 3.4, Zod, sharp, cheerio	Hosts three runtime tiers (Edge, Node, RSC); single-process Prisma singleton; dynamic = "force-dynamic" on read-heavy pages
Edge Middleware (src/middleware.ts)	Route-level authentication gate, public allowlist, Bearer bypass for /api/*	NextAuth v5 auth() from @/lib/auth-edge	Cannot import Prisma; cannot verify HS256 (no Buffer); must delegate Bearer to Node handlers
Authentication Subsystem (src/lib/auth.ts, mobile-jwt.ts, api-token.ts, auth-helpers.ts)	Issuance and verification of three token types (NextAuth JWT cookie, mobile HS256 JWT, bs_ API token)	next-auth ^5.0.0-beta.31, @auth/prisma-adapter, jose, resend	Shared AUTH_SECRET trust root; getUserId() cascades NextAuth → Bearer → mobile JWT
Scraping Subsystem (src/features/scraping/)	8 portal adapters + generic 3-tier price extractor + sidecar escalation	cheerio, fast-xml-parser (via cadastre), node:fetch	5 adapters operate over generic engine; 3 are manualOnly: true; HTTP→sidecar escalation gated by BUYSELL_DISABLE_BROWSER_FETCH
Playwright Sidecar (scripts/scraper-service.mjs)	Headless Chromium controller bound to loopback; serves GET /healthz and POST /fetch	playwright (Chromium), Node http	Bound to 127.0.0.1:4201; idle-closes after 5 min; anti-detection init scripts for navigator.webdriver, plugins, languages
Import Pipeline (src/lib/import-listing.ts)	Synchronous validation/persistence plus postImportTasks 5-stage enrichment	Prisma, dhash.ts, geocode.ts, cadastre/lookup.ts, borrow-fields.ts, find-similar.ts, merge.ts	Fire-and-forget continuation; each stage gated on NULL columns so re-imports re-trigger only missing work
Matching Engine (src/features/matching/)	5-signal similarity scoring (cadastre, phash, geo, area, title Jaccard); merge consolidation	Shared bigrams/jaccard/haversineMeters, sharp-derived phashes	Persists ≥ 60; auto-merge ≥ 95 with 30%-price + type-match safety guards
Cadastre Module (src/features/cadastre/lookup.ts)	Resolves Spanish cadastral references via coordinates AND address paths; fetches floorplan URLs	fast-xml-parser, node:fetch	XML responses (HTML on errors); parallel scoring of richness; never throws — returns warnings
Mobile Application (apps/mobile/)	Expo Router app with OTP login, dashboard, search, matches, account, property detail	expo ~54, expo-router ~6, expo-secure-store, react-native 0.81	New architecture enabled, typedRoutes, React Compiler; LAN-default API URL for dev
Shared Package (packages/shared/)	Cross-platform sanity validators, similarity primitives, formatters	TypeScript only	Consumed by web via transpilePackages; by mobile via workspace dependency
Database (PostgreSQL 17)	Single source of truth — 11 models, 8 enums, 6 migrations	postgres:17-alpine Docker image	All money as integer cents; cadastralData as JSON; native arrays for tags/matchDismissed/reasons; cascade-on-delete except Property.ownerId (SET NULL)
Userscripts (public/bookmarklet/)	7 portal-specific Tampermonkey scripts plus 1 legacy bookmarklet	Browser DOM, fetch API	Token injected server-side via /api/bookmarklet/[portal]; Cache-Control: no-store
Operational Scripts (scripts/)	CLI utilities: scraper-service.mjs, check-listings.ts, hash-photos.ts, fix-prices.ts, claim-orphans.ts, rewrite-imports.ts	tsx, Prisma	Manual recovery and backfill operations
5.1.3 Data Flow Description

The platform exhibits three primary inbound data flows and one significant background flow, all converging on a single PostgreSQL database. All inter-process communication is synchronous request/response over HTTP(S) — there is no message broker, event bus, websocket layer, or SSE channel.

5.1.3.1 Inbound Flow 1 — Userscript Import

The Tampermonkey userscripts running in the user's browser perform DOM extraction directly on portal pages (bypassing bot detection) and POST normalized JSON to POST /api/listings/import with Authorization: Bearer bs_<64-hex>. The endpoint, validated against the ImportListingInput Zod schema, invokes importListing(payload, {ownerId}). The synchronous portion either creates a new Property (with nested Media and Listing) or branches into an update path that respects the sanity band on price changes. The HTTP response (201/200) returns immediately while postImportTasks(propertyId) continues asynchronously.

5.1.3.2 Inbound Flow 2 — Server-side Recheck

POST /api/listings/check (with export const maxDuration = 300 for a 5-minute Node budget) iterates listings ordered by oldest lastCheckedAt, applying 1-second pacing between iterations. pickAdapter(url) returns the first matching PortalAdapter; if the adapter declares manualOnly: true (Idealista, Milanuncios, Yaencontre), only lastCheckedAt is touched. Otherwise, the adapter's scrape() runs through loadPage (direct HTTP → Playwright sidecar escalation on blocked) and feeds either the generic 3-tier price extractor or a portal-specific path. Sanity-passing price changes persist a PriceSnapshot and update the listing's status; sanity-failing changes touch only lastCheckedAt and log a RECHECK event with ok: false.

5.1.3.3 Inbound Flow 3 — Mobile Api

The Expo client (apps/mobile/lib/api.ts) constructs requests against EXPO_PUBLIC_API_URL (default http://192.168.1.77:4200 for LAN development) and attaches Authorization: Bearer <HS256-JWT> retrieved from expo-secure-store under the key buysell.mobile.token. JWTs are issued by POST /api/auth/mobile/verify (HS256, issuer buysell-mobile, 90-day expiry, signed with AUTH_SECRET). The edge middleware bypasses these requests and the Node handlers verify the token via verifyMobileJwt in src/lib/auth-helpers.ts.

5.1.3.4 Background Flow —

After import returns, void postImportTasks(propertyId) executes five stages sequentially, each emitting one ImportLog row:

Stage 1 — HASH (dhashFromUrl over sharp): Computes 64-bit dHashes for up to 60 photos missing Media.phash, with 800ms pacing per image.
Stage 2 — CATASTRO (enrichInBackground → enrichProperty): If cadastralRef is null, attempts coordinates path (Consulta_RCCOOR) and address path (Consulta_DNPLOC) in parallel, scores results by descriptive richness, and writes the best result plus a FLOORPLAN media entry if Catastro returns one.
Stage 3 — GEOCODE (geocodeAddress): If latitude and longitude are both null and either address or city is set, queries Nominatim with 1100ms throttling and a User-Agent: BuySell-Asturias/1.0 header.
Stage 4 — BORROW_FIELDS (borrowFieldsFromSimilar): For each NULL field in a 20-field whitelist, copies from the highest-scoring similar property (score ≥ 70).
Stage 5 — MATCH / MERGE_AUTO (findSimilar + conditional mergeProperties): Persists MatchSuggestion rows for any candidate ≥ 60; if top candidate ≥ 95 AND price difference ≤ 30% AND types match, executes auto-merge.
5.1.3.5 Data Transformation Points
Currency: All prices stored as integer cents (price * 100) at insertion; UI re-formats via @buysell/shared/format.
Photo hash: Image bytes → sharp 9×8 grayscale → adjacent-pixel comparison → 64-bit dHash (16-char hex) stored in Media.phash.
Cadastre XML → JSON: fast-xml-parser over Catastro responses; raw parsed structure persisted to Property.cadastralData as Json.
Geocode: Nominatim JSON response → {latitude, longitude} floats (WGS84 EPSG:4326).
Title slug: slugifyTitle from @buysell/shared produces a VarChar(120) value stored as Property.titleSlug.
5.1.3.6 Data Stores And Caches
Surface	Implementation	Lifetime
Primary database	PostgreSQL 17 (Docker volume buysell-pgdata)	Persistent
Image media	Local filesystem public/uploads/	Persistent (R2/S3 deferred)
Prisma client	globalThis.prisma singleton in src/lib/db.ts	Per Node process
Mobile token store	expo-secure-store key buysell.mobile.token	Per device
Playwright browser	Singleton inside sidecar with scheduleIdleClose(5 min)	Per sidecar process, idle-closed
Nominatim throttle marker	Module-scoped lastCall in geocode.ts	Per process

There is no Redis layer, no Memcached, no Next.js cache() annotations, and no revalidateTag calls. Read freshness is achieved by forcing dynamic rendering on read-heavy pages (/dashboard uses export const dynamic = "force-dynamic").

5.1.4 External Integration Points
System	Integration Pattern	Protocol / Format	SLA / Throttling
Catastro OVC (Coordinates)	Outbound HTTPS GET to Consulta_RCCOOR; parallel attempt with address path	HTTPS GET, XML response parsed via fast-xml-parser; HTML on errors	No published SLA; treated as best-effort; all failures logged as CATASTRO ok:false
Catastro OVC (Callejero / RC)	Outbound HTTPS GET to Consulta_DNPLOC (address) and Consulta_DNPRC (RC detail)	HTTPS GET, XML	No retry; warnings preserved in enrichProperty result
Catastro Floorplan	URL construction only (no fetch)	HTTPS GET image at sedecatastro.gob.es/Cartografia/GeneraGraficoParcela.aspx	URL stored as Media.url with kind=FLOORPLAN, source=CADASTRE
Nominatim (OpenStreetMap)	Outbound HTTPS GET with required User-Agent and Accept-Language: es-ES,es;q=0.9,en;q=0.8	HTTPS GET, JSON	1100ms minimum interval between calls enforced module-side; multiple query variants per address
Resend (Email)	Outbound HTTPS via official SDK	HTTPS via resend package	console.log fallback when RESEND_API_KEY is unset (development)
Spanish Real-Estate Portals (8)	Outbound HTTPS direct fetch OR Playwright navigation	HTTPS GET; browser-like UA; JSON-LD / CSS / regex extraction	15s HTTP timeout, 30s sidecar timeout; 1000ms inter-listing pacing on bulk recheck
Anthropic (Floorplan AI)	Configured via ANTHROPIC_API_KEY; scaffold only — not wired into production flows	HTTPS	Not active in current deliverable
User-Generated DOM (Userscripts)	Inbound HTTPS POST with Bearer token	JSON body validated by ImportListingInput Zod schema	CORS *; preflight OPTIONS supported; image cap 80 per import
5.2 Component Details
5.2.1 Web Application
5.2.1.1 Purpose And Responsibilities

The Next.js 15 application is the central artifact of the system. It serves the React 19 user-facing UI (App Router pages), exposes the JSON API at /api/**, executes server components and server actions for data-heavy reads, runs the import pipeline orchestration, and dispatches the fire-and-forget background tasks. It is the only process that performs Prisma calls.

5.2.1.2 Technologies And Frameworks
Runtime: Next.js ^15.1.0 with App Router, React ^19.0.0, TypeScript-first authoring
Authentication: next-auth ^5.0.0-beta.31 with @auth/prisma-adapter ^2.11.2; jose for HS256 verify
Persistence: @prisma/client ^6.1.0 plus prisma ^6.1.0 CLI; PostgreSQL provider locked via prisma/migrations/migration_lock.toml
UI: tailwindcss ^3.4.17, recharts ^2.15.0 for dashboard charts
Validation: zod ^3.24.1
Parsing: cheerio ^1.2.0 for HTML, fast-xml-parser for Catastro
Image processing: sharp ^0.34.5 (declared in next.config.ts serverExternalPackages)
Development port: 4200 (per package.json next dev -p 4200)
5.2.1.3 Key Interfaces

App Router pages: /login, /dashboard, /properties, /properties/new, /properties/[id], /matches, /search, /activity, /account.

API surface (organized by family):

Listings: POST /api/listings/import (CORS *), POST /api/listings/check (maxDuration = 300)
Properties: GET/POST /api/properties, GET/PATCH/DELETE /api/properties/[id], GET /api/properties/[id]/similar, POST /api/properties/[id]/merge, POST /api/properties/[id]/cadastre, POST /api/properties/[id]/dismiss-match
Search/Matches/Activity: GET /api/search, GET /api/matches
Auth: GET/POST /api/auth/[...nextauth], POST/OPTIONS /api/auth/mobile/request, POST/OPTIONS /api/auth/mobile/verify
Userscripts: GET /api/bookmarklet/[portal] (per-user token injection)
5.2.1.4 Data Persistence Requirements

The Prisma client is instantiated as a singleton on globalThis.prisma in src/lib/db.ts to survive Next.js dev-server hot reloads. All domain reads/writes route through this singleton; no direct SQL is used except for a single $queryRaw aggregation on the dashboard for €/m² by city (with HAVING COUNT(*) >= 2).

5.2.1.5 Scaling Considerations

The application is stateless except for the per-process Prisma client, so it can in principle scale horizontally. The principal coupling is the sidecar: SCRAPER_URL defaults to http://127.0.0.1:4201, requiring either per-host sidecar provisioning or a shared routable sidecar endpoint to scale. No SSR caching is configured; all read-heavy pages declare export const dynamic = "force-dynamic".

5.2.2 Edge Middleware
5.2.2.1 Purpose And Responsibilities

src/middleware.ts is the platform's authentication gate, running on every non-static request before any Node-runtime handler is invoked. It enforces three checks in sequence: public allowlist match, Bearer-token bypass for API routes, and NextAuth cookie session validation.

5.2.2.2 Runtime Constraints

The Edge runtime cannot use Prisma (no TCP) or Node Buffer (which jose requires for HS256 verification). The middleware therefore performs cookie-session validation only and delegates HS256 mobile JWT and bs_ API token validation to the Node-runtime route handlers.

5.2.2.3 Public Allowlist

The middleware's PUBLIC_PATHS regex set bypasses authentication for: /login, /api/auth/* (NextAuth and mobile OTP), /api/listings/import (userscripts and bookmarklets), /_next/*, /favicon.*, and /icon.*. The matcher configuration excludes _next/static, _next/image, favicon, and icon from middleware invocation entirely.

5.2.2.4 Failure Semantics

Unauthenticated requests to /api/* receive 401 JSON {error: "No autenticado"} so userscripts and the mobile client can parse the failure deterministically. Unauthenticated requests to pages receive 302 to /login?callbackUrl=<encoded path>.

5.2.3 Authentication Subsystem
5.2.3.1 Three Coexisting Token Types
Token Type	Issuer	Storage	Verifier	Lifetime
NextAuth session JWT	src/lib/auth.ts (Email provider callback)	HTTP-only cookie	Edge middleware via auth()	Session-bound
Mobile HS256 JWT	src/lib/mobile-jwt.ts:issueMobileJwt	expo-secure-store key buysell.mobile.token	verifyMobileJwt (Node only)	90 days
API token	src/lib/api-token.ts:getOrCreateUserToken	ApiToken table	resolveUserFromToken (DB lookup)	Indefinite
5.2.3.2 Magic-link Provider (web)

NextAuth v5 is configured in src/lib/auth.ts with a custom inline EmailResendProvider (id "email", maxAge: 86400 = 24 hours). The provider generates 32-byte hex tokens via crypto.getRandomValues(new Uint8Array(32)), sends HTML + plaintext emails via Resend (or console.log fallback when RESEND_API_KEY is unset), and uses the JWT session strategy with trustHost: true. The JWT callback assigns token.id = user.id; the session callback maps token.id back to session.user.id.

5.2.3.3 Mobile Otp Flow

POST /api/auth/mobile/request {email} upserts the User, deletes prior VerificationToken rows for the email, generates code = randomInt(100000, 1000000) (Node crypto.randomInt), persists {identifier: email, token: "mobile:<code>", expires: now + 10min}, and dispatches a Resend email. POST /api/auth/mobile/verify {email, code} validates the 6-digit format, looks up the token, returns 401 on missing/expired, deletes the token (one-time use), upserts the User with emailVerified: new Date(), and returns {token, user: {id, email, name}} where token is the HS256 JWT.

5.2.3.4 Api Token (

API tokens are 256-bit random hex strings with a bs_ prefix, generated via crypto.randomBytes(32).toString("hex"). They are persisted in the ApiToken table with optional label and lastUsed columns. resolveUserFromToken performs a direct DB lookup; on a hit, it best-effort updates lastUsed (errors swallowed). Tokens have no built-in expiration — they are rotated by deletion.

5.2.3.5 Auth Helper Cascade

src/lib/auth-helpers.ts:getUserId() performs a three-step resolution: try auth() (NextAuth session) → read Authorization: Bearer header → call verifyMobileJwt. requireUserId() throws "No autenticado" if all three fail; downstream route handlers catch and translate to 401 JSON.

5.2.3.6 Mobile Otp Sequence Diagram
Syntax error in text
mermaid version 11.14.0
Original Mermaid Code:
sequenceDiagram
    participant App as Mobile App
    participant API as Node API
    participant DB as PostgreSQL
    participant Email as Resend

    App->>API: POST /api/auth/mobile/request {email}
    API->>DB: prisma.user.upsert
    API->>DB: deleteMany VerificationToken<br/>WHERE identifier=email
    API->>API: randomInt(100000, 1000000)
    API->>DB: INSERT VerificationToken<br/>token=mobile:&lt;code&gt;<br/>expires=now+10min
    alt RESEND_API_KEY present
        API->>Email: Send OTP email
    else Fallback
        API->>API: console.log code
    end
    API-->>App: 200 OK (CORS *)

    Note over App: User enters 6-digit code

    App->>API: POST /api/auth/mobile/verify {email, code}
    API->>API: Zod validate /^\d{6}$/
    API->>DB: SELECT VerificationToken<br/>WHERE identifier=email<br/>AND token=mobile:&lt;code&gt;
    alt Not found or expired
        API-->>App: 401 Unauthorized
    else Valid
        API->>DB: DELETE VerificationToken (one-time use)
        API->>DB: UPSERT User (emailVerified=now)
        API->>API: issueMobileJwt(user.id, user.email)<br/>HS256, iss=buysell-mobile, exp=90d
        API-->>App: 200 {token, user:{id,email,name}}
        App->>App: SecureStore.setItem<br/>(buysell.mobile.token)
    end
5.2.4 Scraping Subsystem
5.2.4.1 Purpose And Responsibilities

The scraping subsystem (src/features/scraping/) is responsible for fetching listing pages from 8 Spanish portals, extracting structured fields (price, title, status), and reporting outcomes to the recheck runner. It does not perform any database writes — outcomes are returned as a discriminated union for runner.ts to dispatch.

5.2.4.2 Adapter Contract

PortalAdapter (types.ts) requires portal: Portal, matches: (url: string) => boolean, optional manualOnly?: boolean, and scrape: (url, ctx?) => Promise<ScrapeOutcome>. ScrapeOutcome is a discriminated union of {kind: "ok"}, {kind: "gone"}, {kind: "blocked"}, or {kind: "error"}.

5.2.4.3 Adapter Inventory
Generic-engine adapters (5): Fotocasa, Pisos.com, Habitaclia, ThinkSpain, Indomio. Each declares portal, matches, and a priceSelectors array; the generic engine handles the rest.
Manual-only adapters (3): Idealista, Milanuncios, Yaencontre — all declare manualOnly: true. The runner short-circuits these to touch only lastCheckedAt with reason "Manual-only (anti-bot)".
Base modules: _common.ts (loadPage, helpers), _genericAdapter.ts (3-tier extractor factory).
5.2.4.4 Generic 3-tier Price Extraction

The generic adapter applies tiers in order, falling through to the next only on failure:

JSON-LD: readJsonLd($) extracts the application/ld+json script; priceFromJsonLd checks offers.price OR offers.lowPrice.
CSS selectors: Each portal-configured priceSelectors[] entry is parsed via parsePriceEur (locale-aware EUR parsing).
Body regex (only when no previousPriceCents is supplied): /(\d{1,3}(?:\.\d{3})+|\d{6,})\s*€/g over the page body; first match wins (deliberately not the maximum, to avoid grabbing related-property banners).

Found prices pass through withinRange(p) = isValidPriceEur(p) && 0.5*prevEur <= p <= 2*prevEur when a previous price is known.

5.2.4.5 Http-to-sidecar Escalation

http.ts:fetchPage(url, timeoutMs = 15000) uses AbortController with a configurable timeout, a Chrome-like User-Agent, and Accept-Language: es-ES,es;q=0.9,en;q=0.8. Status mapping: 404/410 → gone; 403/429 → blocked; AbortError → error: timeout. Anti-bot detection scans the first 5000 chars against /cf-chl-bypass|cloudflare|captcha|just a moment|datadome|please verify you are human/i and converts matches to blocked.

_common.ts:loadPage escalates to the sidecar only on blocked outcomes and only when BUYSELL_DISABLE_BROWSER_FETCH !== "1". The sidecar call (browser-fetch.ts:browserFetchPage) issues POST http://127.0.0.1:4201/fetch with a 30s body timeout (+ 5s client buffer). On ECONNREFUSED, the message "Scraper sidecar no está arrancado (npm run scraper)" is returned.

5.2.4.6 Sidecar Process Details

scripts/scraper-service.mjs is a standalone Node ESM file:

Binds explicitly to 127.0.0.1:${SCRAPER_PORT||4201} (loopback only)
Singleton Playwright Chromium with scheduleIdleClose(5*60*1000)
Launch args: --disable-blink-features=AutomationControlled, --no-sandbox, --disable-setuid-sandbox
Browser context: viewport 1366×768, locale es-ES, timezone Europe/Madrid
addInitScript overrides navigator.webdriver, navigator.plugins, navigator.languages
Page navigation: goto(url, {waitUntil: "domcontentloaded"}) followed by waitForLoadState("networkidle") with 5s catch
Endpoints: GET /healthz, POST /fetch {url, timeoutMs}
SIGINT/SIGTERM cleanup releases the browser
5.2.4.7 Bulk Recheck Pacing

runner.ts:checkAllActiveListings queries listings in (ACTIVE, PRICE_DROP, PRICE_UP, UNKNOWN) ordered by lastCheckedAt asc nulls first and inserts await new Promise(r => setTimeout(r, 1000)) between iterations. The API route enforces export const maxDuration = 300 (5 minutes), bounding the maximum number of listings per invocation.

5.2.5 Import Pipeline
5.2.5.1 Purpose And Responsibilities

src/lib/import-listing.ts is the platform's primary write path. It accepts a normalized listing payload (typically from a userscript), validates and sanitizes it, decides between create and update paths, performs synchronous DB writes, and schedules the 5-stage enrichment pipeline.

5.2.5.2 Validation Layer

The ImportListingInput Zod schema requires url (string) and title (string, min 2 chars); all other property fields are optional with z.coerce on numerics. images defaults to [] (each must be a valid URL); features defaults to [].

5.2.5.3 Sanitization

sanitizePayload(payload) runs cross-platform validators from @buysell/shared/sanity: isValidPriceEur (10,000–50,000,000 €), isValidBuiltArea (5–5,000 m²), isValidYear (1700–currentYear+5). Implausible values are nulled rather than rejected. When primary fields are missing, parseFeaturesArray(payload.features) extracts area, rooms, bathrooms, year, floor, and plot area from feature strings (e.g., "186 m2" → builtArea, "4 hab." → rooms, "Construido en 1931" → yearBuilt). Strings containing "€/m²" are explicitly ignored to avoid misinterpreting unit prices as totals.

5.2.5.4 Update Path

When prisma.listing.findFirst({where: {url}}) returns an existing record, importListing applies isReasonablePriceChange against the previous price; rejection emits an ImportLog RECHECK event with ok: false and exits without mutation. On accept, the listing's lastPrice, lastSeenAt, lastCheckedAt, and status (PRICE_DROP / PRICE_UP / unchanged) are updated. If priceChanged, a PriceSnapshot is inserted and Property.currentPrice updated. A 23-field fillIfEmpty whitelist runs on the property (only overwriting null/empty values, never owner-edited data). If payload.images.length > 0, the existing PHOTO+PORTAL_SCRAPE media are deleted and the new images inserted, with phash preserved by URL identity through a phashByUrl Map. USER_UPLOAD media is never disturbed.

5.2.5.5 Create Path

When no existing listing is found, prisma.property.create performs a nested create of the Property plus all images as Media {kind: "PHOTO", source: "PORTAL_SCRAPE"} and a single Listing. An initial PriceSnapshot is inserted if priceCents is set.

5.2.5.6 Background Pipeline Dispatch

Both paths conclude with void postImportTasks(property.id). The update path passes {skipAutoMerge: !mediaRefreshed} to short-circuit Stage 5 on re-imports that did not refresh photos (avoiding redundant duplicate-detection passes).

5.2.5.7 Import Pipeline Sequence Diagram
Syntax error in text
mermaid version 11.14.0
Original Mermaid Code:
sequenceDiagram
    participant US as Userscript
    participant API as /api/listings/import
    participant Imp as importListing()
    participant DB as PostgreSQL
    participant BG as postImportTasks

    US->>API: POST + Bearer bs_token (CORS *)
    API->>API: resolveUserFromToken → ownerId
    API->>API: ImportListingInput.safeParse
    API->>Imp: importListing(data, {ownerId})
    Imp->>Imp: sanitizePayload + detectPortal
    Imp->>DB: findFirst Listing WHERE url

    alt Existing
        Imp->>Imp: isReasonablePriceChange
        alt Sanity fail
            Imp->>DB: Log RECHECK ok:false
            Imp-->>API: existing (no update)
        else Pass
            Imp->>DB: UPDATE Listing<br/>+ INSERT PriceSnapshot (if changed)<br/>+ fillIfEmpty Property<br/>+ Media diff
        end
        API-->>US: 200 OK
    else New
        Imp->>DB: nested create Property+Media+Listing<br/>+ INSERT PriceSnapshot
        API-->>US: 201 Created
    end

    Imp-)BG: void postImportTasks(propertyId)

    Note over BG: Fire-and-forget; does NOT block response

    BG->>BG: Stage 1 HASH (60 photos, 800ms throttle)
    BG->>DB: ImportLog HASH
    BG->>BG: Stage 2 CATASTRO (parallel coords+address)
    BG->>DB: ImportLog CATASTRO
    BG->>BG: Stage 3 GEOCODE (Nominatim, 1100ms throttle)
    BG->>DB: ImportLog GEOCODE
    BG->>BG: Stage 4 BORROW_FIELDS (score ≥ 70)
    BG->>DB: ImportLog BORROW_FIELDS
    BG->>BG: Stage 5 MATCH (≥60 persists)<br/>+ MERGE_AUTO (≥95 with guards)
    BG->>DB: ImportLog MATCH or MERGE_AUTO
5.2.6 Matching And Duplicate Detection
5.2.6.1 Purpose And Responsibilities

src/features/matching/find-similar.ts produces a ranked list of duplicate candidates for a given property using a 5-signal scoring engine. src/features/matching/merge.ts consolidates a source property into a target, moving listings, snapshots, and media while deduplicating overlapping photos.

5.2.6.2 Candidate Filtering

The OR-filter retrieves up to 50 candidates ordered by recency, scoped to the owner and excluding the source itself and any property IDs in Property.matchDismissed. The filter matches on: identical cadastralRef, case-insensitive city equality, OR overlap on Media.phash (using the @@index([phash]) index for the IN-query).

5.2.6.3 Five Scoring Signals
Signal	Score	Condition
Cadastre identity	100	Same cadastralRef
Photo overlap (strong)	90	≥ 3 photo pairs with Hamming ≤ 8
Photo overlap (medium)	60	2 photo pairs
Photo overlap (weak)	35	1 photo pair
Geo + area	80	< 50m AND area diff ≤ 5%
Geo only	55	< 50m
Title Jaccard (strong)	75	bigram Jaccard ≥ 0.7
Title Jaccard (medium)	50	Jaccard ≥ 0.5
Weak-signal bonus	+15 (cap 95)	2+ weak signals present

Candidates with score < 30 are discarded. Candidates ≥ 60 are persisted via prisma.matchSuggestion.upsert on @@unique([sourceId, targetId]), preserving any existing dismissedAt to avoid re-surfacing user-dismissed suggestions.

5.2.6.4 Merge Algorithm

mergeProperties(sourceId, targetId) executes five steps without a Prisma transaction (idempotency by design):

updateMany on Listing to reassign propertyId from source to target.
updateMany on PriceSnapshot similarly.
Loop source media: if any target media has a phash within Hamming ≤ 8, DELETE the source media (skippedDuplicateMedia++); otherwise UPDATE its propertyId (movedMedia++).
fillIfEmpty on a 24-field whitelist (descriptions, address parts, coordinates, room counts, areas, floor, year, 7 amenity booleans, cadastral fields, title slug). EnergyRating is only overwritten if the target is UNKNOWN. tags is computed as a union.
prisma.property.delete({where: {id: sourceId}}) — cascade rules remove any residual rows.

Self-merge throws "No te puedes fusionar con tu propia ficha". Calls where the source has already been deleted return zero counts (idempotent).

5.2.6.5 Matchsuggestion State Diagram

Computed

Discarded

Diagnostic

Pending

AutoMergeAttempt

Dismissed

Merged

Blocked

findSimilar()

score < 30

30 ≤ score < 60

60 ≤ score < 95

score ≥ 95

Re-import (upsert preserves dismissedAt)

User /dismiss-match

User /merge

priceDiff ≤ 30% AND types match

priceDiff > 30% OR type mismatch

Persisted with blocked=true

5.2.7 Cadastre Enrichment
5.2.7.1 Purpose And Responsibilities

src/features/cadastre/lookup.ts resolves Spanish cadastral references (refcat) for properties, fetching descriptive data (year built, built area, use code, floor, address) and constructing floorplan image URLs. Catastro's official endpoints return XML for success and HTML for errors; fast-xml-parser handles both, with an explicit HTML-detection guard.

5.2.7.2 Resolution Strategies

enrichProperty({lat, lng, province, city, address}) runs two paths in parallel:

Coordinates path: Consulta_RCCOOR?SRS=EPSG:4326&Coordenada_X=<lng>&Coordenada_Y=<lat> returning a 14-char reference ${pc1}${pc2}.
Address path: Consulta_DNPLOC with parsed sigla (parseAddress maps Spanish street types to Catastro codes via a 13-entry SIGLA_MAP: calle → CL, avenida → AV, plaza → PZ, etc.) handling both single-record (bico) and list (lrcdnp.rcdnp) response shapes.

Both results are scored by descriptive richness (address +2, builtArea +2, yearBuilt +2, use +1, floor +1) and the highest-scoring result is selected. fetchByRef(ref) then issues Consulta_DNPRC?RC=<ref> for the full record and constructs the floorplan URL https://www1.sedecatastro.gob.es/Cartografia/GeneraGraficoParcela.aspx?refcat=<ref>&del=<pc1[0:2]>&mun=<pc1[2:5]>.

5.2.7.3 Error Resilience

enrichProperty never throws — every path failure is captured as a warning in the returned {ref, info, method, warnings[]} structure. The pipeline caller surfaces failures via ImportLog CATASTRO events with ok: false. The system applies a User-Agent: BuySell-Asturias/1.0 (cadastre lookup) to all outbound Catastro requests.

5.2.8 Database Layer
5.2.8.1 Engine And Hosting

PostgreSQL 17 (alpine) runs in Docker container buysell-postgres on localhost:5432 with credentials buysell/buysell (development). The persistent volume is buysell-pgdata. Prisma 6 is the sole DB client; the provider is locked to postgresql via prisma/migrations/migration_lock.toml.

5.2.8.2 Schema Summary

The schema declares 11 models and 8 enums (see Section 3.5 for the full table). Notable patterns:

Multi-tenant readiness: Property.ownerId, ApiToken.userId, and SavedSearch.ownerId provide isolation hooks.
Cascade rules: All foreign keys cascade on delete except Property.ownerId, which is onDelete: SetNull (a deleted user leaves their listings as ownerless rather than destroying them).
Money: All monetary fields are integer cents (EUR-only).
Coordinates: Float lat/lng in WGS84 EPSG:4326.
Free-form data: Property.cadastralData Json?, ImportLog.meta Json?, SavedSearch.filters Json.
Native arrays: Property.tags String[], Property.matchDismissed String[], MatchSuggestion.reasons String[].
Composite indexes: (portal, status) on Listing, (propertyId, observedAt) on PriceSnapshot, (sourceId, dismissedAt) and (score, dismissedAt) on MatchSuggestion, (propertyId, createdAt) and (kind, createdAt) on ImportLog, plus (phash) on Media.
5.2.8.3 Listingstatus Lifecycle

ACTIVE

PRICE_DROP

PRICE_UP

REMOVED

UNKNOWN

SOLD

Import (create path)

Sanity-pass, new < prev

Sanity-pass, new > prev

Subsequent flat price

Subsequent flat price

Scrape outcome=gone

Scrape outcome=gone

Scrape outcome=gone

Sanity rejection / scrape error

Next successful recheck

User action / portal "vendido"

5.2.9 Mobile Application
5.2.9.1 Purpose And Responsibilities

The mobile app under apps/mobile/ is an Expo Router app providing OTP login, a dashboard, search, matches review, property detail, and account screens. It consumes the same JSON API surface as the web client, authenticated via HS256 JWT.

5.2.9.2 Technologies And Configuration
expo ~54.0.33 with newArchEnabled: true, typedRoutes: true, reactCompiler: true
expo-router ~6.0.23 for file-based routing under apps/mobile/app/(tabs)/
react-native 0.81.5, TypeScript ^5.9.2
expo-secure-store for token persistence
5.2.9.3 Api Client

apps/mobile/lib/api.ts defines api<T>(path, opts) which reads the JWT from expo-secure-store (key buysell.mobile.token), sets Authorization: Bearer <token> unless skipAuth: true, sets Content-Type: application/json, and parses bodies as JSON when possible. The ApiError class carries status and body properties for structured error handling.

Authentication helpers authRequestOtp(email) and authVerifyOtp(email, code) POST to the mobile auth endpoints with skipAuth: true (since the token doesn't exist yet).

5.2.9.4 Api Url Resolution

API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.1.77:4200" — a LAN-default that supports development against a host workstation; production deployments override via the Expo environment variable.

5.2.10 Shared Package

packages/shared/src/ exports five modules consumed by both web and mobile:

types.ts — Shared TypeScript domain types
format.ts — Money, area, and date formatters with Spanish locale
sanity.ts — isValidPriceEur, isValidBuiltArea, isValidYear, isReasonablePriceChange
similarity.ts — bigrams, jaccard, haversineMeters, slugifyTitle
index.ts — Barrel re-export

The web consumes this package via transpilePackages: ["@buysell/shared"] in next.config.ts. Mobile consumes it via npm workspace dependency. Sharing these primitives ensures that scoring, validation, and slug computation produce identical results across surfaces.

5.2.11 Userscripts And Bookmarklets

public/bookmarklet/ contains 7 portal-specific Tampermonkey scripts (buysell-<portal>.user.js) plus a legacy Idealista bookmarklet and _buysell-common.js (a design reference, not loaded directly).

GET /api/bookmarklet/[portal] generates a per-user, personalized userscript: requireUserId() authenticates the request, the portal is validated against an allowlist, the template file is read from disk, getOrCreateUserToken(userId) returns the bs_<64-hex> token, and the token is string-replaced into the BUYSELL_TOKEN constant and the Authorization header within the script. Response headers include Content-Type: application/javascript, Cache-Control: no-store, and X-Generated-For: <userId>.

5.2.12 Operational Scripts

scripts/ provides CLI utilities run via tsx:

Script	Purpose
scraper-service.mjs	Playwright sidecar HTTP server (npm run scraper)
check-listings.ts	CLI invocation of checkAllActiveListings() (npm run check-listings)
hash-photos.ts	Backfills Media.phash for any photos missing dHashes (npm run hash-photos)
fix-prices.ts	Recovery utility for sanity-rejected prices (npm run fix-prices)
claim-orphans.ts	Assigns ownerId to legacy properties created before authentication was introduced (npm run claim-orphans)
rewrite-imports.ts	Codemod utility (development-only)
5.3 Technical Decisions
5.3.1 Architecture Style — Modular Monolith Plus Sidecar

The decision to ship a single Next.js application instead of decomposing into microservices is the most consequential architectural choice. The rationale is observable in the code:

Personal/single-tenant scale: The product has one active operator; no team-scaling pressure forces service boundaries.
Shared database: All features write to the same PostgreSQL instance, eliminating the cross-service data consistency problem.
Operational simplicity: One deploy unit, one set of credentials, one log stream.

The sidecar is the lone exception, driven by hard runtime constraints rather than scaling needs:

Playwright Chromium binaries are ~300MB and platform-specific. Next.js standalone builds struggle with native binary inclusion. Compare with next.config.ts serverExternalPackages: ["sharp"] — the same anti-bundling decision applies.
Independent restart: The sidecar can crash or restart without affecting the web app.
Memory hygiene: scheduleIdleClose(5*60*1000) releases Chromium memory between scrape bursts.

The tradeoff is a tighter operational coupling: SCRAPER_URL is hardcoded to 127.0.0.1:4201, so horizontal scaling of the web app requires per-host sidecar provisioning or a shared routable endpoint.

5.3.2 Communication Patterns

All inter-process communication is synchronous HTTP request/response. There is no message broker, event bus, websocket layer, or SSE channel in the current implementation:

Sidecar boundary: HTTP on loopback 127.0.0.1:4201 (POST /fetch, GET /healthz)
Mobile boundary: HTTPS with Authorization: Bearer <HS256-JWT>
Userscript boundary: HTTPS with Authorization: Bearer bs_<token> and CORS *
External services: HTTPS GET/POST (Catastro XML, Nominatim JSON, Resend SDK)

Background work uses fire-and-forget local function dispatch (void postImportTasks(propertyId)) rather than a queue. Pipeline observability comes from ImportLog rows. The tradeoff is that work in flight is lost if the Node process crashes mid-pipeline; this is mitigated by gating each stage on NULL columns so that a subsequent re-import re-triggers only the missing work.

5.3.3 Data Storage — Postgresql Only

Choosing PostgreSQL as the sole persistence engine reflects three observations:

Native array types (tags String[], matchDismissed String[], reasons String[]) avoid join tables for simple lists.
Native JSON support stores raw Catastro responses (cadastralData) and structured log metadata (ImportLog.meta).
Composite indexes match observed query patterns: (portal, status) for portal-scoped recheck queues, (propertyId, observedAt) for snapshot timelines, (phash) for cross-property duplicate-photo queries.

No read replica, no separate search engine, no caching tier. The decision is documented in Section 3.5.3: "There is no caching layer in the current implementation". Read freshness is achieved by forcing dynamic rendering on read-heavy pages.

Object storage for user-uploaded images currently uses the local filesystem (public/uploads/); R2/S3 migration is deferred to future phases per Section 1.3.

5.3.4 Caching Strategy

The system's only persistent caches are derived data stored as columns (Media.phash, Property.cadastralData, Property.titleSlug). Computational caches are minimal:

Cache	Scope	Lifetime	Implementation
Prisma client	Per Node process	Process lifetime	globalThis.prisma singleton in src/lib/db.ts
Playwright browser	Sidecar process	5 min idle	scheduleIdleClose in scraper-service.mjs
Nominatim throttle marker	Per Node/sidecar process	Process lifetime	Module-scoped lastCall in geocode.ts
dHash by URL	Per-import map	Per import call	phashByUrl Map in import-listing.ts update path

No Redis, no Memcached, no cache() annotations, no revalidateTag invocations. Userscript responses set Cache-Control: no-store to prevent browser caching of personalized tokens.

5.3.5 Security Mechanism Selection
Mechanism	Decision	Rationale
Web session	NextAuth v5 JWT in HTTP-only cookie	Stateless verification at the Edge; no session-table reads per request
Mobile session	HS256 JWT with shared AUTH_SECRET	Common trust root with web; verifiable in Node without DB lookup; jose library is small and Edge-compatible at the API level
API token	bs_ prefix + 64 hex (256-bit entropy)	High entropy; prefix enables log filtering; no expiry suits personal-tool scale
Magic link	256-bit hex, 24-hour expiry	Standard NextAuth Email pattern adapted to Resend SDK
OTP	6-digit numeric, 10-minute expiry, one-time use	Optimized for mobile entry; reuses VerificationToken table
Sidecar	Loopback bind 127.0.0.1 + no auth	Host-level isolation; sidecar never reachable from the internet
CORS	Default same-origin; * only on import and mobile auth	Userscripts and mobile login must be cross-origin; everything else locked down
5.3.6 Architecture Decision Records

The following ADRs document the key architectural choices, derived directly from observed code and configuration. Status is Accepted for all entries (the system is in single-deployment use); future phases may reopen items 3, 5, and 8.

Decision	Context	Consequence
ADR-1: Modular monolith over microservices	Personal-scale operator, single team, single DB, no service-team boundaries	Simple deploy; no per-feature independent scaling; refactor cost rises if team grows
ADR-2: Sidecar pattern for Playwright	~300MB binary; Next.js bundling fragile for native deps; need independent restart	Separate process startup; coupling via 127.0.0.1:4201; horizontal scaling requires per-host sidecar
ADR-3: PostgreSQL only (no Redis)	Personal scale; no read-heavy hot paths beyond dashboard; SLA tolerance	Read freshness via dynamic = "force-dynamic"; future Redis remains optional
ADR-4: Idempotency over prisma.$transaction	Background pipeline must survive partial completion; merges loop over media	Each step safe to re-run; small window of partial-state visibility; manual recovery scripts available
ADR-5: Fire-and-forget background tasks (no queue)	Personal scale; ImportLog suffices for observability; no need for retry orchestration UI	Tasks lost on process crash; mitigation: each stage gated on NULL column so re-import re-triggers missing work
ADR-6: HS256 JWT for mobile (not NextAuth session)	NextAuth v5 mobile flow is awkward; need verifiable token without DB lookup; jose is lightweight	Two token systems to maintain; bridged by auth-helpers.ts cascade
ADR-7: EUR-only integer cents	Spain market only; no internationalization in scope	No multi-currency; locale assumptions baked in; future expansion requires schema migration
ADR-8: Local image storage (public/uploads/)	Personal/local scale; no CDN need at present	Not horizontally scalable; R2/S3 migration deferred to Phase 1
ADR-9: Userscript over Chrome extension	Faster iteration; no MV3 build/sign process; familiar Tampermonkey tooling	Requires Tampermonkey install per user; future MV3 extension deferred
ADR-10: Sanity guards over hard rejection	Scraped data is noisy; rejecting imports is worse than logging anomalies	Anomalies surface in ImportLog; manual fixers (fix-prices.ts) resolve false-positive rejections
5.3.6.1 Scraping Escalation Decision Tree

The most visible runtime decision in the system is the HTTP-to-sidecar escalation. The following tree documents the decision flow used by every non-manual-only adapter:

Yes

No

404 or 410

2xx

403 or 429

AbortError

Yes

No

Yes

No

DISABLE=1

Else

ECONNREFUSED

2xx

Yes

No

Yes

No

Yes

No

Yes

No

adapter.scrape url, opts

adapter.
manualOnly?

Return blocked
(handled by runner:
touch lastCheckedAt only)

loadPage url

fetchPage
(15s timeout, browser UA)

HTTP status

outcome=gone

Anti-bot regex
match in first 5k?

Sidecar
escalation
enabled?

outcome=error: timeout

Body matches
retirado / vendido / etc?

3-tier price extractor

outcome=blocked
'usa el userscript'

browserFetchPage
POST 127.0.0.1:4201/fetch

Success?

outcome=blocked
'sidecar no arrancado'

JSON-LD
price?

withinRange
0.5x – 2x?

CSS selector
price?

Body regex
price?
only if no prev

outcome=error: no price

outcome=ok

5.4 Cross-cutting Concerns
5.4.1 Monitoring And Observability

The platform's primary observability surface is the ImportLog table — an append-only event log keyed by kind (one of 8 ImportLogKind enum values: HASH, CATASTRO, GEOCODE, MATCH, MERGE_AUTO, MERGE_MANUAL, BORROW_FIELDS, RECHECK) — written by src/lib/import-log.ts:logImportEvent(kind, opts). Each row carries propertyId String?, ok Boolean, message String?, meta Json?, createdAt, indexed on (propertyId, createdAt), (kind, createdAt), and (createdAt).

Critical design property: logImportEvent swallows DB errors via console.error only — observability writes never break the workflow they describe.

The /activity page reads PriceSnapshot rows directly via Prisma (the 100 most recent, ordered by observedAt desc); ImportLog rows are surfaced in property-detail views for diagnostic context. Beyond these, there is no external log aggregation (no Datadog, no New Relic, no OpenTelemetry exporter), no distributed tracing (no W3C trace context), no structured logger library (no Pino, no Winston), and no metrics endpoint (no Prometheus exposition). console.log and console.error are used directly for sidecar errors, log-write failures, and dev-mode OTP/magic-link fallbacks.

5.4.2 Logging And Tracing Strategy
5.4.2.1 Application Event Logging

Background pipeline stages each emit one ImportLog row with detailed meta JSON. For example, the HASH stage logs {ok, fail, total}; the MATCH stage logs the candidate score and reasons[]; auto-merge blocks log {priceTooDifferent, typeMismatch}. This produces a forensic trail sufficient to diagnose individual property issues without external tooling.

5.4.2.2 Request Logging

There is no explicit request-logging middleware. Next.js dev mode logs requests to stdout by default; production logging is left to the hosting environment.

5.4.2.3 Tracing

No tracing system is configured. The fire-and-forget pipeline pattern would require careful instrumentation to trace properly; this is explicitly deferred.

5.4.3 Error Handling Patterns

The system observes six error categories with distinct handling strategies:

Category	Detection	Recovery
Timeout	AbortError from AbortController in http.ts:fetchPage (15s) and browser-fetch.ts (30s + 5s buffer)	Touch lastCheckedAt, return kind: "error"; no retry
Validation	Zod.safeParse failures in API routes	HTTP 400 JSON with {error, issues: flattened}
Authentication	requireUserId() throws "No autenticado"	Caught by handler, returned as 401 JSON
Sanity	isReasonablePriceChange returns false	logImportEvent("RECHECK", {ok:false}), no DB write
External	Catastro/Nominatim/Resend network failures	Caught in pipeline stage, logImportEvent({ok:false, message: e.message}), NULL fields re-trigger on future imports
Database	Prisma constraint or connection errors	500 JSON with {error, code, meta, name, stack}

No retry loops anywhere in the codebase. Tier-based escalation (HTTP → sidecar) substitutes for retry. Anti-bot pacing (1000ms inter-listing in checkAllActiveListings, 800ms inter-photo in HASH, 1100ms Nominatim throttle) substitutes for exponential backoff.

5.4.3.1 Recovery Mechanisms
Manual scripts (hash-photos.ts, fix-prices.ts, claim-orphans.ts) reprocess failed or anomalous data.
Re-import as recovery: Most pipeline stages are gated on NULL columns, so re-importing a property URL will re-trigger any missing enrichment.
Idempotent merges: mergeProperties returns zero counts when invoked on an already-merged source.
5.4.3.2 Error Handling Decision Tree

No, API

No, page

Yes

Fail

Pass

Fail

Pass

Scrape

ok

Pass

Fail

gone

blocked

error

External call

Catch

Success

DB write

Constraint

Success

Incoming Request or Job

Edge
middleware
authorized?

401 JSON No autenticado

302 to /login

Zod safeParse?

400 JSON error issues

ensureOwner
or requireUserId?

404 or 401

Operation type

ScrapeOutcome.kind

Reasonable price?

INSERT PriceSnapshot
+ UPDATE Listing

Touch lastCheckedAt
Log RECHECK ok:false

UPDATE Listing.status=REMOVED

Touch lastCheckedAt only

Touch lastCheckedAt only

Try block

Log stage ok:false
NULL fields preserved

Apply enrichment patch

Prisma op

500 JSON error code meta

200/201 JSON

5.4.4 Authentication And Authorization Framework
5.4.4.1 Authentication Surface

Detailed in Section 5.2.3. Three token types converge on getUserId() in src/lib/auth-helpers.ts, which performs a NextAuth → Bearer JWT → mobile JWT cascade.

5.4.4.2 Authorization Model

Authorization is ownership-based, not role-based. Every domain entity has an ownerId, and every query scopes by that owner. Key enforcement points:

src/app/api/properties/[id]/route.ts calls an ensureOwner(id, ownerId) helper that performs findFirst({where: {id, ownerId}, select: {id}}) before any mutation.
The same helper appears in src/app/api/properties/[id]/dismiss-match/route.ts and src/app/api/properties/[id]/cadastre/route.ts.
src/app/api/matches/route.ts first loads the owner's property IDs, then filters MatchSuggestion rows to sourceId IN (...).

Unauthorized access returns 404, not 403 — ensureOwner returns null both when the record is missing and when it exists but is not owned, avoiding existence-leak side-channels.

There is no RBAC: the product runs single-user-active. The schema is multi-tenant-ready (any user can own properties), but no admin/operator role exists.

5.4.5 Performance Requirements And Slas

The system enforces explicit timing and pacing constraints throughout. The following are derived directly from source:

Operation	Limit	Source
HTTP fetch timeout	15s	http.ts:fetchPage(url, timeoutMs=15000)
Sidecar fetch timeout	30s + 5s buffer	browser-fetch.ts:AbortSignal.timeout(timeoutMs+5000)
Sidecar idle close	5 min	scraper-service.mjs:scheduleIdleClose(5*60*1000)
Recheck endpoint maxDuration	300s	api/listings/check/route.ts:export const maxDuration = 300
Magic link validity	24h	auth.ts:EmailResendProvider.maxAge = 86400
Mobile OTP validity	10 min	api/auth/mobile/request/route.ts
Mobile JWT expiry	90 days	mobile-jwt.ts:EXPIRY = "90d"
Recheck pacing	1000ms inter-listing	runner.ts:checkAllActiveListings
dHash pacing	800ms inter-photo	import-listing.ts:postImportTasks
Nominatim throttle	1100ms minimum interval	geocode.ts:throttle()
Stale listing threshold	7 days	Dashboard STALE_DAYS=7
Mobile search debounce	250ms	Per Section 4.6
5.4.5.1 Numeric Thresholds
Threshold	Value	Source
Photo Hamming distance	≤ 8 of 64 bits	find-similar.ts:PHOTO_HAMMING_THRESHOLD
MatchSuggestion persist score	≥ 60	find-similar.ts
MatchSuggestion discard score	< 30	find-similar.ts
Auto-merge score	≥ 95	import-listing.ts:postImportTasks
Auto-merge price guard	> 30% blocks	import-listing.ts:postImportTasks
BORROW_FIELDS minimum score	≥ 70	borrow-fields.ts:MIN_SCORE
Candidate cap	50	find-similar.ts:take: 50
dHash batch size	60	import-listing.ts:take: 60
Userscript image cap	80 per import	Per Section 4.6
Search results limit	12	Per Section 4.6
Filter list limit	100	Per Section 4.6
Activity feed limit	100	api/matches/route.ts:take: 100
5.4.6 Disaster Recovery

The current DR posture reflects the product's local/personal-scale deployment context (per Section 1.3):

PostgreSQL persistence: The Docker named volume buysell-pgdata survives container recreation. No automated backups (pg_dump cron, snapshot policy) are configured at the repository level.
No CI/CD: There is no .github/workflows/ directory and no automated deployment pipeline (per Section 3.6).
No cloud deployment: Local development only at present; managed Postgres provisioning is forward-looking (per Section 3.5.4).
Idempotent operations as primary DR mechanism: Re-running import on the same URL hits the update path safely; re-running merge on an already-deleted source returns empty counts; each background pipeline stage is gated on NULL columns so re-imports re-trigger only the missing work.
Manual recovery scripts: hash-photos.ts (re-tries dHash for media with NULL phash), fix-prices.ts (recovery for sanity-rejected prices), claim-orphans.ts (assigns ownership to pre-auth data), and check-listings.ts (manual trigger of the bulk recheck path).

For Phase-1 deployment to managed infrastructure, the DR plan must add scheduled pg_dump exports, an object-storage replica of public/uploads/, and a runbook for sidecar restart procedures. None of these are present in the current codebase.

5.4.7 Security Posture Summary

Cross-referenced with Section 3.8, the key observed protections are:

256-bit API token entropy via crypto.randomBytes(32).toString("hex") with bs_ prefix for grep-ability
AUTH_SECRET as shared HS256 trust root between NextAuth and mobile JWT, ensuring both client surfaces derive from the same secret material
CORS * strictly limited to /api/listings/import and /api/auth/mobile/* — all other endpoints are same-origin
Sidecar bound to 127.0.0.1 with no authentication, never exposed externally
Magic-link 24-hour expiry, OTP 10-minute expiry, OTP one-time use (deleted on consumption)
1000ms anti-DDoS pacing on bulk recheck (protects external portals)
0.5x–2x sanity band on price changes prevents rogue scraper output from corrupting price history
Auto-merge guards (30% price differential AND type match required) prevent destructive false-positive merges
References
Files Examined
package.json — Workspace declaration, npm scripts, full dependency list
next.config.ts — transpilePackages, serverExternalPackages: ["sharp"], image remotePatterns
docker-compose.yml — PostgreSQL 17 alpine container, buysell-pgdata volume, credentials
prisma/schema.prisma — 11 models, 8 enums, indexes, cascade rules
prisma/migrations/ — 6 timestamped migration folders documenting schema evolution
src/middleware.ts — Edge auth gate, PUBLIC_PATHS allowlist, Bearer bypass for /api/*
src/lib/auth.ts — NextAuth v5 configuration with inline EmailResendProvider
src/lib/auth-helpers.ts — getUserId() cascade (NextAuth → Bearer → mobile JWT)
src/lib/mobile-jwt.ts — HS256 issue/verify via jose; 90-day expiry, issuer buysell-mobile
src/lib/api-token.ts — bs_<64-hex> token generation, resolution, extraction
src/lib/db.ts — Prisma singleton on globalThis
src/lib/import-listing.ts — ImportListingInput schema, sanitizePayload, importListing, 5-stage postImportTasks
src/lib/import-log.ts — logImportEvent helper with error-swallowing semantics
src/lib/geocode.ts — Nominatim integration with 1100ms throttle, multi-variant queries
src/lib/dhash.ts — 9×8 grayscale dHash via sharp, dhashFromUrl, Hamming distance
src/app/api/listings/import/route.ts — Token resolution, Zod parse, CORS handling
src/app/api/listings/check/route.ts — maxDuration = 300, single/batch dispatch
src/app/api/auth/mobile/request/route.ts — OTP generation, VerificationToken lifecycle
src/app/api/auth/mobile/verify/route.ts — OTP verification, JWT issuance
src/app/api/properties/[id]/route.ts — ensureOwner ownership enforcement pattern
src/app/api/bookmarklet/[portal]/route.ts — Per-user userscript generation
src/app/dashboard/page.tsx — dynamic = "force-dynamic", 10-query Promise.all, STALE_DAYS=7
src/features/scraping/runner.ts — pickAdapter, checkListing, checkAllActiveListings
src/features/scraping/types.ts — PortalAdapter contract, ScrapeOutcome union
src/features/scraping/adapters/_common.ts — loadPage with sidecar escalation
src/features/scraping/adapters/_genericAdapter.ts — 3-tier price extraction
src/features/scraping/http.ts — fetchPage with anti-bot detection
src/features/scraping/browser-fetch.ts — Sidecar HTTP client
src/features/matching/find-similar.ts — 5-signal scoring, PHOTO_HAMMING_THRESHOLD=8
src/features/matching/merge.ts — 5-step idempotent consolidation
src/features/matching/borrow-fields.ts — MIN_SCORE=70, 20-field whitelist
src/features/cadastre/lookup.ts — Coords/address parallel paths, SIGLA_MAP, enrichProperty
scripts/scraper-service.mjs — Playwright sidecar, 127.0.0.1:4201, idle close, anti-detection scripts
scripts/check-listings.ts, hash-photos.ts, fix-prices.ts, claim-orphans.ts, rewrite-imports.ts — Operational utilities
apps/mobile/lib/api.ts — Mobile API client, TOKEN_KEY, ApiError, OTP helpers
apps/mobile/ — Expo Router app structure ((tabs)/, login, property/[id])
packages/shared/src/ — types.ts, format.ts, sanity.ts, similarity.ts, index.ts
public/bookmarklet/ — 7 portal-specific Tampermonkey userscripts plus legacy bookmarklet
Cross-referenced Technical Specification Sections
Section 1.2 SYSTEM OVERVIEW — Project scope and architectural scale
Section 1.3 SCOPE — Deferred phases (cloud, CI/CD, R2/S3, MV3, SSE, multi-tenant UI)
Section 2.4 IMPLEMENTATION CONSIDERATIONS — Node 20+ requirement, Edge limits, local storage
Section 3.1 PROGRAMMING LANGUAGES — TypeScript-first, ESM sidecar, three tsconfig files
Section 3.2 FRAMEWORKS & LIBRARIES — Pinned dependency matrix
Section 3.4 THIRD-PARTY SERVICES — Catastro, Nominatim, Resend, Anthropic, portals
Section 3.5 DATABASES & STORAGE — PostgreSQL 17, models, enums, migrations, cascade rules
Section 3.6 DEVELOPMENT & DEPLOYMENT — Sidecar architecture, no CI/CD
Section 3.8 SECURITY POSTURE — Token entropy, CORS scope, sidecar isolation, JWT trust
Section 4.1 SYSTEM WORKFLOWS — Edge decision flow, magic link, OTP, import, enrichment, recheck
Section 4.2 INTEGRATION WORKFLOWS — Catastro parallel paths, sidecar boundary, Resend, Nominatim
Section 4.3 STATE MANAGEMENT — Listing/Property state machines, MatchSuggestion lifecycle
Section 4.4 ERROR HANDLING WORKFLOWS — 6 error categories, retry/fallback, recovery procedures
Section 4.5 VALIDATION RULES — Business rules, validators, auto-merge guards
Section 4.6 TIMING AND SLA CONSIDERATIONS — All timeouts, throttles, numeric thresholds
6. System Components Design
6.1 Core Services Architecture
6.1.1 Architectural Applicability And Service Topology

BuySell Asturias is deliberately designed as a modular monolith with a single sidecar process, not as a microservices or distributed-services architecture. Per ADR-1 (Section 5.3.6), the system is sized for a personal-scale, single-tenant operator with a single team, a single database, and no service-team boundaries. Per Section 5.3.1, the choice to ship a single Next.js application instead of decomposing into microservices is explicitly identified as the most consequential architectural choice, justified by personal/single-tenant scale, a shared PostgreSQL instance that eliminates the cross-service data consistency problem, and operational simplicity (one deploy unit, one set of credentials, one log stream).

Section 6.1 is therefore documented in a hybrid form: the system does host two distinct OS-level service processes with a well-defined inter-process boundary, and that boundary is documented here in full. However, most of the canonical microservices concerns (service discovery infrastructure, load balancing, distributed circuit breakers, message brokers, service mesh) are intentionally not implemented and are flagged "Not Applicable" with explicit justifications.

6.1.1.1 Microservices Concepts Not Applicable To The Current System
Concern	Status	Justification
Service registry / DNS-based discovery	Not applicable	Single sidecar; address fixed by SCRAPER_URL env var (Section 5.3.1)
Load balancer	Not applicable	One Next.js process; one sidecar process
Message broker / event bus	Not applicable	ADR-5: fire-and-forget local function dispatch; no queue
WebSocket / SSE channel	Not applicable	Section 5.3.2: synchronous HTTP only; no push channel
Distributed circuit breaker library	Not applicable	One downstream service; degradation handled inline
Service mesh / sidecar proxy	Not applicable	Loopback bind; no need for mTLS or traffic policy
Distributed tracing (W3C trace-context)	Not applicable	Section 5.4.2.3: no tracing system configured
Read replicas / multi-region DB	Not applicable	ADR-3: PostgreSQL-only; no replication
Autoscaling (HPA / cloud)	Not applicable	No platform-managed scaler; single-host Docker only
CI/CD pipeline	Not applicable	Section 5.4.6: no .github/workflows/ directory present
6.1.1.2 Two-process Service Topology

Despite the monolithic core, the deployable surface comprises two long-running Node processes and one supporting database container. These are the only "services" in the system in the operational sense.

Service	Process	Network Surface	Source
Next.js Web Application	next dev / next start on port 4200	All interfaces, port 4200 (web + API + RSC)	package.json scripts, src/app/
Playwright Sidecar	node scripts/scraper-service.mjs	Loopback only, 127.0.0.1:4201	scripts/scraper-service.mjs
PostgreSQL Database	postgres:17-alpine Docker container	Container port 5432	docker-compose.yml

The Next.js process is itself composed of three internal runtime tiers within a single deployable (per Section 5.1.1.2): the Edge runtime in src/middleware.ts (auth gate, no Prisma, no Buffer), the Node runtime in src/app/api/**/route.ts (full Node API surface), and React Server Components in src/app/**/page.tsx (with dynamic = "force-dynamic" on read-heavy pages). These tiers share one Prisma singleton (src/lib/db.ts) but are not distinct services.

6.1.2 Service Components
6.1.2.1 Service Boundaries And Responsibilities
7. User Interface Design
7.1 Ui Architecture Overview

BuySell Asturias exposes three distinct user-facing surfaces, each optimized for a specific interaction model and authentication strategy. The interfaces share a common visual identity ("steel and aged brass") and a Spanish-language audience but diverge in technology, rendering model, and capability scope.

7.1.1 Ui Surfaces Inventory
#	Surface	Path	Technology	Role	Authentication
1	Web Application	src/	Next.js 15 App Router + React 19	Primary system of record; full CRUD	NextAuth v5 magic-link cookie session
2	Mobile Application	apps/mobile/	Expo SDK 54 + Expo Router	Read-mostly companion app	HS256 JWT in expo-secure-store
3	Userscripts / Bookmarklet	public/bookmarklet/	Tampermonkey/Violentmonkey userscripts	Manual import overlay on third-party portals	bs_<64-hex> API token in Authorization: Bearer

The web application is the only surface that can mutate state from the UI. The mobile app is intentionally read-mostly (browse, view detail, search, review duplicates, manage account). The userscripts are not a self-hosted UI — they inject capture overlays into Idealista, Milanuncios, and Yaencontre pages and are documented in src/app/bookmarklet/page.tsx for onboarding.

7.1.2 Design Philosophy And Identity

The codebase reveals a deliberate aesthetic identity codified in src/app/globals.css and validated against the design-review route at src/app/brand/page.tsx:

"Steel and aged brass" — the primary color is a muted steel blue (#3A5F8A) and the brand accent is brass (#C49A4D), self-described in the CSS variables as "latón envejecido sobre acero" (aged brass on steel).
Warm off-white surfaces (#FAFAF7) rather than pure white, with subtle low-alpha shadows (rgba(20, 20, 18, 0.04–0.06)).
Sober and information-dense — a 13px base font size with an 8-tier scale and tabular numerics for prices and KPIs reflects the management-tool nature of the product.
Branded with a medieval key — the IconKey component is the master brand mark, surfaced both in the web AppShell header and the LoginForm, themed with the brass accent overlay.
Asturian regional touches — secondary brand icons include IconHorreo (Asturian granary on stilts) and IconPicos (Picos de Europa mountains), reflecting the regional focus inherent to the product name.
7.1.3 Cross-surface Architectural Patterns

Several patterns recur across both web and mobile surfaces:

Pattern	Web Implementation	Mobile Implementation
Spanish-first localization	<html lang="es">, toLocaleString("es-ES")	All UI strings hard-coded in Spanish
URL as state	Filter/sort/view in query string	Route params for property ID
Owner scoping at read time	requireUserId() + Prisma ownerId filter	JWT subject claim feeds same filter
Empty-state composition	<EmptyState> primitive with icon + copy + CTA	Custom inline empty views per screen
Debounced search	200ms in GlobalSearch	250ms in (tabs)/search
No global state library	Server components + local useState only	AuthProvider context + local useState only
Hard-coded palette	CSS custom properties in globals.css	Same hex values inlined per screen

The last item — duplicated palette values — is a known minor architectural debt: design tokens are not shared programmatically between the web (globals.css) and mobile (StyleSheet definitions). Both surfaces reference the same hex codes by convention, not by import.

7.2 Core Ui Technologies
7.2.1 Web Application Stack

The web stack pins the framework versions documented in Section 1.2 and Section 3.2:

Layer	Technology	Version	Source
Framework	Next.js (App Router)	^15.1.0	package.json
UI library	React	^19.0.0	package.json
Language	TypeScript	^5.7.2	package.json
Styling	Tailwind CSS	^3.4.17	package.json, tailwind.config.ts
CSS processor	PostCSS + Autoprefixer	^8.5.0 / ^10.4.20	package.json
Icons (in-app)	lucide-react	^0.469.0	package.json
Icons (brand)	Inline SVG components	—	src/components/brand/icons.tsx
Charts	Recharts	^2.15.0	PriceHistoryChart.tsx
Class composition	clsx via @/lib/cn	^2.1.1	package.json
Email templates	@react-email/render	^2.0.8	package.json
Typography	Inter (Google Fonts)	via next/font/google	src/app/layout.tsx
Image optimization	next/image with allowlist	—	next.config.ts

The next.config.ts remotePatterns allowlist permits remote images from **.idealista.com, **.fotocasa.es, **.pisos.com, and **.milanuncios.com, enabling thumbnail rendering from external portals without re-hosting.

7.2.2 Mobile Application Stack

The mobile stack lives under apps/mobile/ and is declared in apps/mobile/package.json:

Layer	Technology	Version
SDK	Expo	~54.0.33
Routing	expo-router	~6.0.23
Runtime	React Native	0.81.5
Web compatibility	react-native-web	~0.21.0
Navigation	@react-navigation/native + bottom-tabs	^7.1.8 / ^7.4.0
Image	expo-image	~3.0.11
Storage (auth)	expo-secure-store	~15.0.7
Icons	@expo/vector-icons (Ionicons)	^15.0.3
Animations	react-native-reanimated	~4.1.1
Haptics	expo-haptics	~15.0.8
Safe area	[ID]	~5.6.0

The mobile manifest (apps/mobile/app.json) declares the app name "BuySell Asturias", slug buysell-asturias, deep-link scheme buysell, newArchEnabled: true (React Native New Architecture), supportsTablet: true on iOS, and edge-to-edge display on Android. The React Compiler and typed routes are enabled as experimental features.

7.2.3 Design Token System

The single source of truth for the web design system is src/app/globals.css. CSS custom properties define every color, radius, and shadow, then tailwind.config.ts maps semantic Tailwind class names onto these variables.

7.2.3.1 Color Tokens
Category	Token	Value	Purpose
Surfaces	--bg	#FAFAF7	Page background
Surfaces	--surface	#FFFFFF	Cards, primary surfaces
Surfaces	--surface-muted	#F4F3EE	Subtle group backgrounds
Surfaces	--surface-sunken	#EFEEE8	Inputs, sunken regions
Borders	--border	#E8E6E1	Default borders
Borders	--border-strong	#D4D1CA	Emphasis borders, scrollbars
Text	--text	#1A1A18	Primary text
Text	--text-muted	#6B6862	Secondary text
Text	--text-subtle	#9A9690	Placeholder, helper
Text	--text-inverse	#FAFAF7	On dark backgrounds
Brand	--primary	#3A5F8A	Steel blue (primary actions)
Brand	--primary-hover	#2E4D70	Hover state
Brand	--primary-soft	#EAEFF6	Tinted primary backgrounds
Brand	--brand-accent	#C49A4D	Aged brass key accent
Semantic	--success / -soft	#2D6A4F	Sold, positive outcomes
Semantic	--warning / -soft	#A86A17	Warnings, attention
Semantic	--danger / -soft	#A23E3E	Destructive, errors
Semantic	--info / -soft	#2C7A8A	Informational
Price deltas	--price-up-bg / -fg	subtle red	Price increases
Price deltas	--price-down-bg / -fg	subtle green	Price decreases
7.2.3.2 Non-color Tokens
Radii: 4px, 6px, 8px, 12px
Shadows: 3 tiers with rgba(20, 20, 18, 0.04–0.06) — intentionally very low alpha
Body type: 13px, line-height 1.5
Font features enabled: cv11, ss01, ss03 (Inter stylistic alternates)
.tabular utility class: enables font-variant-numeric: tabular-nums for prices and KPIs
Global focus-visible ring: 2px solid --primary with 2px offset
Custom scrollbar: 10px width, transparent track, --border-strong thumb

The tailwind.config.ts exposes an 8-tier font size scale from xs (12px) through 3xl (32px) with letter-spacing tuned for headings, and declares the font family as ["var(--font-sans)", "Inter", "system-ui", "sans-serif"].

7.3 Web Application Interface
7.3.1 Application Shell And Navigation

The root layout (src/app/layout.tsx) wires the Inter font as a CSS variable --font-sans, loads globals.css, sets <html lang="es">, and wraps every route in <AppShell>. The page metadata defines title BuySell Asturias with a Spanish description.

The AppShell component (src/components/AppShell.tsx) provides:

Sidebar (medium+ breakpoints): 56-unit-wide column with a branded header featuring IconKey, the navigation list, an Ajustes link, and the UserMenu dropdown.
Top header: GlobalSearch (200ms debounce) on the left and a "Nuevo inmueble" CTA on the right.
Main area: px-6 py-8 content region.
Bypass behavior: when pathname === "/login" or starts with /login/, the shell returns bare children — login screens render full-bleed.

The navigation array enumerates the primary sections:

Route	Label	Icon	Status
/dashboard	Dashboard	LayoutDashboard	Active
/properties	Inmuebles	Building2	Active
/matches	Duplicados	Sparkles	Active
/activity	Actividad	Activity	Active
/searches	Búsquedas	LayoutGrid	Disabled (aria-disabled) — not yet implemented

The shell fetches /api/auth/session on mount and renders the UserMenu only once an email is resolved, gracefully handling the unauthenticated boot sequence.

7.3.2 Ui Primitives And Component Library

The barrel export at src/components/ui/index.ts provides a curated primitives library that constitutes the web design system:

Primitive	Purpose
Button	Variant + size system (default, ghost, outline, etc.)
Input, Textarea, Select, Checkbox	Form controls aligned with the design tokens
Field	Labeled field wrapper with label, hint, error, required marker
Card, CardHeader, CardTitle, CardBody	Semantic container composition
Badge	Pill labels with tone variants and optional leading dot
StatusBadge	Maps application status codes (FOR_SALE, RESERVED, SOLD, WITHDRAWN) to Spanish labels
Chip	Compact pill control
EmptyState	Centered placeholder with icon, description, action
Stat	KPI metric tile (label + value + optional hint)
Table, THead, TH, TR, TD	Semantic table scaffold
PageHeader, FormSection	Page and form layout primitives
PriceDelta	Compares two cent-denominated prices; classifies up/down/flat; renders Lucide icons with semantic color classes
7.3.3 Brand Iconography

The brand icon library at src/components/brand/icons.tsx defines nine inline SVG components, all using a 24×24 viewBox and accepting { size, className, strokeWidth }. They are registered in a BRAND_ICONS map exposing a BrandIconKey union type for compile-safe selection.

Component	Theme	Notes
IconHorreo	Asturian granary	Regional landmark with 4 pegollos (stilts)
IconHouseMark	Generic house silhouette	Neutral fallback option
IconPicos	Picos de Europa + house	Landscape + dwelling composition
IconChevron	Abstract chevron monogram	SaaS-style alternative
IconTag	Price tag	E-commerce reference
IconKey	Medieval key (PRIMARY)	Selected master mark; brass accent overlay
IconPin	Map pin with house	Real-estate + cartography
IconPortfolio	Two overlapping houses	Multi-property
IconExchange	Two opposed chevrons	Buy/sell flow

The /brand route (src/app/brand/page.tsx) is an internal design-review screen that iterates over an ACCENTS array of 4 candidate accent colors and renders every icon at four sizes (16/24/36/56px) across three usage treatments (filled sidebar chip, outlined, on-primary).

7.3.4 Screen Inventory

The complete web route map under src/app/:

Route	File	Rendering	Purpose
/	page.tsx	redirect	Forwards to /properties via next/navigation.redirect
/login	login/page.tsx	force-dynamic	Passwordless magic-link sign-in
/dashboard	dashboard/page.tsx	force-dynamic	KPI overview + "Necesita atención" panel
/properties	properties/page.tsx	force-dynamic	Property catalog with filters, sort, table/grid toggle
/properties/new	properties/new/page.tsx	server	Create-property form shell
/properties/[id]	properties/[id]/page.tsx	force-dynamic	Property detail (read-only)
/properties/[id]/edit	properties/[id]/edit/page.tsx	server	Edit-property form
/activity	activity/page.tsx	force-dynamic	Chronological price-change timeline
/matches	matches/page.tsx	force-dynamic	Duplicate-property review queue
/bookmarklet	bookmarklet/page.tsx	force-static	Userscript installation/onboarding
/brand	brand/page.tsx	server	Internal design-review showcase

Internal Routes

Authenticated Routes

Public Routes

/brand
Design Review

/dashboard
KPIs + Attention

/properties
Catalog + Filters

/properties/new
Create Form

/properties/[id]
Detail View

/properties/[id]/edit
Edit Form

/activity
Price Timeline

/matches
Duplicate Queue

/login
Magic-link sign-in

/bookmarklet
Userscript onboarding

/

redirect

verify token

create

row click

Editar

similar

shortcuts

shortcuts

shortcuts

merge

row click

7.3.5 Detailed Screen Specifications
7.3.5.1

The login route follows a three-file pattern:

page.tsx: Centered card layout with the IconKey brand mark and "BuySell Asturias" heading. Copy: "Accede a tu cuenta / Te enviaremos un enlace por email para entrar sin contraseña."
LoginForm.tsx ("use client"): Email input with mail icon, submit button "Enviarme el enlace". Success state shows a CheckCircle2 icon with "Email enviado" plus a spam-folder reminder. Reacts to ?check=email (forces success view) and ?error= query parameters.
actions.ts ("use server"): Server action sendMagicLinkAction(FormData) validates email, calls signIn("email", { email, redirectTo: "/dashboard", redirect: false }), handles the NEXT_REDIRECT thrown internally by NextAuth, and returns { ok: boolean, error?: string }.
7.3.5.2

A dynamic = "force-dynamic" async server component that runs approximately 10 Prisma queries in parallel via Promise.all. Module constants define STALE_DAYS = 7, MANUAL_PORTALS = ["IDEALISTA", "MILANUNCIOS", "YAENCONTRE"], and a PORTAL_LABEL map for display.

Composed of six sections:

PageHeader with title.
KPI strip — four Stat cards: Active properties (FOR_SALE), Sold, Withdrawn, Total listings.
Portal distribution card — proportional bars per portal.
City benchmark card — top 8 cities by average €/m² via raw SQL (cities with ≥2 properties).
"Necesita atención" card — stale automatic listings, stale manual-portal listings, pending duplicate matches, photos missing perceptual hash.
Recent activity card — count of price snapshots in the last 30 days plus a shortcut link to /activity.

A local AttentionRow helper standardizes the icon + label + hint + clickable Badge (rendered as a link only when count > 0) pattern across the attention section.

7.3.5.3

dynamic = "force-dynamic". URL state holds the full filter set: ?city=&type=&status=&minPrice=&maxPrice=&minRooms=&hasFireplace=&hasGarage=&hasTerrace=&sort=&view=.

Control	Options
Sort	updatedAt-desc (default), createdAt-desc, currentPrice-asc, currentPrice-desc
View	table (default), grid

The query fetches up to 100 properties with media (first photo) and price history. The layout uses grid lg:grid-cols-[1fr_280px] (content + sticky filter sidebar). The top bar embeds the SortMenu and ViewToggle in a rounded-lg border bg-surface px-3 py-2 shadow-xs container. The empty state uses the EmptyState primitive with the Building2 icon and a "Nuevo inmueble" CTA.

7.3.5.4

A minimal route wrapper composed of a PageHeader (title "Nuevo inmueble", description "Rellena lo esencial ahora; luego añades fotos y anuncios."), a "← Volver" ghost button back to /properties, and <PropertyForm mode="create" /> rendering the actual form contract.

7.3.5.5

dynamic = "force-dynamic", owner-scoped via requireUserId(). Uses a two-column layout (lg:grid-cols-[1fr_320px]):

Left column (main):

Gallery
Descripción card
SimilarPropertiesCard
Histórico de precio (with PriceDelta indicator and PriceHistoryChart)
Entorno (tag chips)
Planos card with media source labels: "Plano oficial (Catastro)" / "Boceto estimado por IA" / "Reconstrucción IA" / "Del portal" / "Subido por el usuario"

Right column (aside):

Status + price card: StatusBadge + PriceDelta + 3xl tabular price + €/m²
Características card: spec rows for Type, Rooms, Bathrooms, Built area, Usable area, Plot, Floor, Year + extras chips + energy rating
Ubicación card: address, neighborhood, postal code, city, province, country + CadastreCard
Anuncios vinculados card

Header actions: "← Volver", SearchOtherPortalsButton, "Editar".

Type labels are mapped to Spanish display strings: PISO/HOUSE/ATICO/CHALET/DUPLEX/ESTUDIO/LOFT/LOCAL/TERRENO/OTRO. The feature flags rendered with Lucide icons are: hasElevator, hasGarage, hasStorage, hasTerrace, hasFireplace, hasGarden, hasPool.

7.3.5.6

Reuses the same PropertyForm component with mode="edit" and an initial-data prop prefilled from the same Prisma query used by the detail page.

7.3.5.7

dynamic = "force-dynamic". Fetches the latest 100 PriceSnapshot rows. The page classifies each snapshot into a direction of up | down | flat | sold (where sold takes precedence), and applies a style map per direction producing an icon, foreground, background, and label. A formatRelative helper produces Spanish relative timestamps: Hoy, Ayer, Hace N días, Hace N sem., or an absolute formatted date.

The layout flows: PageHeader → 3 KPI Stat cards (price drops, increases, sold counts in last 30d) → a timeline grouped by day. Each row shows property title (Link to detail), city, direction Badge, previous→current prices, portal Badge, and relative time. The empty state uses the EmptyState primitive.

7.3.5.8

dynamic = "force-dynamic". Filters: dismissedAt: null, score >= 60, ordered by score desc, limited to 100. Owner-scoped through sourceId membership in the user's properties.

Two empty-state branches:

No properties at all — Sparkles icon with onboarding copy.
No pending matches — friendly "all caught up" note.

Rendering is delegated to MatchesList in @/features/matching/MatchesList.

7.3.5.9

dynamic = "force-static". Two-card layout:

"Cómo importar inmuebles a BuySell" — Tampermonkey requirement note (Idealista blocks bookmarklets via CSP), links to Chrome/Edge/Brave and Firefox extensions, mentions Violentmonkey as alternative.
Notas técnicas — GM_xmlhttpRequest CORS bypass, localhost target details, selector maintenance notes.

The page generates portal-specific userscript links from a slug array: idealista, fotocasa, pisos, habitaclia, yaencontre, thinkspain, indomio. Each link points at /api/bookmarklet/<slug>.user.js. The BookmarkletLink.tsx component renders a draggable anchor with preventDefault and an alert prompting the user to drag rather than click; BookmarkletTextarea.tsx renders a read-only textarea with focus-select for copy.

7.3.5.10

Internal route used for accent-color and brand-icon review. The ACCENTS array holds four candidate accent values with hex codes and descriptive notes; each is applied via an inline --brand-accent CSS custom property override. Each BRAND_ICONS entry is rendered in a Card with header + a size grid (16/24/36/56px) + three usage treatments (filled sidebar chip / outlined / on primary). Trailing instructions guide the reviewer to wire the selected mark into AppShell and use it to generate a favicon.

7.4 Mobile Application Interface
7.4.1 Navigation Architecture

The mobile app uses Expo Router's file-based routing under apps/mobile/app/. The root layout (_layout.tsx) composes:

state.kind = loading

unauthed + not /login

authed + at /login

_layout.tsx

AuthProvider
(JWT + OTP context)

ThemeProvider
DarkTheme / DefaultTheme
via useColorScheme

AuthGate
(redirect logic)

Stack Navigator

login
(headerShown: false)

(tabs)
(headerShown: false)

property/[id]
(custom header)

modal
(presentation: modal)

ActivityIndicator
on #FAFAF7

router.replace('/login')

router.replace('/(tabs)')

The custom header on property/[id] uses headerTintColor: "#3A5F8A" and headerStyle: { backgroundColor: "#fff" } with a blank title overridden per-screen.

The tab navigator ((tabs)/_layout.tsx) declares constants PRIMARY = "#3A5F8A" and MUTED = "#999", hides the header globally, and styles the tab bar with a white background, #e5e5e5 top border, and label style fontSize: 11, fontWeight: "500".

Order	Name	Title	Ionicon
1	index	Inmuebles	home-outline
2	matches	Duplicados	sparkles-outline
3	search	Buscar	search-outline
4	account	Cuenta	person-outline
Hidden	explore	—	(href: null) — vestigial Expo template demo
7.4.2 Screen Inventory
Route	File	Type
/login	login.tsx	Two-phase OTP auth screen
/(tabs)/index	(tabs)/index.tsx	Inmuebles (property list)
/(tabs)/matches	(tabs)/matches.tsx	Duplicados (duplicate review)
/(tabs)/search	(tabs)/search.tsx	Buscar (debounced search)
/(tabs)/account	(tabs)/account.tsx	Cuenta (profile + logout)
/(tabs)/explore	(tabs)/explore.tsx	Hidden — vestigial demo route
/property/[id]	property/[id].tsx	Property detail
/modal	modal.tsx	Generic modal
7.4.3 Detailed Mobile Screen Specifications
7.4.3.1

A two-phase passwordless flow, distinct from the web's magic-link approach because cookies cannot bridge a native app:

Phase 1 — Email entry:

TextInput with keyboardType="email-address", autoCapitalize="none", autoComplete="email"
Primary button "Enviarme el código" (44px height, #3A5F8A background, white text, 0.5 opacity when disabled)
Calls useAuth().requestOtp(email) which triggers backend OTP generation

Phase 2 — Code entry:

6-digit numeric TextInput styled as a code field: monospace font (Menlo/monospace), letter-spacing 8, center-aligned, maxLength={6}, keyboardType="number-pad"
Primary button "Acceder"
Secondary link "← Cambiar email" to return to Phase 1
Calls useAuth().verifyOtp(email, code) which returns the HS256 JWT and stores it in expo-secure-store

Visual elements:

Brand block: 56×56 rounded square with #EAEFF6 background and 🔑 emoji + "BuySell Asturias" title
Card: white surface, borderRadius: 12, 24px padding, #e5e5e5 border
Footer text: "Sin contraseñas. Cada acceso pide un código por email."
Outer container: #FAFAF7 background (matches web), SafeAreaView wrapping KeyboardAvoidingView (iOS uses padding behavior)
7.4.3.2

Guards rendering with useAuth() (state.kind === "authed"). Fetches /api/properties through the shared api() helper in apps/mobile/lib/api.ts.

State	Display
Loading	ActivityIndicator
Error	#B91C1C red text
Empty	Hint instructing the user to use /bookmarklet on the web to import
Data	FlatList of PropertyCard components

The header shows "Inmuebles" (22px, weight 700) plus a "N fichas" count. Pull-to-refresh uses RefreshControl with tint #3A5F8A. Container background is #FAFAF7.

7.4.3.3

Fetches /api/matches ({ items: Match[] }). Each card displays:

A score badge with color coding: #15803D (≥90), #A86A17 (≥70), otherwise #666, all using a 22 hex alpha background.
A reasons block (2-line truncated).
Two PropTiles separated by an ↔ arrow glyph.

The PropTile subcomponent renders an expo-image thumbnail (4:3 aspect ratio, #f3f3f3 placeholder), a 2-line truncated title, and a city + price meta line. Each tile wraps a Link href="/property/[id]". Pull-to-refresh is enabled. Empty state: "Sin duplicados pendientes" plus helper text.

7.4.3.4

Free-text TextInput with a search Ionicon (16px, #999) and placeholder "Título, ciudad, barrio, ref. catastral…". Query is debounced at 250ms (compared to 200ms on the web's GlobalSearch), and queries shorter than 2 characters are ignored.

Hits /api/search?q=... ({ results: SearchResult[] }). Results render as PropertyCard components with synthesized fields (status = "FOR_SALE", rooms/bathrooms/builtArea = null) because the search endpoint returns a slim projection. Empty state: Sin resultados para "{q}". A loading indicator renders inline on the right of the search bar while the query is in flight.

7.4.3.5
Profile card: a 56×56 round avatar with #EAEFF6 background showing the first 2 characters of the email, uppercased; below it the email (15px, weight 500) and optional display name.
"Servidor" section: shows the API_URL constant in monospace, helpful for troubleshooting LAN connectivity (default http://192.168.1.77:4200).
Logout button: full-width, "Cerrar sesión" with a log-out-outline Ionicon, red text (#B91C1C), white card surface with a #F6E5E5 border.
Footer: "BuySell Asturias · v0.1.0"

The screen returns null when not authenticated, which is a defensive guard since AuthGate should have already redirected.

7.4.3.6

Reads id from useLocalSearchParams and fetches /api/properties/${id}. Three states (loading, error with Stack.Screen title "Error", and data). Custom header: title truncated to 30 chars, back button using a chevron-back Ionicon calling router.back().

Sections (each in a card with borderRadius: 10):

Horizontal paged gallery — Image from expo-image with width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.66, contentFit: "cover", 150ms transition
Photo count — "📸 N fotos" right-aligned
Title + location chain + price — price at 26px weight 700, plus €/m² when both builtArea and currentPrice are present
Características — 2-column grid of Spec tiles (Habitaciones, Baños, Construidos, Útiles, Parcela, Planta, Año, Energía) + amenity tag chips
Descripción (conditional)
Anuncios vinculados (conditional) — each row taps Linking.openURL(l.url) with an open-outline icon
Catastro (conditional) — displays the cadastralRef value
7.4.3.7

Minimal centered container with a title and a Link back to / to dismiss. Used as a placeholder for future modal-presented flows.

7.5 Ui / Backend Interaction Boundaries
7.5.1 Web Boundaries

The web application crosses the UI/backend boundary through three distinct mechanisms:

Backend

Boundary Bridge

Web UI Layer

PostgreSQL 17

NextAuth v5
cookie session

requireUserId()

Prisma Singleton
@/lib/db

/api/* REST Routes

Server Components
(async functions)

'use client' Components
(React 19 + hooks)

Server Actions
('use server')

direct query

fetch()

signIn / signOut

sets cookie

Server Components (the majority of pages) read directly from the Prisma client (@/lib/db) using requireUserId() for owner scoping. They are async functions that resolve their data at request time (dynamic = "force-dynamic").

Client Components (marked "use client") call internal /api/* REST endpoints via the standard fetch() API. The NextAuth cookie is auto-attached. Confirmed boundary crossings observed in the codebase:

Endpoint	Method	Caller	Purpose
/api/auth/session	GET	AppShell	Retrieve user email for UserMenu
/api/auth/signout	POST	UserMenu	Sign out, then window.location.href = "/login"
/api/search?q=...	GET	GlobalSearch (debounced 200ms)	Type-ahead search
/api/properties	GET / POST	PropertyForm	List / create
/api/properties/[id]	PATCH	PropertyForm (edit)	Update
/api/properties/[id]/merge	POST	MatchesList	Merge duplicates ({ intoId })
/api/properties/[id]/dismiss-match	POST	MatchesList	Dismiss candidate ({ candidateId })
/api/matches	GET	MatchesList	Hydration

Server Actions — currently used only by the login flow. sendMagicLinkAction(FormData) in src/app/login/actions.ts wraps signIn("email", …) and is invoked via a form action={…} attribute, eliminating the need for a dedicated API route.

7.5.2 Mobile Boundaries

All mobile requests flow through a single helper at apps/mobile/lib/api.ts:

Concern	Implementation
Base URL	EXPO_PUBLIC_API_URL (LAN default http://192.168.1.77:4200), baked at build time
Auth credential	HS256 JWT stored in expo-secure-store under key buysell.mobile.token
Auth header	Authorization: Bearer <token> on every request
Context provider	AuthProvider exposing requestOtp, verifyOtp, logout
External links	Linking.openURL(l.url) for listing URLs
Endpoint	Method	Caller
/api/auth/mobile/otp/request	POST	useAuth().requestOtp(email)
/api/auth/mobile/otp/verify	POST	useAuth().verifyOtp(email, code)
/api/properties	GET	(tabs)/index
/api/properties/${id}	GET	property/[id]
/api/search?q=...	GET	(tabs)/search (debounced 250ms)
/api/matches	GET	(tabs)/matches
7.5.3 Communication Patterns

The mobile and web surfaces share the same /api/properties, /api/search, and /api/matches endpoints — the backend is unaware of the calling client. The differentiator is the authentication token presented:

Web → NextAuth session cookie (set by magic-link verification)
Mobile → Authorization: Bearer <HS256-JWT> (verified by src/lib/mobile-jwt.ts)
Userscript → Authorization: Bearer bs_<64-hex> (verified by src/lib/api-token.ts)

A getUserId() cascade in src/lib/auth-helpers.ts resolves the user ID from whichever credential is present, transparently bridging the three auth models to a single owner-scoping mechanism.

7.6 Ui Data Schemas

The UI surfaces consume a small set of TypeScript types that mirror the Prisma model but are intentionally pruned for display.

7.6.1 Property Card Schema

Used by both mobile (PropertyCard.tsx) and web list views:

type PropertyCardData = {
  id: string;
  title: string;
  city: string;
  neighborhood: string | null;
  type: string;            // PISO|HOUSE|ATICO|CHALET|DUPLEX|ESTUDIO|LOFT|LOCAL|TERRENO|OTRO
  status: string;          // FOR_SALE|RESERVED|SOLD|WITHDRAWN
  currentPrice: number | null;  // stored as cents
  rooms: number | null;
  bathrooms: number | null;
  builtArea: number | null;
  media: { url: string }[];
};
7.6.2 Property Detail Schema

The mobile detail screen (apps/mobile/app/property/[id].tsx) extends PropertyCardData with:

description, address, province
usableArea, plotArea, floor, yearBuilt
All boolean amenity flags: hasElevator, hasGarage, hasStorage, hasTerrace, hasFireplace, hasGarden, hasPool
energyRating, cadastralRef, tags
Full media[] array with kind discriminator (PHOTO / FLOORPLAN / etc.)
listings[] with portal, url, lastPrice, lastCheckedAt
7.6.3 Match Schema

Used by web MatchesList and mobile (tabs)/matches.tsx:

type Match = {
  id: string;
  score: number;
  reasons: string[];
  source: PropMin;
  target: PropMin;
};

type PropMin = {
  id: string;
  title: string;
  city: string;
  currentPrice: number | null;
  media: { url: string }[];
  listings: { portal: string; url?: string }[];
};
7.6.4 Search Result Schema

Returned by /api/search, consumed by both GlobalSearch (web) and (tabs)/search (mobile):

type SearchResult = {
  id: string;
  title: string;
  city: string;
  neighborhood: string | null;
  currentPrice: number | null;
  type: string;
  media: { url: string }[];
};
7.6.5 Property Form Payload

The PropertyForm.tsx component (used by both /properties/new and /properties/[id]/edit) transforms FormData before submission:

Transformation	Detail
Empty stripping	Empty string values removed from payload
Price conversion	currentPrice euros → cents via Math.round(Number(v) * 100)
Tag splitting	tags CSV split into trimmed array
Feature coercion	Checkbox values (hasElevator, …) coerced to `true
Submission	POST /api/properties (create) or PATCH /api/properties/[id] (edit)
Post-success	router.push("/properties/" + saved.id) followed by router.refresh()

Allowed enum values exposed by the form:

Enum	Values
TYPES	PISO, HOUSE, ATICO, CHALET, DUPLEX, ESTUDIO, LOFT, LOCAL, TERRENO, OTRO
STATUSES	FOR_SALE, RESERVED, SOLD, WITHDRAWN
FEATURES	hasElevator, hasGarage, hasStorage, hasTerrace, hasFireplace, hasGarden, hasPool
7.7 User Interactions And Workflows
7.7.1 Authentication Flows

The web and mobile surfaces implement structurally distinct authentication flows driven by platform constraints (cookies are not portable to native apps).

mobile-jwt.ts
Mobile API
Mobile UI (login.tsx)
Resend
NextAuth v5
Server Action
Web UI (LoginForm)
User
mobile-jwt.ts
Mobile API
Mobile UI (login.tsx)
Resend
NextAuth v5
Server Action
Web UI (LoginForm)
User
Web Flow — Magic Link
Mobile Flow — OTP
Enter email
1
sendMagicLinkAction(FormData)
2
signIn("email", {email, redirect: false})
3
Send magic link email
4
Email with link
5
Success view "Email enviado"
6
Click link in email
7
Verify token
8
Set cookie, redirect /dashboard
9
Enter email
10
requestOtp(email)
11
Send 6-digit code email
12
Email with code
13
Enter 6-digit code
14
verifyOtp(email, code)
15
Sign HS256 token (90d)
16
Token
17
{ token }
18
SecureStore.setItemAsync("buy-
sell.mobile.token", token)
19
router.replace("/(tabs)")
20

Web — Magic Link:

User enters email in LoginForm → server action sendMagicLinkAction(FormData) fires.
Resend sends the email containing the magic link (or console.log falls back when RESEND_API_KEY is unset).
Success view shows "Email enviado" with a CheckCircle2 icon and spam-folder reminder.
User clicks the link → NextAuth verifies → cookie session established → redirect to /dashboard.

Mobile — OTP:

Phase email: TextInput → requestOtp(email) → backend sends a 6-digit code via Resend.
Phase code: 6-digit numeric TextInput → verifyOtp(email, code) → backend returns an HS256 JWT.
JWT is saved in expo-secure-store. AuthGate observes state.kind === "authed" and redirects to /(tabs).
7.7.2 Property Management Flows
Flow	Surface	Entry Point	Mechanism
Browse	Web	/properties	URL-state filters (city, type, status, price, rooms, amenities), sort dropdown, table↔grid toggle
Create	Web	/properties/new	PropertyForm (mode="create") → POST → redirect to detail
View detail	Web + Mobile	/properties/[id]	Read-only with side-panel summary (web) / stacked cards (mobile)
Edit	Web	/properties/[id]/edit	PropertyForm (mode="edit") → PATCH
External search	Web	SearchOtherPortalsButton	Dropdown opens outbound searches on other portals (excluding current), optional Google Lens reverse-image search
Recheck listing	Web	ListingRecheck button	Per-listing portal recheck with stale warnings + toast feedback
Merge duplicates	Web	MatchesList	confirm() dialog → POST /api/properties/[sourceId]/merge with { intoId }
Dismiss match	Web	MatchesList	POST /api/properties/[sourceId]/dismiss-match with { candidateId }
7.7.3 Search Interactions
Behavior	Web (GlobalSearch)	Mobile ((tabs)/search)
Debounce	200 ms	250 ms
Minimum query length	n/a	2 characters
Result panel	Dropdown with thumbnail + title + city + price (right-aligned tabular)	Vertical FlatList of PropertyCard
Dismissal	Outside-click via document.addEventListener("mousedown")	Native back / clear input
Loading affordance	Subtle spinner overlay	Inline spinner inside search bar (right side)
Endpoint	/api/search?q=…	/api/search?q=…
7.7.4 Duplicate Detection Workflows

The duplicate review surface is one of the most consequential interaction patterns:

Merge (destructive)

Dismiss

Skip

OK

Cancel

Pending matches surface in:
• Dashboard 'Necesita atención'
• /matches list
• Mobile (tabs)/matches

User reviews score, reasons, both PropTiles

Decision

confirm() dialog
(detailed Spanish copy
explaining consequences)

POST /api/properties/[id]/
dismiss-match { candidateId }

POST /api/properties/[sourceId]/
merge { intoId }

Source merged into target
Listings re-pointed
Snapshots preserved

Because merge is destructive, the UI uses native confirm() with detailed Spanish copy explaining the consequences before issuing the request.

7.7.5 Visual Feedback Patterns
Feedback	Pattern	Implementation
Pending submit	Button disables + label change to "Enviando…"	useTransition + pending state
Confirmation toasts	Native alert() (basic)	Standard browser dialog
Destructive confirmations	Native confirm() with Spanish copy	Browser-native modal
Empty states	Composed EmptyState primitive	Icon + title + description + optional CTA
Loading states	ActivityIndicator (mobile) / pulse-animated placeholder (web Suspense)	Standard primitives
Status badges	StatusBadge mapped to Spanish labels with semantic colors	Built on Badge primitive
Price deltas	PriceDelta icon + colored chip (up = red, down = green, flat = neutral)	Lucide icons + semantic CSS classes
7.8 Visual Design Considerations
7.8.1 Language And Localization

The application is entirely Spanish-language. Every label, copy block, error message, and placeholder is authored in Spanish — examples include "Inmuebles", "Duplicados", "Actividad", "Email enviado", "Sin resultados", "Cerrar sesión", and "Nuevo inmueble".

HTML lang attribute: <html lang="es"> is set in src/app/layout.tsx.
Number formatting: toLocaleString("es-ES") is used for €/m² values throughout the property detail page.
Date formatting: relative time helpers produce Spanish output (Hoy, Ayer, Hace N días, Hace N sem.), and absolute dates use formatDate from @buysell/shared.
7.8.2 Color Palette And Tokens

The palette is detailed in Section 7.2.3.1. The salient visual decisions:

Surfaces are warm off-white, not pure white (#FAFAF7 background, #FFFFFF cards) — this softens the screen for long management sessions.
Color is used sparingly — semantic colors are reserved for status badges, alerts, price deltas, and the brand accent.
Shadows are barely perceptible — all three shadow tiers use rgba(20, 20, 18, 0.04–0.06), far below typical SaaS UI levels, reinforcing the "sober" identity.
7.8.3 Typography System
Body: 13px Inter with line-height 1.5 — information-dense and explicitly small for a management UI.
Scale: 8 tiers from xs (12px) to 3xl (32px) with tuned letter-spacing for headings.
Stylistic features: cv11, ss01, ss03 (Inter alternates) enabled globally.
Tabular numerics: a dedicated .tabular class enables font-variant-numeric: tabular-nums so prices and KPIs align cleanly in columns.
7.8.4 Iconography Strategy
Surface	Library	Tone
Web (in-app)	lucide-react	Line icons, 24px nominal
Web (brand)	Inline SVG via src/components/brand/icons.tsx	Custom, with IconKey as primary mark
Mobile	@expo/vector-icons Ionicons (outline variants)	home-outline, sparkles-outline, search-outline, person-outline, chevron-back, log-out-outline, etc.

The deliberate use of outline-style iconography on both surfaces ties together the sober visual language.

7.8.5 Responsive Behavior
Breakpoint	Web Behavior
< md (768px)	Sidebar hidden (hidden ... md:flex); top bar only
≥ md	Full sidebar visible
< lg	Properties page filters and detail asides stack below content
≥ lg	lg:grid-cols-[1fr_280px] on /properties, lg:grid-cols-[1fr_320px] on /properties/[id]
Grid view	grid-cols-1 md:grid-cols-2 xl:grid-cols-3

The mobile app is phone-first with SafeAreaView insets. Tablet support is enabled in app.json (supportsTablet: true) and react-native-web is included for potential web preview, but the layouts are not specifically tablet-optimized beyond what flexbox provides.

7.8.6 Accessibility Features

Accessibility affordances observed in the codebase:

Universal focus-visible ring: 2px solid --primary with 2px offset, declared globally in globals.css.
Semantic disabled states: aria-disabled on the disabled "Búsquedas" nav link in AppShell.
Decorative SVG handling: aria-hidden="true" on brand SVG icons that are paired with text labels.
Input autocomplete hints: autoComplete="email" on email inputs (both web and mobile).
Mobile keyboard hints: keyboardType="email-address" and keyboardType="number-pad" on email and OTP inputs respectively.
Capitalization control: autoCapitalize="none" on email, code, and search inputs (mobile).
Placeholder styling: subtle text color (--text-subtle / #9A9690) preserves contrast while distinguishing from filled values.
7.8.7 Cultural Identity

The product's regional Asturian identity is woven into the UI in several subtle ways:

IconHorreo — the Asturian granary on stilts is one of the brand icon options, labeled "Distintivo regional" in the design showcase.
IconPicos — the Picos de Europa mountain range (Asturias' iconic landscape) is another candidate brand mark.
Default placeholders — the city field in PropertyForm uses "Oviedo" as a placeholder example.
Catastro/cadastral integration — the CadastreCard on the property detail screen surfaces Spanish cadastral references natively, reinforcing the product's deep integration with Spanish government data.

The combination of muted steel-blue primaries, brass accents, Asturian regional iconography, and Spanish-only copy gives the product a distinctive identity within the Spanish real-estate tooling market — visibly different from the dominant portal aesthetics described in Section 1.2.1.1.

7.9 References
Files Examined

Configuration & Documentation:

tailwind.config.ts — Design system tokens, font scales, color mappings to CSS variables
src/app/layout.tsx — Root HTML scaffold, Inter font, AppShell wrapping
src/app/globals.css — Complete CSS custom property palette and global styles
next.config.ts — Image optimization remote patterns allowlist
apps/mobile/app.json — Mobile manifest, deep-link scheme, New Architecture
apps/mobile/package.json — Mobile dependency declarations
package.json — Web dependency declarations

Web Shell & Design System:

src/components/AppShell.tsx — Sidebar, navigation, top header, GlobalSearch integration
src/components/GlobalSearch.tsx — Debounced global search dropdown
src/components/UserMenu.tsx — Profile dropdown and logout
src/components/ui/index.ts — UI primitives barrel exports
src/components/brand/icons.tsx — Nine brand SVG icons (IconHorreo, IconKey, etc.)

Web Routes:

src/app/login/page.tsx — Login page shell
src/app/login/LoginForm.tsx — Magic-link client form
src/app/login/actions.ts — sendMagicLinkAction server action
src/app/dashboard/page.tsx — KPI dashboard with parallel queries
src/app/properties/page.tsx — Property catalog page
src/app/properties/new/page.tsx — Create wrapper
src/app/properties/[id]/page.tsx — Property detail
src/app/properties/[id]/edit/page.tsx — Edit wrapper
src/app/activity/page.tsx — Activity timeline
src/app/matches/page.tsx — Duplicate review queue
src/app/bookmarklet/page.tsx — Userscript onboarding
src/app/brand/page.tsx — Internal design showcase

Web Feature Components:

src/features/properties/PropertyForm.tsx — Create/edit form contract and transformations
src/features/matching/MatchesList.tsx — Duplicate match review UI

Mobile Routes:

apps/mobile/app/_layout.tsx — Root layout, AuthProvider, ThemeProvider, AuthGate, stack
apps/mobile/app/login.tsx — Two-phase OTP login
apps/mobile/app/(tabs)/_layout.tsx — Bottom tab navigator configuration
apps/mobile/app/(tabs)/index.tsx — Inmuebles list screen
apps/mobile/app/(tabs)/search.tsx — Buscar screen
apps/mobile/app/(tabs)/matches.tsx — Duplicados screen
apps/mobile/app/(tabs)/account.tsx — Cuenta screen
apps/mobile/app/property/[id].tsx — Property detail (mobile)
apps/mobile/app/modal.tsx — Generic modal stub

Mobile Components:

apps/mobile/components/PropertyCard.tsx — Reusable property card primitive
apps/mobile/lib/api.ts — API helper with EXPO_PUBLIC_API_URL and Authorization: Bearer header
Folders Explored
src/ — Web app source root
src/app/ — Next.js App Router root
src/app/properties/, src/app/properties/[id]/, src/app/properties/new/ — Property routes
src/app/dashboard/, src/app/activity/, src/app/matches/, src/app/bookmarklet/, src/app/brand/, src/app/login/ — Top-level route groups
src/components/ — Shared web components
src/components/ui/ — UI design system primitives
src/features/ — Domain feature components
src/features/properties/, src/features/matching/ — Property and matching feature UIs
apps/ — Mobile workspace container
apps/mobile/ — Expo mobile app
apps/mobile/app/ — Mobile route tree
apps/mobile/app/(tabs)/, apps/mobile/app/property/ — Mobile route groups
apps/mobile/components/ — Mobile shared components
Technical Specification Cross-references
Section 1.2 SYSTEM OVERVIEW — Project context, capability inventory, and confirmed stack versions
Section 3.2 FRAMEWORKS & LIBRARIES — Authoritative version pinning for web and mobile
Next.js Web Application (Section 6.1.2) — UI/backend communication patterns, sidecar boundary, mobile bearer flow
Section 5.1 HIGH-LEVEL ARCHITECTURE — System overview and component diagrams
Section 6.4 Security Architecture — Three concurrent token systems (NextAuth cookie, mobile JWT, API token) bridged by getUserId()
8. Infrastructure
8.1 Infrastructure Applicability Assessment
8.1.1 Current Posture Statement

Detailed enterprise-grade Infrastructure Architecture is not applicable for this system in its current state. BuySell Asturias is deliberately designed as a personal-scale, single-tenant Next.js 15 modular monolith with one Playwright sidecar, sized to run on a single host with Docker Compose providing only a local PostgreSQL 17 container. The architectural intent is to keep the deployable surface small, defer distributed-systems complexity until the user base warrants it, and isolate only the components that must be isolated (Playwright, because of binary weight and runtime constraints). Per ADR-1 (Section 5.3.6), the system is sized for a personal-scale, single-tenant operator with a single team, a single database, and no service-team boundaries.

This section is therefore documented in hybrid form: the system does host two distinct OS-level service processes plus a database container with well-defined inter-process boundaries, and these are documented here in full. However, most of the canonical infrastructure concerns (cloud deployment, container orchestration, CI/CD pipelines, Infrastructure as Code, autoscaling, distributed monitoring) are intentionally not implemented and are tracked as critical Phase-1 gaps in docs/ROADMAP.md.

8.1.2 Infrastructure Inventory: Present Vs. Absent

The following matrix consolidates the canonical infrastructure components and their disposition in the current codebase. This is the authoritative reference for "what exists today" — every claim has been verified against repository contents.

Component	Status	Source / Evidence
Local PostgreSQL container	✅ Present	docker-compose.yml (17 lines, single service)
buysell-pgdata named volume	✅ Present	docker-compose.yml line 13
Two-process topology (Next.js + Sidecar)	✅ Present	package.json scripts; scripts/scraper-service.mjs
.env.example env contract	✅ Present	7 documented variables
npm-script operational tooling	✅ Present	package.json (16 root scripts)
Production Dockerfile	❌ Absent	Repository scan returns empty
.github/workflows/ CI/CD pipeline	❌ Absent	Directory does not exist
Cloud deployment	❌ Absent	No provider selected; deferred per Section 3.4.4
Infrastructure as Code (Terraform, Pulumi, CloudFormation, Bicep)	❌ Absent	No .tf, .bicep, or equivalent files
Kubernetes manifests / Helm charts	❌ Absent	No k8s/ or helm/ directories
Container orchestration (Swarm, Nomad, ECS, EKS)	❌ Absent	None configured
.dockerignore	❌ Absent	No build optimization yet
Automated backups (pg_dump cron, snapshot policy)	❌ Absent	Per Section 5.4.6
External monitoring (Sentry, Datadog, OpenTelemetry)	❌ Absent	Per Section 6.5.1.1
Secret management (Vault, KMS, Doppler)	❌ Absent	Process env vars only
8.1.3 Critical Infrastructure Gaps

Per Section 1.2.1.2's gap matrix, the following critical gaps block production-grade operation:

Gap	Severity	Phase 1 Effort	Priority Indicator
No cloud deployment	Critical	2–4h (Dockerfile + Railway/Fly.io)	🔴
No CI/CD pipeline	Critical	Low complexity	🔴
NEXTAUTH_URL not configured for production	Critical	30 min	🔴
Local image storage (public/uploads/)	High	Medium (R2 migration)	🟡
No decoupled cron for scraper	High	3–4h (pg-boss or Railway Cron)	🟠
No real-time sync	High	Phase 2 (SSE/WebSocket)	🟡

The remainder of this section documents both what currently exists and what is planned so future contributors have a complete trajectory reference.

8.2 Deployment Environment
8.2.1 Target Environment Assessment
8.2.1.1 Environment Type

The system currently targets a single local development workstation. There is no on-premises, cloud, hybrid, or multi-cloud deployment configured. Per Section 3.4.4, all cloud topics — hosting, R2/Cloudflare image storage, managed Postgres — are explicitly deferred per docs/ROADMAP.md Phase 1.

The deployable surface consists of two long-running Node processes plus one supporting database container, all colocated on the operator's machine:

Service	Process / Container	Network Surface	Lifecycle
Next.js Web Application	next dev / next start	All interfaces, port 4200	Manual start via npm run dev or npm start
Playwright Sidecar	node scripts/scraper-service.mjs	Loopback only, 127.0.0.1:4201	Manual start via npm run scraper; 5-minute idle close
PostgreSQL Database	postgres:17-alpine Docker container	Container port 5432 (mapped to host)	npm run db:up / npm run db:down
8.2.1.2 Geographic Distribution Requirements

There are no geographic distribution requirements. The product targets Spain exclusively (per Section 1.3.2):

Geo-Specific Setting	Value	Source
Default country	"España"	Sanity defaults in import-listing.ts
Default province	"Asturias"	Sanity defaults in import-listing.ts
HTML language attribute	lang="es"	Hardcoded in root layout
Currency	EUR only (integer cents)	Sanity validators in @buysell/shared
Sidecar locale	es-ES	scripts/scraper-service.mjs browser context
Sidecar timezone	Europe/Madrid	scripts/scraper-service.mjs browser context
Mobile dev API URL	http://192.168.1.77:4200 (LAN IP default)	EXPO_PUBLIC_API_URL in mobile config

Multi-region deployment is explicitly outside scope. ADR-3 (PostgreSQL-only, no read replicas) and the absence of CDN/edge configuration confirm this posture.

8.2.1.3 Resource Requirements

The following resource requirements are derived directly from the codebase and represent the minimum viable host configuration.

Resource	Specification	Source
Node runtime	20+ required	README.md setup instructions
PostgreSQL	Version 17 (alpine variant)	docker-compose.yml
Sidecar memory	~300–500 MB RAM per Chromium instance	docs/ROADMAP.md Fase 2 notes
Playwright Chromium binary	~300 MB on disk	Per Section 5.3.1
Persistent volume	Docker named volume buysell-pgdata	docker-compose.yml line 13
Image storage	Local filesystem public/uploads/ (R2 deferred)	Per Section 3.5.4
Network ports (open)	4200 (web), 5432 (mapped DB)	package.json, docker-compose.yml
Network ports (loopback)	4201 (sidecar)	scripts/scraper-service.mjs

Recommended workstation sizing (extrapolated from observed resource footprint):

Resource	Minimum	Recommended	Justification
CPU	2 cores	4 cores	Concurrent Next.js + Playwright + PostgreSQL
RAM	4 GB	8 GB	Chromium 300–500 MB + Node processes + PG buffer pool
Disk	5 GB	20 GB	Playwright binary, public/uploads/, PG volume growth
Network	Broadband	Broadband	External portal scraping bandwidth
8.2.1.4 Compliance And Regulatory Requirements

Per Section 6.4.4.5, the platform implements no formal regulatory compliance program. The following compliance frameworks are NOT pursued at the current scale:

Framework	Status	Justification
GDPR Article 30 records	Not implemented	Single-tenant personal use; no DPO required
DPIA (Data Protection Impact Assessment)	Not implemented	No high-risk processing
Right-to-erasure flow	Partial (schema-level only)	Property.ownerId ON DELETE SET NULL is the only erasure hook
PCI-DSS	Not applicable	No payment processing (Stripe deferred to Fase 3)
HIPAA	Not applicable	No health data
SOC 2	Not pursued	No enterprise customers
ISO 27001	Not pursued	No certification driver

The Property.ownerId → User.id ON DELETE SET NULL cascade rule is the only GDPR-style erasure hook in the schema — it preserves the property record but severs the identity link, allowing data retention with anonymization. All other foreign keys CASCADE on delete (per Section 3.5.2).

8.2.2 Environment Management
8.2.2.1 Infrastructure As Code (iac) Approach

The repository contains no Infrastructure as Code tooling. Per Section 3.7, Terraform IaC is "Not present — Not adopted." Repository scans confirm the absence of:

IaC Tool	Status	Search Confirmation
Terraform	Absent	No .tf files
Pulumi	Absent	No Pulumi.yaml
AWS CloudFormation	Absent	No cloudformation/
Azure Bicep / ARM	Absent	No .bicep files
Google Cloud Deployment Manager	Absent	No deployment.yaml
Helm charts	Absent	No charts/ directory
Ansible	Absent	No playbook.yml
Pulumi/CDK	Absent	No cdk.json

The closest analog to IaC in the repository is the single-file docker-compose.yml, which declaratively provisions the local PostgreSQL container. This file is the sole infrastructure-as-code artifact in the project.

8.2.2.2 Configuration Management

Configuration management relies exclusively on process environment variables populated from .env / .env.local files following Next.js conventions. The complete env contract is defined by .env.example:

Variable	Purpose	Default
DATABASE_URL	PostgreSQL connection string	postgresql://buysell:buysell@localhost:5432/buysell?schema=public
AUTH_SECRET	HS256 signing secret for NextAuth + mobile JWT	Required, no default
NEXTAUTH_URL	Public URL of the web app	http://localhost:4200
RESEND_API_KEY	Resend email delivery	Optional (console fallback in dev)
RESEND_FROM	Default From: address	Required for production email
ANTHROPIC_API_KEY	Reserved for future AI features	Scaffolded; not active
CATASTRO_BASE_URL	Overridable base URL for Catastro OVC	Default in code
EXPO_PUBLIC_API_URL	Mobile-side base URL for the API	http://192.168.1.77:4200 (LAN IP for dev)
SCRAPER_PORT	Sidecar port	4201
SCRAPER_URL	Optional override for sidecar URL	http://127.0.0.1:4201
BUYSELL_DISABLE_BROWSER_FETCH	Manual circuit breaker for sidecar	Off by default

No secret-management integrations are present (per Section 6.4.4.2): there is no HashiCorp Vault, AWS Secrets Manager, AWS KMS, GCP Secret Manager / KMS, Azure Key Vault, Doppler, or Infisical integration. The .env file is gitignored (line 15 of .gitignore) and is expected to be created manually by the operator following the .env.example template.

8.2.2.3 Environment Promotion Strategy

No staging or production environment is configured. The current promotion model is single-tier:

Environment	Status	Trigger	Configuration
Development	Present	npm run dev	next dev -p 4200; .env.local
Staging	Not configured	—	—
Production	Local only	npm run build && npm start	next start -p 4200; .env
Cloud production	Deferred	Roadmap Fase 1	Railway or Fly.io target

The Phase 1 promotion target documented in docs/ROADMAP.md is a Railway or Fly.io deployment with a Dockerfile that has not yet been authored — listed as a 🔴 Critical priority item with 2–4 hour estimated effort.

8.2.2.4 Backup And Disaster Recovery

Per Section 5.4.6, the current DR posture reflects the product's local/personal-scale deployment context:

DR Mechanism	Current State	Future Plan
PostgreSQL persistence	Docker named volume buysell-pgdata (survives container recreation)	Managed Postgres with provider snapshots (Fase 1)
Automated backups	None — no pg_dump cron, no snapshot policy	Scheduled pg_dump to object storage (Fase 1 prerequisite)
Image storage backup	None — public/uploads/ not versioned	Cloudflare R2 with object versioning (Fase 1)
CI/CD-based recovery	None — no .github/workflows/	GitHub Actions deploy pipeline (Fase 1)
Idempotent operations (primary DR mechanism)	✅ Present per ADR-4	Maintained — re-running operations is safe

Idempotent operations are the primary DR mechanism today. Re-running an import on the same URL hits the update path safely; re-running merge on an already-deleted source returns empty counts; each background pipeline stage is gated on NULL columns so re-imports re-trigger only the missing work. This eliminates the need for atomic transaction recovery.

Manual recovery scripts complement the idempotency posture:

Script	Purpose
hash-photos.ts	Re-tries dHash for media with NULL phash
fix-prices.ts	Recovery for sanity-rejected price corruption
claim-orphans.ts	Assigns ownership to pre-auth data (ownerId IS NULL)
check-listings.ts	Manual trigger of the bulk recheck path

For Phase-1 deployment to managed infrastructure, the DR plan must add scheduled pg_dump exports, an object-storage replica of public/uploads/, and a runbook for sidecar restart procedures. None of these are present in the current codebase.

8.3 Cloud Services
8.3.1 Current State: No Cloud Deployment

Per Section 3.4.4 and Section 1.2.1.2, no cloud provider is selected or in use. Cloud deployment is the #1 critical gap in Section 1.2.1.2's gap matrix. The only containerized service in the repository is the local PostgreSQL 17 container declared in docker-compose.yml.

Reason for absence: The product is in a pre-deployment phase. The architectural intent (per ADR-1) is to defer distributed-systems complexity until the user base warrants it. The author has prioritized vertical capability completeness (12 capability domains per Section 1.2.2.1) over deployment infrastructure during the initial phase.

8.3.2 Roadmap-documented Cloud Service Targets

Cloud service selection is deferred to docs/ROADMAP.md Phase 1. The following targets are documented but not yet implemented:

Service Category	Target Provider	Tier / Plan	Phase
Application hosting	Railway OR Fly.io	TBD	Fase 1
Managed PostgreSQL	Provider-bundled (Railway PG / Fly Postgres)	TBD	Fase 1
Image / object storage	Cloudflare R2	10 GB free tier	Fase 1
Email delivery	Resend (already integrated)	Free or paid tier	Active
Optional caching	Upstash Redis (serverless)	Free tier	Fase 2
Payments	Stripe	Standard fees	Fase 3

The selection criteria (per docs/ROADMAP.md) favor:

Low operational overhead: PaaS providers (Railway, Fly.io) over IaaS (AWS EC2)
Free tiers for personal use: Cloudflare R2's 10 GB tier and Upstash's free Redis tier
Geographic affinity: European-hosted endpoints to minimize latency to Spain-only user base
Predictable cost ramp: Avoids per-request billing surprises during scale-up to Fase 2 target of 100 active users
8.3.3 High Availability Design (roadmap Aspiration)

No HA design is currently implemented. Phase-1 targets aim for provider-default HA rather than custom multi-region failover:

Railway/Fly.io provide automatic restart on process crash (similar to the local restart: unless-stopped policy on the PostgreSQL container)
Managed Postgres on either platform provides daily snapshots within the provider's standard tier
Cloudflare R2 provides object durability by design

Multi-region active-active deployment is explicitly outside scope (Spain-only product, single-tenant operator).

8.3.4 Cost Optimization Strategy (phase 1 Posture)

Cost optimization is deferred to actual deployment. The forward-looking strategy is:

Start on free tiers: Cloudflare R2 (10 GB), Resend (free email tier), Railway hobby plan or Fly.io free allowance
Defer Redis until measured cache hit improves response times: ADR-3 explicitly chose PostgreSQL-only to avoid premature optimization
Single-region single-zone: Avoid multi-region replication costs until user base warrants
Manual scaling: Avoid autoscaling configuration until measured load justifies the operational complexity (per Section 6.1.1.1)
8.3.5 Security And Compliance Considerations (roadmap)

When cloud deployment is performed, the security posture documented in Section 6.4 must be preserved:

AUTH_SECRET must be provisioned via the cloud provider's environment-variable / secret-store mechanism, not committed to repository
NEXTAUTH_URL must be set to the production domain to enable correct OAuth-style redirect URI handling for magic links
The Playwright sidecar's 127.0.0.1 bind must be preserved on the host (cloud or otherwise) — exposing it externally would create an unauthenticated browser-control endpoint
CORS * must remain limited to /api/listings/import and /api/auth/mobile/* (per Section 5.4.7)
8.4 Containerization
8.4.1 Container Platform Selection

Docker with Docker Compose is the chosen container platform — but its use is currently limited to the local PostgreSQL container only. Per Section 3.6.4:

Container	State
PostgreSQL container	✅ postgres:17-alpine via docker-compose.yml (local dev only)
Application container	❌ No Dockerfile present. Production Dockerfile is a Fase 1 critical gap per Section 1.2.1.2
Sidecar container	❌ No Dockerfile present for the Playwright sidecar
8.4.2 Postgresql Container Configuration

The complete docker-compose.yml file is 17 lines and provisions a single service:

Configuration Element	Value
Image	postgres:17-alpine
Container name	buysell-postgres
Restart policy	unless-stopped
Database name	buysell
Database user	buysell
Database password	buysell (development credentials)
Host port mapping	5432:5432
Persistent volume	buysell-pgdata mounted at /var/lib/postgresql/data

The restart: unless-stopped directive ensures the database container recovers from host reboots and Docker daemon restarts without manual intervention — the only HA-like behavior currently in production. The named volume buysell-pgdata is the only persistent storage primitive in the system aside from the host filesystem under public/uploads/.

8.4.3 Application Container Status

No Dockerfile exists in the repository for the Next.js application or the Playwright sidecar. This has been confirmed by repository scan (find . -name "Dockerfile*" returns empty) and is explicitly flagged in docs/ROADMAP.md line 46:

"Despliegue en la nube: Añadir Dockerfile de producción + config Railway/Fly.io. Sin esto no hay producto. Prioridad: 🔴 Crítica"

Translation: "Cloud deployment: Add production Dockerfile + Railway/Fly.io config. Without this there is no product. Priority: 🔴 Critical."

When authored, the Dockerfile will need to address:

Multi-stage build: Separating the next build stage from the runtime image to keep production image size minimal
sharp native binary: Currently declared as serverExternalPackages: ["sharp"] in next.config.ts, must be installed in the runtime stage
Playwright Chromium provisioning: ~300 MB binary; should likely be in a separate sidecar container or installed via npx playwright install chromium in the build phase
AUTH_SECRET and other env vars: Must be injected at runtime, not baked into the image
Non-root user: Security hardening for the runtime stage
outputFileTracingRoot: Already pinned to repo root in next.config.ts (with explanatory comment about a stray package-lock.json at C:\Users\suanz that confused Next.js)
8.4.4 Base Image Strategy

The only base image currently in use is postgres:17-alpine. The choice of Alpine Linux is intentional:

Property	Alpine Benefit
Image size	~80 MB vs. ~400 MB for postgres:17 (debian-based)
Attack surface	Minimal package set; fewer CVEs
Cold start	Faster container instantiation

For future containers (Dockerfile authorship pending), the expected base image strategy is:

Layer	Likely Base Image	Justification
Next.js runtime	node:20-alpine	Aligns with Node 20+ requirement; Alpine for size
Playwright sidecar	mcr.microsoft.com/playwright:v1.60.0-jammy	Official image with Chromium dependencies pre-installed
Database	postgres:17-alpine (already in use)	No change
8.4.5 Image Versioning Approach

Not yet defined. When Dockerfile authoring proceeds, the expected versioning approach (consistent with the dependency-pinning posture in package.json) would be:

Semantic version tags matching package.json version (0.1.0 currently)
Git SHA tags for traceability to source commit
latest tag avoided in production — per ADR best practices
8.4.6 Build Optimization And Security Scanning

Not implemented. The current state per find scans:

Optimization / Scan	Status
.dockerignore file	❌ Absent
Multi-stage builds	❌ N/A (no Dockerfile)
Layer caching strategy	❌ N/A (no Dockerfile)
Trivy image scanning	❌ Not configured
Snyk container scanning	❌ Not configured
Grype scanning	❌ Not configured
Image signing (Cosign / Notary)	❌ Not configured
SBOM generation	❌ Not configured

When containerization proceeds, security scanning should be integrated into the CI/CD pipeline (also pending — see Section 8.6).

8.5 Orchestration
8.5.1 Orchestration Applicability Statement

Detailed orchestration architecture is explicitly Not Applicable for this system. Per Section 6.1.1.1's "Microservices Concepts Not Applicable to the Current System" table:

Orchestration Concern	Status	Justification
Service registry / DNS-based discovery	Not applicable	Single sidecar; address fixed by SCRAPER_URL env var
Load balancer	Not applicable	One Next.js process; one sidecar process
Service mesh / sidecar proxy	Not applicable	Loopback bind; no need for mTLS or traffic policy
Autoscaling (HPA / cloud)	Not applicable	No platform-managed scaler; single-host Docker only
Multi-replica deployments	Not applicable	Single-deploy-unit by design (ADR-1)
Pod disruption budgets	Not applicable	No Kubernetes
Network policies	Not applicable	Single-host networking
8.5.2 Orchestration Platforms Not In Use

The repository contains no orchestration platform configurations:

❌ Kubernetes: No k8s/, no manifests, no kustomization.yaml
❌ Docker Swarm: No stack.yml, no docker stack mode
❌ HashiCorp Nomad: No .nomad files
❌ AWS ECS / Fargate: No taskdef.json, no service definitions
❌ Google Cloud Run: No service.yaml
❌ Azure Container Apps: No containerapps.bicep
8.5.3 Justification For Non-orchestration Posture

The architectural justification is rooted in three observations from Section 6.1.1.1:

Single-process constraints by design: The Playwright sidecar binds explicitly to 127.0.0.1 (per scripts/scraper-service.mjs), which prevents the kind of cross-host invocation that would justify orchestration.
No autoscaling driver: Single-tenant operation means there is no horizontal scale dimension to manage.
ADR-5 fire-and-forget pattern: Background tasks dispatch via local function calls rather than a message queue, eliminating the need for queue-worker pod separation.

When the system migrates to cloud (Phase 1), the target platforms (Railway, Fly.io) provide PaaS-managed orchestration that abstracts away the Kubernetes layer. Custom Kubernetes manifests are not anticipated at any phase of the documented roadmap.

8.6 Ci/cd Pipeline
8.6.1 Ci/cd Status

Per Section 3.6.5, no CI/CD pipeline exists in the repository:

Concern	Current State
GitHub Actions workflows	❌ Absent — no .github/workflows/ directory
Deployment automation	❌ None
Static analysis in CI	❌ Not configured
Test runs in CI	❌ Not configured
Pre-commit hooks (Husky, lefthook)	❌ Not configured

This is confirmed by repository scan (find . -name ".github" -type d returns empty) and is listed as a 🔴 Critical priority Phase 1 gap.

8.6.2 Build Pipeline (local Only)
8.6.2.1 Existing Build Capabilities

While CI/CD is absent, comprehensive local build capabilities are present via npm scripts defined in package.json:

Script	Command	Purpose
dev	next dev -p 4200	Web dev server
build	next build	Production web build (webpack-based)
start	next start -p 4200	Production web server
lint	next lint	ESLint over web codebase
db:up / db:down	docker compose up/down -d	Database lifecycle
db:migrate	prisma migrate dev	Apply migrations interactively
db:generate	prisma generate	Regenerate Prisma Client
db:seed	tsx prisma/seed.ts	Insert sample data
scraper	node scripts/scraper-service.mjs	Start Playwright sidecar
mobile	npm --workspace @buysell/mobile run start	Start Expo dev server
8.6.2.2 Build Configuration

The web build is configured in next.config.ts with three notable customizations:

Configuration	Value	Purpose
outputFileTracingRoot	path.resolve(__dirname)	Pins workspace root explicitly; prevents stray package-lock.json confusion
transpilePackages	["@buysell/shared"]	Allows workspace TS package to be consumed without prebuild
serverExternalPackages	["sharp"]	Keeps native binary out of bundle
images.remotePatterns	Allowlist for 4 Spanish portals	Restricts Next.js Image optimization to vetted sources

The mobile build uses Metro (apps/mobile/metro.config.js) configured for the npm-workspaces monorepo (workspace root watched, multiple node_modules paths, disableHierarchicalLookup: true).

8.6.2.3 Dependency Management
Tool	Role
npm workspaces	Workspace declaration in root package.json: "workspaces": ["packages/*", "apps/*"]
package-lock.json	Lockfile for reproducible installs
Prisma CLI (^6.1.0)	Migrations, codegen, Studio GUI, seeding
tsx (^4.19.2)	Direct TypeScript execution for scripts and seed
Expo CLI	Mobile dev server and platform launchers
8.6.2.4 Artifact Generation And Storage

Currently no artifact storage is configured (no GitHub Packages, no npm registry publish, no Docker registry). Locally generated artifacts:

Artifact	Location	Lifetime
Web production build	.next/ directory	Per build; gitignored
Mobile Metro bundle	In-memory during dev; bundled on Expo native build	Transient in dev
Prisma Client	node_modules/.prisma/client/	Regenerated on prisma generate
8.6.3 Deployment Pipeline (roadmap Only)

Per docs/ROADMAP.md Phase 1, the target CI/CD shape is:

GitHub Actions: lint → test → build → deploy on PR merge

Phase 1 ordered implementation steps (from docs/ROADMAP.md):

Step	Task	Priority	Estimated Effort
1	Configure domain + NEXTAUTH_URL for production	🔴 Critical	30 min
2	Author Dockerfile + Railway/Fly.io config	🔴 Critical	2–4h
3	Email notification on price drop	🟠 High	TBD
4	Mortgage calculator	🟠 High	TBD
5	Side-by-side comparator	🟠 High	TBD
6	Decoupled cron scraper (pg-boss or Railway Cron)	🟠 High	3–4h
7	Chrome MV3 extension	🟠 High	TBD

Deployment strategy for Phase 1 (target): Rolling deployment is the default for both Railway and Fly.io. Blue/green and canary strategies are explicitly out of scope at this scale — the platform target is "first cloud deploy," not advanced release engineering.

Rollback procedures for Phase 1 (target): Provider-native rollback (Railway "redeploy previous", Fly.io flyctl releases rollback) supplemented by idempotent operations (ADR-4) at the application level.

Post-deployment validation for Phase 1 (target): Manual smoke test via /dashboard page load + the existing /healthz endpoint on the sidecar. No automated smoke-test suite exists today.

Release management process: Currently informal. Roadmap items are tracked as checkboxes in docs/ROADMAP.md; improvement closure is informal — items are checked off as code lands in main (per Section 6.5.4.5).

8.7 Infrastructure Monitoring

This subsection cross-references Section 6.5 (Monitoring and Observability) for the detailed monitoring architecture. Per Section 6.5.1.1, detailed monitoring architecture is not applicable for this system in the conventional enterprise sense.

8.7.1 Resource Monitoring Approach

The system implements minimal resource monitoring by design:

Resource Signal	Mechanism	Surface
Sidecar health	GET /healthz on 127.0.0.1:4201	Returns {ok: true, ts: <epoch_ms>}
Sidecar request timing	[scraper] {status} {url} ({ms}ms) log lines	Process stdout
Recheck batch progress	onProgress(idx, total, summary) callback	Terminal output
Operator dashboard	/dashboard Server Component (10 parallel queries)	RSC HTML page
Recent activity	/activity page (top 100 PriceSnapshot rows)	RSC HTML page
Liveness (Next.js process)	No equivalent endpoint exists	Implicit; hosting platform TCP check assumed

Notably absent: CPU metrics, memory metrics, disk metrics, network metrics, connection pool metrics, garbage collection metrics. No agent-based collection (no Datadog Agent, New Relic Agent, Telegraf, node_exporter).

8.7.2 Performance Metrics Collection

Per Section 6.5.3.2, performance is observed in two narrow ways:

Sidecar per-request timing: Every scrape handler in scripts/scraper-service.mjs records start time, measures elapsed milliseconds at completion, and logs the [scraper] {status} {url} ({ms}ms) line. This is the only continuous per-request performance signal in the system.
Recheck batch progress: checkAllActiveListings() in src/features/scraping/runner.ts accepts an onProgress callback used by the CLI runner to print one line per listing.

There is no request-duration histogram, no p50/p95/p99 latency tracking, and no slow-query logging. Page-render performance on the Next.js side is observable only via browser DevTools at development time.

8.7.3 Cost Monitoring And Optimization

Not implemented — there is no cloud cost integration because there is no cloud deployment. When Phase 1 deploys to Railway or Fly.io, cost monitoring will rely on:

Provider-native cost dashboards (Railway usage metrics, Fly.io organization billing)
Free-tier consumption alerts where available
Manual review (no automated cost-anomaly detection planned at this scale)
8.7.4 Security Monitoring

Per Section 6.5.1.3, the platform ships no SIEM, no Sentry, no OpenTelemetry, no Datadog, no New Relic, no Prometheus. The complete security monitoring posture consists of:

Signal	Mechanism
Authentication audit	ApiToken.lastUsed updated best-effort on token resolution
Anti-bot block rate	Manual query against ImportLog (roadmap line 376 commits to monitoring this)
Sanity violations	ImportLog RECHECK rows with ok: false
Failed auto-merges	ImportLog MERGE_AUTO rows with ok: false, blocked: true
CORS-allowlist enforcement	Implicit in route handler code (no log emission)
Magic-link / OTP issuance	[auth] and [auth-mobile] console prefixes

The console.log / console.error pattern with bracketed module tags ([scraper], [auth], [import-listing]) constitutes the entire logging stack — no structured logger library (no Pino, Winston, Bunyan).

8.7.5 Compliance Auditing

Not implemented. Per Section 6.4.4.5:

No audit log retention policy
No compliance reporting (SOC 2, ISO 27001 not pursued)
No GDPR Article 30 records of processing activities
No data lineage tracking

The append-only ImportLog table is the closest analog to a compliance audit log, but its purpose is operational forensics, not regulatory reporting. The three composite indexes on ImportLog — (propertyId, createdAt), (kind, createdAt), and (createdAt) — support both per-property forensic queries and time-window aggregations should compliance reporting become a future requirement.

8.8 Infrastructure Architecture Diagrams
8.8.1 Current Infrastructure Architecture

The following diagram consolidates all infrastructure components in their current local-first state. This is the authoritative deployment topology as of the inspected codebase.

External Clients

External Services (HTTPS)

Operator Workstation (Single Host)

Host Filesystem

Docker Engine

Node.js 20+ Runtime

Prisma over TCP
localhost:5432

POST /fetch
127.0.0.1:4201

process.env

process.env

HTTPS

HTTPS

Resend SDK

Direct HTTPS

Playwright Chromium

HTTP :4200

HTTP :4200
(LAN IP)

HTTP :4200
CORS *

Next.js Web Application
npm run dev / start
Port 4200 (all interfaces)

Playwright Sidecar
npm run scraper
Port 4201 (127.0.0.1 only)

postgres:17-alpine
buysell-postgres
restart: unless-stopped

Named Volume
buysell-pgdata

.env / .env.local
(gitignored)

public/uploads/
(image media)

Catastro OVC
XML, public

Nominatim
OSM Geocoder

Resend
Email SDK

8 Spanish
Real-Estate Portals

Web Browser
Cookie session

Expo Mobile App
Bearer HS256 JWT

Tampermonkey
Bearer bs_token

8.8.2 Network Architecture And Port Allocation

The port topology distinguishes between externally reachable services, host-mapped services, and loopback-only services:

Loopback Interface (127.0.0.1)

Host Network Interfaces

LAN / Public Network

HTTP/HTTPS

HTTP (LAN IP)

Internal (Prisma)

Internal (browser-fetch)

Web Clients

Mobile Clients
(LAN dev)

Port 4200
0.0.0.0 (all interfaces)
Next.js Web App

Port 5432
0.0.0.0 (mapped)
PostgreSQL container

Port 4201
127.0.0.1 only
Playwright Sidecar

Security implication of the binding strategy: The Playwright sidecar's 127.0.0.1-only bind is a deliberate security control. Per Section 5.4.7, the sidecar has no authentication — host-level isolation is the only protection. Exposing port 4201 externally would create an unauthenticated browser-control endpoint capable of arbitrary HTTP requests.

8.8.3 Current Deployment Workflow

The current deployment workflow is fully manual and executed by the operator on their workstation:

Operator initiates deployment

git clone repository

npm install
(npm workspaces resolve apps/mobile, packages/shared)

Create .env from .env.example
Populate AUTH_SECRET, RESEND_API_KEY, etc.

npm run db:up
(docker compose up -d postgres)

npm run db:migrate
(prisma migrate dev)

npm run db:generate
(prisma generate)

Seed sample data?

npm run db:seed

npm run build
(next build, webpack)

npm start
(next start -p 4200)

npm run scraper
(node scripts/scraper-service.mjs)

curl 127.0.0.1:4201/healthz
Verify {ok:true}

Open http://localhost:4200
Manual login + dashboard check

System operational

Yes

No

8.8.4 Environment Promotion Flow (phase 1 Roadmap Target)

The following diagram illustrates the target Phase 1 environment promotion flow once cloud deployment is implemented. This is not currently implemented and is included for forward planning.

Cloud Production (Pending)

GitHub Actions (Pending)

Source Control

Local Development

git push

PR merge

trigger

deploy

Developer Workstation

Local PostgreSQL
(docker compose)

GitHub Repository
main branch

Pull Requests

next lint

Test suite
(currently absent)

next build

docker build
(Dockerfile pending)

Railway OR Fly.io
Web + Sidecar processes

Managed PostgreSQL
Provider-bundled

Cloudflare R2
Image storage

The dashed borders on the CI and Cloud Production subgraphs denote their pending/aspirational status. The current state encompasses only the Local Development subgraph and direct push to GitHub.

8.9 Infrastructure Cost Estimates And Resource Sizing
8.9.1 Current State Costs

The current infrastructure footprint generates zero cloud cost because nothing is deployed to a cloud provider. Costs are limited to:

Cost Center	Current Cost	Notes
Cloud hosting	€0.00	Local-only deployment
Managed Postgres	€0.00	Local Docker container
Image storage (R2/S3)	€0.00	Local public/uploads/
Resend email (free tier)	€0.00	Within free tier; falls back to console in dev
Anthropic API	€0.00	Scaffolded but not active
Domain / DNS	€0.00	None registered
Total monthly run-cost	€0.00	

Operator time (manual deployment, manual recheck, manual recovery) is the de-facto resource cost today.

8.9.2 Phase 1 Projected Cost Envelope

The following projections are derived from docs/ROADMAP.md Phase 1 targets and reflect free-tier-first selection. Actual costs depend on provider tier selection.

Cost Center	Provider	Tier	Projected Monthly
Application hosting	Railway hobby	$5 starter / usage-based	€5–10
Application hosting (alt)	Fly.io free allowance	3 shared-CPU 256MB VMs	€0–10
Managed PostgreSQL	Railway PG bundled / Fly Postgres	TBD	€5–15
Image storage	Cloudflare R2	10 GB free tier	€0–2
Resend email	Free tier (3000 emails/mo)	Free	€0
Domain	Registrar (varies)	—	€1–2
Total monthly run-cost (Phase 1)			€11–39

This envelope assumes single-tenant personal use (Fase 1 target). Scaling to Fase 2's 100-user target may increase costs by approximately 2–5×, depending on email volume, R2 bandwidth, and Postgres connection count.

8.9.3 Resource Sizing Guidelines
8.9.3.1 Local Workstation (current)
Resource	Minimum	Recommended	Maximum Observed
CPU cores	2	4	4+ during scrape batches
RAM	4 GB	8 GB	~1 GB total (Node + Chromium + PG)
Disk free	5 GB	20 GB	Grows with public/uploads/ + PG data
Network	Broadband	Broadband	Bound by external portal latency
8.9.3.2 Phase 1 Cloud Production (projected)
Resource	Target	Justification
Web container CPU	1 shared vCPU	Bursty load; idle 95% of the time
Web container RAM	512 MB	Next.js base + Prisma client pool
Sidecar container CPU	1 shared vCPU	Bursty during scrape batches
Sidecar container RAM	1 GB	Chromium 300–500 MB + Node overhead
Postgres CPU	1 shared vCPU	Single-tenant query volume
Postgres RAM	256–512 MB	Modest working set (≤1000 properties)
Postgres disk	1–5 GB	11 models, JSON cadastralData, modest growth
R2 storage	0–5 GB	Within 10 GB free tier for foreseeable future
8.9.3.3 Scaling Triggers And Thresholds

The following thresholds, derived from Section 5.4.5, indicate when infrastructure should scale up:

Threshold	Current Value	Scaling Action
Recheck endpoint duration	300 seconds maxDuration	Migrate to decoupled cron (pg-boss / Railway Cron) when batch routinely approaches limit
public/uploads/ size	Bounded by disk	Migrate to R2 at ~1 GB
Active properties count	No hard limit	Add tsvector full-text index at ~1000 properties
MatchSuggestion queue depth	No hard limit	Add UI batch-dismiss when > 50 pending
Photos missing phash	Per STALE_DAYS=7 dashboard signal	Run npm run hash-photos
8.10 External Dependencies

The system has six external service surfaces. Each is documented here with its authentication mechanism, throttling posture, and failure-handling strategy. This consolidates the integration boundary specified in Sections 3.4.1 and 5.1.4.

8.10.1 External Service Inventory
Service	Endpoint / SDK	Auth Method
Catastro OVC (Coordinates)	https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC	None (public XML)
Catastro OVC (Callejero)	https://ovc.catastro.meh.es/ovcservweb/OVCCallejero	None (public XML)
Nominatim (OSM)	https://nominatim.openstreetmap.org/search	User-Agent + 1100ms throttle
Resend	Resend SDK (resend npm package)	API key (RESEND_API_KEY)
Anthropic	(Scaffolded only; not active)	API key (ANTHROPIC_API_KEY)
Spanish Real-Estate Portals (8)	Direct HTTPS / Playwright fallback	None (anonymous scraping)
8.10.2 Dependency Failure Posture
Service	SLA Assumption	Failure Mode
Catastro OVC	Best-effort (public, no SLA)	enrichInBackground catches; logs CATASTRO ok:false; preserves NULL fields for retry on next import
Nominatim	Public rate-limit (1 req/sec)	1100ms throttle enforced module-side; multiple query variants tried
Resend	Per-tier SLA	Falls back to console.log when RESEND_API_KEY unset (dev)
Real-estate portals	None (adversarial)	Tier escalation HTTP → sidecar; manualOnly: true for 3 portals; BUYSELL_DISABLE_BROWSER_FETCH circuit breaker
Anthropic	N/A (not active)	generateSketchFromPhotos throws "pendiente de implementar"
8.10.3 Critical External Dependency: Anti-bot Posture

The Playwright sidecar configures anti-detection masking to bypass DataDome and similar bot-protection services on portals like Fotocasa. From scripts/scraper-service.mjs:

Configuration	Value
Launch arguments	--disable-blink-features=AutomationControlled, --no-sandbox, --disable-setuid-sandbox
Viewport	1366×768
Locale	es-ES
Timezone	Europe/Madrid
User-Agent	Chrome 131 desktop
Init script overrides	navigator.webdriver, navigator.plugins, navigator.languages

These configurations are infrastructure-relevant because changing the host operating system (e.g., from local development on Windows to Linux containers in cloud production) may alter the default Chromium fingerprint and require re-tuning of the anti-detection scripts.

8.11 Roadmap-documented Future Infrastructure
8.11.1 Phase 1 Infrastructure Items (0–8 Weeks)

Per docs/ROADMAP.md Sections 1 and 4, the following infrastructure items are tracked for Phase 1:

Task	Priority	Estimated Effort	Dependencies
Configure domain + NEXTAUTH_URL	🔴 Critical	30 min	Domain registration
Author production Dockerfile	🔴 Critical	2–4h	None
Configure Railway/Fly.io deployment	🔴 Critical	Included above	Dockerfile
GitHub Actions CI/CD (lint+build+deploy)	🔴 Critical	Low complexity	Dockerfile + provider
Migrate public/uploads/ to Cloudflare R2	🟡 Medium	Medium	R2 account
Decoupled cron scraper	🟠 High	3–4h	pg-boss OR Railway Cron OR Trigger.dev
Lightweight task queue	🟠 High	Medium	pg-boss (PostgreSQL-backed)
tsvector full-text search index	🟡 Medium	Low–Medium	Prisma migration
Upstash Redis for response caching	🟡 Medium	Medium	Upstash account
8.11.2 Phase 2 Monitoring-adjacent Items (2–6 Months)
Item	Infrastructure Implication
Real-time SSE/WebSocket layer	Requires hosting platform that supports long-lived connections
Web Push / Expo Push notifications	Requires push service credentials (Firebase / Apple Push)
PWA support via next-pwa	Build-time integration; no new infrastructure
AI scoring (Anthropic activation)	API spending controls; cost monitoring
8.11.3 Architecture Decision Records Affecting Infrastructure

The ADRs from Section 5.3.6 constrain the infrastructure trajectory:

ADR	Decision	Infrastructure Implication
ADR-1	Modular monolith over microservices	Single deploy unit; no orchestration
ADR-2	Sidecar pattern for Playwright	Per-host sidecar; couples to localhost
ADR-3	PostgreSQL only (no Redis)	No caching tier initially; single primary
ADR-4	Idempotent operations over transactions	Simplifies DR; re-runs safe
ADR-5	Fire-and-forget background tasks (no queue)	No message broker required initially
ADR-8	Local image storage public/uploads/	Not horizontally scalable; R2/S3 deferred

When Phase 1 deployment proceeds, ADR-2 (sidecar pattern) and ADR-8 (local image storage) will require revisiting:

ADR-2 implication: The cloud deployment must either colocate Web + Sidecar in the same VM/container group (Railway services in the same project, Fly.io processes in the same app) or relax the 127.0.0.1 bind in favor of authenticated inter-service communication.
ADR-8 implication: Migration of public/uploads/ to Cloudflare R2 requires updating image upload paths, the next/image loader configuration, and the existing image references in the database.
8.11.4 Maintenance Procedures (current And Future)

Current maintenance procedures are encoded as npm scripts surfaced via the dashboard's "Necesita atención" panel (per Section 6.5.4.3):

Script	Trigger Condition	Recovery Action
npm run scraper	Initial startup; sidecar restart needed	Starts Playwright sidecar
npm run check-listings	Stale auto listings > 7 days	Bulk recheck via CLI
npm run hash-photos	Photos missing phash (dashboard signal)	Backfill 9×8 dHashes
npm run fix-prices	Sanity-rejected prices accumulate	Cleans up corrupt price data
npm run claim-orphans	ownerId IS NULL rows post-migration	Reassigns ownership
npm run db:studio	Direct ImportLog inspection	Launches Prisma Studio
npm run db:migrate	After schema change	Applies new Prisma migrations

Future maintenance procedures (Phase 1 prerequisites) must include:

Scheduled pg_dump exports to off-host storage
Object-storage replica of public/uploads/ (post R2 migration)
Sidecar restart runbook (current implicit behavior: SIGINT/SIGTERM handlers + 5-minute idle close)
Provider-native log retention configuration (Railway / Fly.io log streaming setup)
Domain certificate renewal monitoring (provider-managed in current Phase 1 targets)
References
Files Examined
docker-compose.yml — Sole infrastructure-as-code artifact: PostgreSQL 17 alpine service, buysell-postgres container, buysell-pgdata volume, port mapping, credentials, restart policy
package.json — npm workspace definition, all root npm scripts (dev/build/start/db:*/scraper/lint), root dependency inventory
apps/mobile/package.json — Expo SDK 54 mobile workspace, platform-specific Expo scripts
apps/mobile/app.json — Expo manifest, plugin configuration, experiments (typedRoutes, reactCompiler), newArchEnabled
next.config.ts — outputFileTracingRoot, transpilePackages: ["@buysell/shared"], serverExternalPackages: ["sharp"], image remotePatterns
tsconfig.json — TypeScript ES2022 strict mode, path aliases, exclusion of apps/mobile
.env.example — Complete environment-variable contract documenting the integration boundary
.gitignore — Confirms .env and public/uploads/* exclusion, Expo native folder exclusion
README.md — Setup instructions, Node 20+ requirement, dev workflow
CLAUDE.md — Product objective brief (pre-implementation; no infrastructure content)
docs/ROADMAP.md — Complete phased roadmap, priority indicators (🔴/🟠/🟡), Phase 1 ordered implementation steps, risk matrix
scripts/scraper-service.mjs — Playwright sidecar entry point: 127.0.0.1 bind, port 4201, 5-minute idle close, anti-detection scripts, SIGINT/SIGTERM cleanup
scripts/check-listings.ts — Manual recheck CLI runner with onProgress consumer
scripts/hash-existing-photos.ts — Backfill script for Media.phash NULL rows
scripts/fix-corrupt-prices.ts — Manual recovery for sanity-rejected prices
scripts/claim-orphan-properties.ts — Manual recovery for ownerId IS NULL rows
prisma/migrations/ — 6 timestamped migration folders + migration_lock.toml (postgresql provider lock)
Folders Explored
/ (repository root) — Confirmed presence of only docker-compose.yml, no Dockerfile, no .github/, no IaC files
scripts/ — Six operational/maintenance scripts; only scraper-service.mjs is infrastructure-relevant (long-running process)
prisma/ and prisma/migrations/ — Schema, seed, and migration history for database lifecycle
apps/mobile/ — Expo Router application; no infrastructure files beyond Metro config
public/ — Only bookmarklet/ subfolder (userscripts); no infrastructure assets
Repository Search Confirmations
find . -name "Dockerfile*" → empty (no Dockerfile exists)
find . -name ".github" -type d → empty (no GitHub Actions workflows)
find . -name "*.tf" -o -name "vercel.json" -o -name "fly.toml" -o -name "railway.toml" -o -name "render.yaml" -o -name "kubernetes*" → empty (no IaC/PaaS configs)
find . -name ".dockerignore" → empty
Cross-referenced Technical Specification Sections
Section 1.2 SYSTEM OVERVIEW — Critical infrastructure gap matrix, success-criteria phases
Section 1.3 SCOPE — Spain-only constraint, deferred phases
Section 2.6 ASSUMPTIONS AND CONSTRAINTS — Single-user assumption, sidecar localhost constraint
Section 3.4 THIRD-PARTY SERVICES — External integration inventory, "no cloud deployment yet" statement
Section 3.5 DATABASES & STORAGE — PostgreSQL 17 container, buysell-pgdata volume, storage strategy
Section 3.6 DEVELOPMENT & DEPLOYMENT — Sidecar architecture, no CI/CD, containerization status
Section 3.7 DEVIATIONS FROM THE DEFAULT TECHNOLOGY STACK — Cloud, IaC, CI/CD all flagged as deferred
Section 5.1 HIGH-LEVEL ARCHITECTURE — Two-process topology, system boundaries, modular monolith architecture
Section 5.3 TECHNICAL DECISIONS — ADRs 1, 2, 3, 4, 5, 8 affecting infrastructure
Section 5.4 CROSS-CUTTING CONCERNS — Section 5.4.5 thresholds, Section 5.4.6 DR posture, Section 5.4.7 security
Section 6.1 Core Services Architecture — Section 6.1.1.1 "Microservices Concepts Not Applicable" table
Section 6.4 Security Architecture — Compliance posture (Section 6.4.4.5)
Section 6.5 Monitoring and Observability — Section 6.5.1.1 "Detailed Monitoring Architecture is not applicable"
9. Appendices

This section consolidates supplementary technical information that supports the preceding chapters of the BuySell Asturias Technical Specification. It captures operational details, file inventories, and reference data that did not fit naturally into the architectural narrative, followed by a comprehensive glossary and acronym index for the document.

9.1 Additional Technical Information

The following subsections enumerate concrete artifacts (scripts, files, migrations, environment variables) and design details (visual identity, sidecar configuration) that complete the system's documentary record.

9.1.1 Repository Identity And Versioning

BuySell Asturias is structured as a private npm-workspace monorepo. The repository root package.json declares the project identity that anchors all internal package references and tooling integrations.

Attribute	Value
Package name	buysell-asturias
Version	0.1.0
Privacy flag	private (not published to the npm registry)
License	LICENSE file present at repository root
Workspaces	["packages/*", "apps/*"]

The two internal workspaces are @buysell/shared@0.1.0 (the cross-platform domain library, located at packages/shared/) and @buysell/mobile (the Expo React Native client at apps/mobile/).

9.1.2 Operational Scripts Inventory

The scripts/ folder contains six standalone Node-executable utilities that supplement the main web application. These represent the operational toolbox used by the single operator for maintenance, backfill, and out-of-band processing.

Script File	Runtime	Purpose
scraper-service.mjs	Node ESM HTTP service	Playwright sidecar bound to 127.0.0.1:4201; idle-closes after 5 minutes
check-listings.ts	TypeScript CLI	Wraps checkAllActiveListings(); emits ✓ ok / ✗ gone / ⊘ blocked / ! error per listing
hash-existing-photos.ts	TypeScript CLI	Backfills Media.phash for NULL rows with ~500ms inter-photo throttle
fix-corrupt-prices.ts	TypeScript CLI	Cleans currentPrice / lastPrice / PriceSnapshot.price outside the sanity band
claim-orphan-properties.ts	TypeScript CLI	Reassigns Property.ownerId IS NULL rows to a target user by email
rewrite-imports.mjs	Node ESM migration	One-shot helper that rewrote @/lib/{sanity,similarity,format} to @buysell/shared

PostgreSQL

Operational CLIs (tsx)

Playwright Sidecar :4201

Next.js Web Application :4200

HTTP fallback

Returns HTML

Background Pipeline

Import Endpoints

scraper-service.mjs

check-listings.ts

hash-existing-photos.ts

fix-corrupt-prices.ts

claim-orphan-properties.ts

Property / Media / PriceSnapshot

9.1.3 Visual Identity And Brand Design Detail

The "steel and aged brass" identity referenced in Section 7 derives from the Asturian regional context. The palette and iconography are explicitly grounded in northern-Spain industrial heritage.

Token	Value	Description
Steel (primary)	#3A5F8A	Muted steel-blue used for primary actions and chrome
Aged brass (accent)	#C49A4D	Secondary highlight color
Warm off-white (surface)	#FAFAF7	Background surfaces and cards
CSS self-description	"latón envejecido sobre acero"	Spanish: "aged brass on steel"

The master brand mark is the IconKey component (a medieval key). Secondary brand icons include IconHorreo (Asturian granary on stilts, an iconic regional structure) and IconPicos (the Picos de Europa mountain range).

9.1.4 Bookmarklet And Userscript Files Inventory

The public/bookmarklet/ folder distributes nine artifacts: seven Tampermonkey userscripts (one per supported portal), one legacy bookmarklet retained for compatibility, and one shared documentation file.

File	Role
buysell-fotocasa.user.js	Fotocasa userscript
buysell-pisos.user.js	Pisos.com userscript
buysell-habitaclia.user.js	Habitaclia userscript
buysell-yaencontre.user.js	Yaencontre userscript
buysell-thinkspain.user.js	ThinkSpain userscript (with modal SPA-resilience)
buysell-indomio.user.js	Indomio userscript
buysell-idealista.user.js	Idealista userscript
idealista.js	Legacy bookmarklet variant (predecessor to userscript)
_buysell-common.js	Comment-only documentation of shared helper contract
9.1.5 Database Migration Inventory

The prisma/migrations/ directory contains six chronologically ordered migrations representing the complete schema evolution from initial bootstrap through authentication integration.

#	Migration Folder	Description
1	20260518190058_init	Initial schema: 7 enums, 6 tables, 9 indexes, 5 FKs
2	20260519094949_add_portals	Adds HABITACLIA, YAENCONTRE, THINKSPAIN, INDOMIO portals
3	[ID]	Media.phash, Property.matchDismissed, Property.titleSlug
4	20260519135431_import_log	ImportLog table and ImportLogKind enum
5	[ID]	MatchSuggestion table
6	20260520181751_auth_tables	NextAuth Prisma adapter tables (Account, Session, VerificationToken, ApiToken)
9.1.6 Project Risk Matrix

The docs/ROADMAP.md document enumerates the principal project risks. These cross-cut the architectural decisions documented in Sections 5.3 and 8 and inform the deferred-feature posture.

Risk Area	Concern
Scraping legality	RGPD and privacy compliance for personal-use scraping
Anti-bot defenses	Portal countermeasures (DataDome, JS challenges) degrading scraper reliability
Parser maintenance	HTML structure changes across portals breaking adapters
External API reliability	Catastro OVC and Nominatim availability and rate limits
Playwright operational cost	Memory consumption and host-process coupling of sidecar
Portal dependency	Revenue risk if portals introduce paid API tiers
Adoption risk	Single-operator product with limited market validation
9.1.7 Environment Variable Defaults

The .env.example file establishes the authoritative environment-variable contract. The values below are documentation defaults; production deployments must supply secure substitutions for secrets.

Variable	Default Value
DATABASE_URL	postgresql://buysell:buysell@localhost:5432/buysell?schema=public
NEXTAUTH_URL	http://localhost:4200
CATASTRO_BASE_URL	https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC
RESEND_FROM	BuySell <onboarding@resend.dev>
SCRAPER_PORT	4201
SCRAPER_URL	http://127.0.0.1:4201
EXPO_PUBLIC_API_URL	http://192.168.1.77:4200 (LAN IP for dev)
BUYSELL_DISABLE_BROWSER_FETCH	unset (set to "1" to disable sidecar escalation)

The AUTH_SECRET should be generated using a cryptographically strong source; the recommended one-liner uses Node's crypto.randomBytes(32).toString('hex').

9.1.8 Npm Script Inventory

The root package.json exposes the following operational entry points. These commands are the primary developer and operator interface to the system.

Script Name	Command
dev	next dev -p 4200
build	next build
start	next start -p 4200
lint	next lint
db:up / db:down	docker compose up -d / down
db:migrate	prisma migrate dev
db:generate	prisma generate
db:studio	prisma studio
db:seed	tsx prisma/seed.ts
check-listings	tsx scripts/check-listings.ts
hash-photos	tsx scripts/hash-existing-photos.ts
fix-prices	tsx scripts/fix-corrupt-prices.ts
claim-orphans	tsx scripts/claim-orphan-properties.ts
scraper	node scripts/scraper-service.mjs
mobile	npm --workspace @buysell/mobile run start
9.1.9 Path Aliases And Module Resolution

Both the web and mobile applications resolve internal modules via TypeScript path aliases, eliminating brittle relative-path imports.

Alias	Resolves To	Surface
@/*	./src/*	Web application
@/*	./apps/mobile/*	Mobile application
@buysell/shared	./packages/shared/src/index.ts	Both surfaces

The @buysell/shared package additionally exposes subpath exports for tree-shaking and explicit imports: ., ./sanity, ./similarity, ./format, ./types, and ./schemas.

9.1.10 Tampermonkey Userscript Technical Details

Each userscript distributed in public/bookmarklet/ shares the following technical characteristics, which enable robust extraction across Single-Page-Application (SPA) portals:

Run-at directive: document-idle (fires after initial DOM and resources settle)
Cross-origin POST: GM_xmlhttpRequest (Tampermonkey API that bypasses browser CORS)
SPA navigation resilience: MutationObserver plus history.pushState monkey-patching to detect client-side route changes
Image extraction cap: 80 deduplicated URLs per import
Data source priority: __NEXT_DATA__ hydration JSON → JSON-LD Schema.org → Open Graph meta tags → breadcrumb DOM → regex fallback over the HTML body
9.1.11 Shared Package Module Capabilities

The @buysell/shared workspace package provides the domain primitives shared between the Next.js web application and the Expo mobile client. Each subpath export covers a distinct concern:

Subpath	Capability
./sanity	Plausibility validators (price-range gates, isReasonablePriceChange)
./similarity	slugify, bigrams, jaccard, haversineMeters
./format	Locale-aware formatters (toLocaleString("es-ES") for currency and dates)
./types	Portable property and listing TypeScript contracts
./schemas	Zod schemas applied at HTTP boundaries for runtime validation
.	Barrel export aggregating all of the above
9.1.12 Browser And Anti-bot Sidecar Configuration

The Playwright sidecar (scripts/scraper-service.mjs) is launched with a stack of anti-fingerprinting measures designed to defeat lightweight bot-detection logic. (Note: these measures are insufficient against commercial anti-bot services like DataDome, which is why Idealista remains manual-only.)

Configuration	Value
Launch arguments	--disable-blink-features=AutomationControlled, --no-sandbox, --disable-setuid-sandbox
User-Agent	Chrome 131 desktop string
Viewport	1366 × 768
Locale	es-ES
Timezone	Europe/Madrid
navigator.webdriver override	undefined
navigator.plugins override	[1, 2, 3, 4, 5]
navigator.languages override	["es-ES", "es", "en"]
9.2 Glossary Of Terms

The glossary defines domain-specific, architectural, and technology-specific terms used throughout this Technical Specification. Terms are grouped by category for navigability.

9.2.1 Architecture And Pattern Terms
Term	Definition
Modular Monolith	A single deployable application internally organized into vertically-sliced feature modules. BuySell Asturias adopts this pattern (per ADR-1) under src/features/.
Sidecar Pattern	A co-located helper process running alongside the main application, communicating over a local boundary. Here, the Playwright sidecar on 127.0.0.1:4201.
Fire-and-Forget	Asynchronous dispatch using void <asyncFn>(args) that explicitly discards the returned promise so the HTTP response is not gated on pipeline completion.
Idempotency over Atomicity	Architectural choice (ADR-4) to avoid prisma.$transaction and instead make each pipeline step safely re-runnable, gated on NULL columns.
Edge Runtime	Next.js's limited-API runtime used for middleware. Cannot use Prisma, Buffer, or HS256 JWT verification (jose depends on Buffer).
Node Runtime	Full Node.js API surface used for API route handlers, server components, and server actions. Supports Prisma, jose, and sharp.
Server Component (RSC)	A React component executed on the server. Can directly query the database via Prisma and return rendered HTML.
App Router	The Next.js routing model based on the src/app/ directory and React Server Components.
Soft Reference	A database column that references another entity by ID but without a database-enforced foreign key. Used by MatchSuggestion.sourceId, ImportLog.propertyId, and SavedSearch.ownerId.
Discriminated Union	TypeScript pattern for tagged variants. Used here for ScrapeOutcome = ok | gone | blocked | error.
Adapter Pattern	Implementation strategy used for portal scrapers — the PortalAdapter interface (portal, matches, manualOnly?, scrape) with 10 concrete implementations.
Three-tier Price Extractor	Waterfall used by _genericAdapter.ts: (1) JSON-LD offers.price, (2) portal-specific CSS selectors, (3) regex against the body.
9.2.2 Authentication And Security Terms
Term	Definition
Magic Link	Passwordless authentication via an emailed one-time URL (24-hour validity, 32-byte hex token).
OTP (One-Time Password)	A 6-digit numeric code emailed for mobile authentication (10-minute validity).
HS256	HMAC-SHA-256 — the symmetric JWT signing algorithm used for both NextAuth cookies and mobile JWTs.
Bearer Token	The Authorization: Bearer <token> HTTP header convention. Used for both bs_-prefixed API tokens and mobile JWTs.
Trust Root	A single secret (AUTH_SECRET) that signs both NextAuth JWTs and mobile HS256 JWTs.
Ownership-Based Authorization	Access control where access is granted only if userId === resource.ownerId. No role-based access control exists.
Policy Enforcement Point (PEP)	A code site where authorization is checked. The system has three PEPs: Edge middleware, route-handler requireUserId, and query-layer ensureOwner.
Existence-Leak Side Channel	A response that reveals whether a resource exists (e.g., returning 403 vs 404). BuySell returns 404 in both "not found" and "not owned" cases.
CSRF	Cross-Site Request Forgery — mitigated by the Bearer-token requirement on import and same-origin CORS on all other endpoints.
9.2.3 Domain Terms (real Estate / Spain)
Term	Definition
Catastro / OVC	Spain's public cadastral registry, exposed via the Oficina Virtual del Catastro XML services (OVCSWLocalizacionRC, OVCCallejero).
Cadastral Reference (RC)	A 14-character unique identifier for a parcel in the Spanish cadastre. Stored in Property.cadastralRef.
Floorplan	Architectural plan. May come from CADASTRE (official) or AI_SKETCH (generated approximation, deferred feature F-027).
Asturias	Autonomous community in northern Spain — the project's initial geographic focus.
Idealista	The largest Spanish real-estate portal. Protected by DataDome and therefore manual-only in this system.
DataDome	Commercial anti-bot service used by Idealista. Defeats both direct HTTP and headless-browser fetching.
9.2.4 Algorithms And Computational Terms
Term	Definition
dHash (Difference Hash)	A 64-bit perceptual hash computed via sharp 9×8 grayscale; encoded as a 16-character hexadecimal string.
Hamming Distance	Number of differing bits between two binary strings. ≤ 8 (out of 64) indicates a same-image match in this system.
Jaccard Similarity	Set-similarity coefficient |A∩B| / |A∪B|. Applied here to bigram sets of property titles.
Bigram	Two consecutive characters. Used to convert titles into character n-gram sets for Jaccard scoring.
Haversine Distance	Great-circle distance formula computing meters between two lat/lng pairs on the WGS84 ellipsoid.
WGS84 / EPSG:4326	World Geodetic System 1984 — the standard latitude/longitude coordinate system.
Sanity Band	Price-range gate (0.5× to 2× of last known price) used by isReasonablePriceChange to reject implausible scraped prices.
5-Signal Matching	Composite scoring combining cadastre RC, photo phash overlap, title Jaccard, geographic distance (haversine), and built-area difference.
9.2.5 Operational Terms
Term	Definition
Bookmarklet	A bookmark whose URL is a javascript: URI; runs in the current page when clicked. The original Idealista-import vehicle.
Userscript	JavaScript file executed by browser extensions like Tampermonkey, Greasemonkey, or Violentmonkey. Runs at document-idle on matched URLs.
Tampermonkey	Popular browser extension hosting userscripts. Greasemonkey and Violentmonkey are equivalent alternatives.
MutationObserver	DOM API used by userscripts to detect SPA navigation and re-inject UI elements.
`__NEXT_DATA__`	Hydration JSON blob embedded by Next.js pages on portals (e.g., Fotocasa, Yaencontre). A primary userscript data source.
Recheck	Periodic re-fetch of a listing to detect price or status changes. Triggered manually via npm run check-listings or POST /api/listings/check.
Background Pipeline	The five-stage post-import enrichment: HASH → CATASTRO → GEOCODE → BORROW_FIELDS → MATCH/MERGE_AUTO.
Orphan Property	A Property row with ownerId IS NULL. Produced by deleting a User (ON DELETE SET NULL); reassignable via claim-orphans.ts.
Stale Listing	A listing whose lastCheckedAt is older than STALE_DAYS = 7. Surfaced in the dashboard's "Necesita atención" panel.
Sanity Guard	A business-logic defense (price band, type-match, 30% diff) that limits damage from compromised tokens or noisy scraper data.
9.2.6 Build And Tooling Terms
Term	Definition
npm Workspaces	Built-in npm feature declaring multiple packages in one repository. Here the workspaces are packages/* and apps/*.
Turbopack	Next.js's Rust-based dev-mode bundler.
Metro	React Native's bundler used by Expo. Configured in apps/mobile/metro.config.js with disableHierarchicalLookup: true for monorepo support.
tsx	TypeScript script runner used for prisma/seed.ts and operational scripts.
`transpilePackages`	Next.js config option forcing a workspace package through Next's compiler. Used for @buysell/shared.
`serverExternalPackages`	Next.js config option keeping a package outside the bundler. Used for sharp due to its native binaries.
Prisma Studio	GUI for inspecting and editing the database. Launched via npm run db:studio.
JSON-LD	JSON for Linking Data — Schema.org structured data embedded in HTML; serves as Tier 1 of the price extractor.
Cheerio	jQuery-like server-side HTML parser used for portal HTML extraction.
`fast-xml-parser`	XML parser used for Catastro responses. Configured with attributeNamePrefix: "@_".
`jose`	JavaScript JWT library used for HS256 signing and verification of mobile tokens.
`sharp`	Native-binary image processor used for dHash computation and image manipulation.
React Compiler	New React 19 compiler that auto-optimizes components. Enabled in Expo via reactCompiler: true.
New Architecture (Fabric / TurboModules)	React Native's modern renderer and native-module system. Enabled via newArchEnabled: true.
9.2.7 Service And Provider Terms
Term	Definition
Resend	Transactional email API used for magic-link and OTP delivery.
Nominatim	OpenStreetMap-based geocoding service used for address-to-coordinates lookup.
Cloudflare R2	S3-compatible object storage. Deferred Phase 1 destination for image media.
Railway / Fly.io	Candidate hosting providers mentioned in docs/ROADMAP.md Phase 1.
Trigger.dev	Candidate task-queue and scheduling provider mentioned in the roadmap.
pg-boss	PostgreSQL-backed job queue mentioned as a candidate for decoupled cron.
BullMQ	Redis-backed job queue mentioned in docs/ROADMAP.md as a future migration option.
Upstash Redis	Serverless Redis provider, a candidate for response caching.
Anthropic API	LLM API scaffolded for floorplan AI (feature F-027) but not yet active.
Meilisearch	Search engine listed as a future option if the catalog exceeds 10,000 properties.
Tinsa	Spanish property valuation company mentioned as a future integration.
9.3 Acronyms

The following acronym index expands abbreviations used throughout the document. Entries are grouped by domain for easier reference.

9.3.1 Technical And Web Standards
Acronym	Expansion
API	Application Programming Interface
APM	Application Performance Monitoring
CDN	Content Delivery Network
CLI	Command-Line Interface
CORS	Cross-Origin Resource Sharing
CSS	Cascading Style Sheets
CSRF	Cross-Site Request Forgery
CSV	Comma-Separated Values
CUID	Collision-Resistant Unique Identifier
DDoS	Distributed Denial of Service
DOM	Document Object Model
ESM	ECMAScript Modules
GIN	Generalized Inverted Index (PostgreSQL)
GUI	Graphical User Interface
HTML	HyperText Markup Language
HTTP	HyperText Transfer Protocol
HTTPS	HTTP Secure
IPC	Inter-Process Communication
JSON	JavaScript Object Notation
JSON-LD	JSON for Linking Data
JWT	JSON Web Token
MV3	Manifest V3 (Chrome extension format)
OAuth	Open Authorization
REST	Representational State Transfer
RSC	React Server Component
SDK	Software Development Kit
SPA	Single Page Application
SQL	Structured Query Language
SSE	Server-Sent Events
SVG	Scalable Vector Graphics
TLS	Transport Layer Security
TS	TypeScript
UA	User-Agent
UI	User Interface
URL	Uniform Resource Locator
UX	User Experience
VM	Virtual Machine
XML	Extensible Markup Language
9.3.2 Security And Cryptography
Acronym	Expansion
HMAC	Hash-based Message Authentication Code
HS256	HMAC SHA-256 (JWT signing algorithm)
JWKS	JSON Web Key Set
JWT	JSON Web Token
`kid`	Key ID (JWT header claim)
mTLS	Mutual TLS
OTP	One-Time Password
PEP	Policy Enforcement Point
PII	Personally Identifiable Information
RBAC	Role-Based Access Control
TOTP	Time-based One-Time Password
9.3.3 Architecture And Operations
Acronym	Expansion
ADR	Architecture Decision Record
AVM	Automated Valuation Model
B2B	Business-to-Business
CI/CD	Continuous Integration / Continuous Deployment
CRUD	Create, Read, Update, Delete
DR	Disaster Recovery
FK	Foreign Key
IaC	Infrastructure as Code
IdP	Identity Provider
KMS	Key Management Service
KPI	Key Performance Indicator
MVP	Minimum Viable Product
ORM	Object-Relational Mapping
PWA	Progressive Web App
ROI	Return on Investment
SaaS	Software as a Service
SIEM	Security Information and Event Management
SLA	Service Level Agreement
SLO	Service Level Objective
TBD	To Be Determined
TOS	Terms of Service
9.3.4 Compliance And Regulatory
Acronym	Expansion
DPA	Data Protection Agreement
DPIA	Data Protection Impact Assessment
DPO	Data Protection Officer
GDPR	General Data Protection Regulation (EU)
HIPAA	Health Insurance Portability and Accountability Act
ISO 27001	International Organization for Standardization 27001 (information security)
PCI-DSS	Payment Card Industry Data Security Standard
RGPD	Reglamento General de Protección de Datos (Spanish for GDPR)
SOC 2	Service Organization Control 2
9.3.5 Spain-specific Acronyms
Acronym	Expansion
AJD	Actos Jurídicos Documentados (Documented Legal Acts tax)
CCAA	Comunidades Autónomas (Autonomous Communities)
INE	Instituto Nacional de Estadística (National Statistics Institute)
ITP	Impuesto sobre Transmisiones Patrimoniales (Property Transfer Tax)
OVC	Oficina Virtual del Catastro (Virtual Cadastre Office)
RC	Referencia Catastral (Cadastral Reference)
9.3.6 Geographic And Coordinate Systems
Acronym	Expansion
EPSG	European Petroleum Survey Group (coordinate-system codes)
EPSG:4326	EPSG code for WGS84 latitude/longitude
EUR	Euros (€)
LAN	Local Area Network
OSM	OpenStreetMap
POI	Point of Interest
WGS84	World Geodetic System 1984
9.3.7 Cloud And Infrastructure Vendors
Acronym	Expansion
AWS	Amazon Web Services
ECS	Elastic Container Service (AWS)
EKS	Elastic Kubernetes Service (AWS)
GCP	Google Cloud Platform
K8s	Kubernetes
R2	Cloudflare R2 (object storage)
S3	Simple Storage Service (AWS)
9.3.8 Buysell-specific Acronyms
Acronym	Expansion
`bs_`	Prefix for BuySell API tokens (format: bs_<64-hex>)
dHash	Difference Hash (perceptual hashing algorithm used by BuySell)
phash	Perceptual hash (generic term; BuySell uses dHash internally)
9.4 References

The following files, folders, and Technical Specification sections were examined during the preparation of this Appendices section. They serve as the evidentiary basis for the inventories, definitions, and acronyms catalogued above.

9.4.1 Files Examined
README.md — Project overview, stack summary, repository structure, and Spanish-language documentation
CLAUDE.md — Original product brief documenting objectives and functional requirements in Spanish
.env.example — Environment-variable contract with defaults and generation hints
package.json (root) — Workspace declarations, version, npm scripts
docs/ROADMAP.md — Phased roadmap, risk matrix, Spanish tax acronyms, future infrastructure candidates
prisma/schema.prisma — Enums, model definitions, indexes, and FK cascade rules
prisma/migrations/ — Six-migration history (init through auth tables)
9.4.2 Folders Examined
/ (repository root) — Top-level configuration files; confirmed no Dockerfile, no .github/, no IaC files
docs/ — Single child ROADMAP.md
packages/shared/ — Manifest, tsconfig, and src/ substructure for the shared domain library
scripts/ — Six operational utility scripts
public/bookmarklet/ — Nine userscript and bookmarklet files including documentation
9.4.3 Technical Specification Sections Cross-referenced
1.1 EXECUTIVE SUMMARY — Project identifier, deliverables, stakeholders, value propositions
1.2 SYSTEM OVERVIEW — Stack versions, capability domains, system boundaries, KPIs
1.3 SCOPE — In-scope must-haves, primary workflows, deferred items
2.1 FEATURE CATALOG — Feature inventory (F-001 through F-028)
2.4 IMPLEMENTATION CONSIDERATIONS — Constraints, security implications, maintenance
2.6 ASSUMPTIONS AND CONSTRAINTS — Hard constraints and version tracking
3.1 PROGRAMMING LANGUAGES — TypeScript-first stance, tsconfig variants, edge restrictions
3.2 FRAMEWORKS & LIBRARIES — Complete dependency matrix
3.3 OPEN-SOURCE DEPENDENCIES — Package inventory across workspaces
3.4 THIRD-PARTY SERVICES — External services, endpoints, authentication
3.5 DATABASES & STORAGE — Schema models, enums, migration history
3.6 DEVELOPMENT & DEPLOYMENT — Tools, scripts, build pipeline, sidecar architecture
3.7 DEVIATIONS FROM THE DEFAULT TECHNOLOGY STACK — Default vs actual stack
3.8 SECURITY POSTURE OF THE STACK — Token entropy, CORS, sidecar isolation
4.6 TIMING AND SLA CONSIDERATIONS — Timeouts, throttles, numeric thresholds
5.1 HIGH-LEVEL ARCHITECTURE — Modular monolith principles, system boundaries
5.3 TECHNICAL DECISIONS — Architecture Decision Records
5.4 CROSS-CUTTING CONCERNS — Monitoring, error handling, security posture
6.2 Database Design — Schema, ERD, indexes, cascade rules
6.3 Integration Architecture — API design, message processing
6.4 Security Architecture — Three-token system, ownership-based authorization
6.5 Monitoring and Observability — Limited observability primitives, npm-script runbooks
7.1 UI ARCHITECTURE OVERVIEW — Three surfaces, "steel and aged brass" identity
7.6 UI DATA SCHEMAS — Property card, detail, match, search schemas
8.1 INFRASTRUCTURE APPLICABILITY ASSESSMENT — Current vs absent components
8.10 EXTERNAL DEPENDENCIES — Six external service surfaces with failure posture
8.11 ROADMAP-DOCUMENTED FUTURE INFRASTRUCTURE — Phase 1/2 items and ADR implications