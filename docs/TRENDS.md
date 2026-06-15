# Vertical «Tendencias RSS» — diseño normativo

> **Flag de sesión: «vertical-trends»** — invócalo para retomar.
> Estado: **DISEÑO CERRADO** (2026-06-15), implementación pendiente (delegada a Codex).
> Origen: planificado con Claude Code (arquitecto) + agent-reach (Exa) para validar
> el panorama 2026 de APIs de tendencias. Implementa Codex (backend + frontend).

Categoría **global y de solo-lectura** que agrega *trending topics* de varias redes
sociales y, por cada tendencia, resuelve **noticias relacionadas** reutilizando el
modelo `NewsItem` ya existente. Se coloca de forma **marginal** en el menú (rail), con
icono RSS, sin romper auth, temas (VINTAGE/2100) ni el resto de verticales.

## Principios heredados del codebase (NO romper)
- **Auth:** endpoints de usuario con `requireUserId()`; cron con `isCronAuthorized()` +
  `CRON_SECRET`. No tocar middleware ni la lógica de sesión.
- **Modelo por-vertical** con discriminador `recordType` + tablas `*Snapshot`
  (`prisma/schema.prisma`). DB Neon → **`npx prisma db push`** (NUNCA `migrate`).
- **Proveedores:** patrón `SourceAdapter` + `registry` + `refresh` + `upsert` +
  `availability.ts` (`getJsonStrict`, `ProviderUnavailableError`: distingue
  «no existe» 404 de «no disponible» 429/5xx).
- **Noticias:** `NewsItem` servido por `GET /api/news?type=` con caché in-memory (5 min).
  Móvil: `NewsSheet` + `useNews` + pantalla `app/article.tsx`. **Reutilizar tal cual.**
- **Temas:** tokens VINTAGE (`T`/`TD`) **y 2100 (`T2100`/`TD2100`) ya están en `main`**;
  el color de categoría sale de `categoryColor(type, dark, style)`. ⚠️ El componente
  `NeonIcon` (render 2100 del icono) vive solo en la rama `redesign/ui-2026`.
- **i18n:** ES (fuente) + EN tipados (`apps/mobile/types/i18next.d.ts`, `I18nKey`).
- **Cron:** GitHub Actions + `Authorization: Bearer $CRON_SECRET`.
- **Logging:** `console.log` con tag `[trends-...]` + `logImportEvent` donde aplique.

---

## 1. Modelo de datos (`prisma/schema.prisma`)

Las tendencias son **globales** (no llevan `ownerId`): todos los usuarios ven el mismo
feed cacheado, refrescado por cron. Las noticias NO se persisten (se resuelven en vivo
y se cachean en memoria, como `/api/news`).

```prisma
enum TrendSource {
  twitter
  reddit
  linkedin       // experimental (third-party)
  xiaohongshu    // experimental
  xueqiu         // experimental
  instagram      // experimental
  tiktok         // experimental
  youtube        // experimental
}

model Trend {
  id        String      @id @default(cuid())
  source    TrendSource
  name      String                    // término/hashtag/tema tal cual lo da la fuente
  query     String                    // keyword normalizada para buscar noticias
  locale    String      @default("ES") // "ES" | "WORLD" | "US" | ...
  rank      Int         @default(0)    // posición en el ranking de la fuente
  volume    Int?                       // tweet_volume / proxy de intensidad (nullable)
  url       String?                    // enlace a la búsqueda en la fuente (opcional)
  meta      Json?                      // payload crudo del proveedor
  lastSeenAt DateTime   @default(now())// marca de último refresh que lo vio (para purgar)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@unique([source, locale, name])     // upsert por refresh; reemplaza ranking/volumen
  @@index([source, locale, rank])
  @@index([lastSeenAt])                // purga de stale > TTL
}

// OPCIONAL (fase 2, NO bloqueante): histórico de intensidad por tendencia.
model TrendSnapshot {
  id         String   @id @default(cuid())
  trendId    String
  trend      Trend    @relation(fields: [trendId], references: [id], onDelete: Cascade)
  rank       Int
  volume     Int?
  observedAt DateTime @default(now())
  @@index([trendId, observedAt])
}
```

Helper de normalización (`src/features/trends/normalize.ts`):
`trendToQuery(name)` → quita `#`, separa hashtags camelCase (`#FelizLunes`→`Feliz Lunes`),
colapsa espacios, recorta. Se usa para poblar `Trend.query` y para `GET /trends/:id/news`.

---

## 2. Fuentes y adaptadores (`src/features/trends/`)

Interfaz común (paralela a `SourceAdapter`, pero **lista** en vez de registro único):

```ts
export type NormalizedTrend = {
  name: string; query: string; rank: number;
  volume?: number | null; url?: string | null;
  meta?: Record<string, unknown>;
};
export type TrendListOutcome =
  | { kind: "ok"; trends: NormalizedTrend[] }
  | { kind: "blocked"; reason: string }   // sin credenciales / rate-limit upstream
  | { kind: "error"; error: string };

export interface TrendProvider {
  readonly source: TrendSource;
  readonly experimental?: boolean;        // off por defecto si falta env
  available(): boolean;                    // ¿token/env configurado?
  fetchTrends(opts: { locale: string; limit?: number }): Promise<TrendListOutcome>;
}
```

Registro en `src/features/trends/registry.ts` (`TREND_PROVIDERS: TrendProvider[]`).
Toda llamada HTTP usa `getJsonStrict` de `availability.ts`.

| Fuente | Tier | Proveedor 2026 | Cómo | Env |
|---|---|---|---|---|
| **twitter** | A (v1) | **TwitterAPI.io** (oficial X = Pro $5k/mes, inviable) | `GET trends by WOEID` (Worldwide=1, ES, US=23424977) → name, query, tweet_volume | `TWITTERAPI_IO_KEY` |
| **reddit** | A (v1) | API oficial Reddit (OAuth app-only) o FetchLayer | `r/popular` + `rising` → título=name | `REDDIT_CLIENT_ID/SECRET` |
| **linkedin** | B (exp) | OutX / social-listening third-party (async) | watchlist/keywords → temas | `OUTX_API_KEY` |
| **xiaohongshu** | B (exp) | API no oficial / proveedor de datos | scraping controlado | `XHS_PROVIDER_KEY` |
| **xueqiu** | B (exp) | API no oficial / proveedor de datos | hot topics bolsa | `XUEQIU_PROVIDER_KEY` |
| instagram / tiktok / youtube | B (exp) | third-party | scaffold, off por defecto | `*_PROVIDER_KEY` |

- **Tier A**: implementado y activo en v1. **Tier B**: adaptador escrito pero
  `available()` devuelve `false` si falta su env → el provider se **omite** (no rompe).
- **Resolución tendencia→noticias** (`src/features/trends/news.ts`): proveedor **gratis
  por defecto = Google News RSS** `https://news.google.com/rss/search?q=<query>&hl=es-ES&gl=ES&ceid=ES:es`
  (sin key; parsea igual que `yahoo-news.ts`). Alternables: GNews/NewsAPI (de pago) por env.
- **Rate-limit / caching:** los proveedores de tendencias se llaman **solo desde el cron**
  (no por request). `Trend` ES la caché (TTL refresco 30–60 min). Las noticias se cachean
  in-memory por `query` (TTL 30–60 min), patrón idéntico a `/api/news`.

---

## 3. Endpoints REST (`src/app/api/trends/...`)

Todos con `requireUserId()` (la app va autenticada; las tendencias son globales pero el
acceso sigue el patrón del resto). Errores con las formas estándar del repo
(`400 {error,issues?}`, `401 {error:"No autenticado"}`, `404 {error}`, `502 {error,kind:"error"}`).

| Método/Ruta | Query | Devuelve |
|---|---|---|
| `GET /api/trends` | `source?` (TrendSource\|`all`, def `all`), `locale?` (def `ES`), `limit?` (def 30, máx 100), `cursor?` | `{ items: TrendDTO[], nextCursor: string \| null }` |
| `GET /api/trends/:id` | — | `TrendDTO` (404 si no existe) |
| `GET /api/trends/:id/news` | `limit?` (def 20), `cursor?` | `{ items: NewsItem[], nextCursor: string \| null }` (resuelve vía Google News RSS, cacheado) |
| `GET /api/cron/trends` | `source?` (def todas) | refresca proveedores×locales, upsert `Trend`, purga stale. `isCronAuthorized()`. |

```ts
type TrendDTO = {
  id: string; name: string; source: TrendSource; query: string;
  locale: string; rank: number; volume: number | null;
  url: string | null; updatedAt: string;
};
// NewsItem = el ya existente { title, url, summary, source, publishedAt, symbol }
// (en trends, `symbol` transporta el término de la tendencia, para el resaltado).
```

**Manejo de errores esperables:**
- Sin tendencias para el filtro → `200 { items: [], nextCursor: null }` (no romper UI).
- Proveedor upstream caído/rate-limit en cron → se loguea `logImportEvent` y se **conserva
  el último set** en `Trend` (no se purga si el refresh falló). El request de lectura
  siempre sirve de DB.
- News upstream falla → `200 { items: [] }` (degradado silencioso).

Cron: `.github/workflows/trends.yml` (cada 30 min, `workflow_dispatch`, `concurrency`)
→ `curl Bearer $CRON_SECRET https://nidokey.es/api/cron/trends`.

---

## 4. App móvil (Expo / expo-router)

**Alta de categoría (marginal, icono RSS):**
- `packages/shared/src/records.ts`: añadir `"trends"` a `RecordType` y a `RECORD_TYPES`.
- `apps/mobile/lib/records/config.ts`: entrada `trends` en `RECORD_TYPE_CONFIG`
  (`color` ~`#E0732B`, `colorDark` ~`#EE9A5A`, `icon: "rss-outline"`, `enabled: true`,
  `addMode: "none"` — feed read-only, sin alta de registro) **y** en `RECORD_TYPE_2100`
  (peach, p.ej. `#F08A4B`/`#FFB07A`). El color final lo afina diseño; debe salir vía
  `categoryColor("trends", dark, style)` para soportar VINTAGE y 2100 automáticamente.
- Icono: añadir `rss` en `apps/mobile/lib/records/category-icons.ts` (script
  `scripts/_icon-build.mjs`). ⚠️ En `redesign/ui-2026` añadir también el caso a `NeonIcon`/
  `CategoryIcon` (Ionicons `rss-outline`).
- **Colocación marginal:** en el rail de `apps/mobile/app/(tabs)/index.tsx` (~líneas 247–271),
  renderizar `trends` **fuera** del bloque `orderedVisible`, fijo al **final** del rail,
  precedido de un **divisor** (`View` 1px + margen). No entra en reordenar/ocultar.

**Pantallas (no usan la lista CRUD estándar; trends es feed):**
| Pantalla | Archivo (nuevo) | Descripción |
|---|---|---|
| Lista de tendencias | `apps/mobile/app/trends/index.tsx` | Chips de fuente (Todas/Twitter/Reddit/LinkedIn/Xiaohongshu/Xueqiu) + lista. Ítem: nombre, chip de fuente, volumen/intensidad, tiempo relativo. Pull-to-refresh. |
| Detalle de tendencia | `apps/mobile/app/trends/[id].tsx` | Cabecera (nombre, fuente, volumen) + **lista de noticias reutilizando el render de `NewsSheet`**. Tap noticia → `app/article.tsx` existente. |

**Reutilización obligatoria:**
- Hook `useNews` (`apps/mobile/lib/hooks/useNews.ts`): extender para aceptar
  `{ kind: "trend"; trendId }` que pegue a `GET /api/trends/:id/news`, o crear
  `useTrendNews(trendId)` que devuelva `{ items: NewsItem[], loading, error, reload }`.
- Render de tarjeta de noticia: extraer de `NewsSheet.tsx` un `NewsList`/`NewsRow`
  reutilizable (o reusar `NewsSheet` con un nuevo `type`).
- `EmptyState`, `ActivityIndicator`, `RefreshControl` (patrón `ReorderableRecordList`),
  `apps/mobile/lib/api.ts` (`api<T>()` con Bearer), i18n (`t("trends.*")`, `t("types.trends.*")`).

**i18n** (`apps/mobile/locales/es|en/translation.json`): `types.trends.{label:"Tendencias RSS",singular}`
y `trends.{title, filter_all, source_*, empty, load_error, volume_label, related_news}`.

---

## 5. Caching, rate-limit y TTL (resumen)
- `Trend` = caché persistente; refresco cron **30–60 min** (recomendado 30).
- Noticias por `query`: caché in-memory **30–60 min** (igual que `/api/news`).
- Proveedores externos: **solo** en cron; throttle a nivel módulo; `getJsonStrict` con 1 reintento.
- Si un proveedor falla, **no** se purga el set previo (lectura siempre desde DB).

## 6. Restricciones de entrega
- NO tocar auth/seguridad ni el sistema de temas (solo extenderlo con la categoría/icono).
- NO desplegar a producción. Trabajar en rama `feat/trends-rss`, dejar listo para revisión.
- Esquema: `npx prisma db push` (Neon, sin `migrate`).
- No añadir librerías nuevas salvo necesidad clara (parser RSS: reusar el de `yahoo-news.ts`).

## 7. Reconciliación de fuentes
El objetivo lista Twitter/Reddit/LinkedIn/Xiaohongshu/Xueqiu; la subtarea backend añade
Instagram/TikTok/YouTube y omite LinkedIn. El enum `TrendSource` es la **unión** de todas;
**v1 entrega Tier A** (twitter+reddit) + noticias (Google News RSS); el resto queda como
**adaptadores experimentales feature-flagged** (off si falta su env).
