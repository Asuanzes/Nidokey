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
