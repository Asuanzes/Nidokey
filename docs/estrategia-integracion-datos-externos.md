# Estrategia de integración de datos externos — Nidokey

> **Entregable de esta iteración:** este documento. **Cero cambios de código.**
> La implementación se hará en iteraciones posteriores, por fases.

## Contexto

Nidokey ya tiene un **framework de ingesta unificado** (`SourceAdapter` →
`NormalizedRecord` → `upsertRecord` → tabla por tipo → `BaseRecord` para la UI)
y una **capa de actualización** (`refreshType` + `/api/cron/refresh` disparado por
cron-job.org y GitHub Actions). Hoy solo están **vivos** `property` (scraping +
WebView/bookmarklet) y `crypto` (CoinGecko). El resto de `RecordType`
(`renting, holiday, market, job, workout, chat`) existen como enum pero **sin
tabla ni fuente**.

Este documento define **de dónde y cómo** obtener los datos de cada dominio
usando, donde aporte, infraestructura de scraping-as-a-service (Apify,
ScrapingBee/Bright Data, Octoparse) **siempre por delante de APIs oficiales
cuando existan**, y cómo encajarlo en la arquitectura existente sin reescribirla.
Incluye además el patrón de **menú lateral contextual por categoría**
(`CategoryContextPanel`) y confirma que **borrado y reordenado persisten en todas
las categorías** con el mecanismo actual.

**Restricciones que NO se tocan** (zona crítica): `/api/auth/*`, generación/
verificación de tokens, la cascada `getUserId()` (cookie web + JWT móvil + token
`bs_`), y el sidecar Playwright nunca dentro de Next.js.

---

## 1. Necesidades de datos por dominio

Modelo común (toda fila lo lleva, contrato ya usado por `Property`/`CryptoHolding`):
`ownerId, recordType, title, subtitle?, status?, currentValue Int (céntimos),
currency, imageUrl?, source, externalId?, lastCheckedAt?, meta Json, createdAt,
updatedAt` + tabla hija `*Snapshot` para histórico de valor.

### 1.1 Inmuebles (compra / alquiler) — `property` / `renting`
- **Datos mínimos:** título, precio (venta o renta/mes), operación (venta|alquiler),
  tipo (piso/casa/…), ubicación (ciudad, barrio, dirección, lat/lng), m²
  construidos/útiles, habitaciones, baños, planta, año, eficiencia energética,
  fotos[], URL del anuncio, portal, `externalId`, ref. catastral.
- **API oficial vs scraping:**
  - **Idealista** tiene API oficial pero con aprobación de partner y cuota muy
    baja → no viable para uso general. **Idealista/Milanuncios/Yaencontre** usan
    DataDome → **manual-only** (WebView móvil + userscript), que ya existe y es la
    vía legalmente más segura.
  - Portales automatizables (Fotocasa, Pisos.com, Habitaclia, ThinkSpain,
    Indomio) → ya cubiertos por `PortalAdapter` propios; opcionalmente un **actor
    de Apify** o **ScrapingBee** como fuente alternativa/refresh.
  - Enriquecimiento ya integrado: **Catastro OVC** (ref. catastral, año, m²) y
    **Nominatim** (geocoding). **INE** (estadística de zona) pendiente.
- **Recomendación:** mantener manual-only para anti-bot fuerte; APIs/actores solo
  para portales sin protección agresiva.

### 1.2 Viajes — `holiday` (hoteles, vuelos, paquetes)
- **Datos mínimos:** título (hotel/ruta), precio, fechas (ida/vuelta o noches),
  origen/destino, proveedor, rating, fotos/imagen, URL de reserva, `externalId`.
- **Fuentes preferentes (API oficial):**
  - **Amadeus Self-Service API** (vuelos + hoteles, **free tier** generoso) →
    primera opción para vuelos y disponibilidad hotelera.
  - **Travelpayouts/Aviasales, Kiwi (Tequila API)** → vuelos por afiliación.
  - **Booking**: Demand API solo partners; vía afiliado o **actor de Apify** para
    hoteles concretos por URL.
- **Scraping:** Booking/Airbnb/Trivago tienen ToS estrictos y anti-bot →
  **manual-only/WebView** o actor de Apify iniciado por el usuario; nunca cron
  masivo server-side.

### 1.3 Trabajos — `job` (InfoJobs, LinkedIn, agregadores)
- **Datos mínimos:** título, empresa, ubicación, salario (rango), tipo de
  contrato/jornada, modalidad (remoto/híbrido), fecha de publicación, URL,
  `externalId`, estado de candidatura (campo de usuario).
- **Fuentes preferentes (API oficial):**
  - **Adzuna API** (agregador de empleo, **free tier**, cobertura España) →
    **primera opción** (limpia, legal, sin scraping).
  - **InfoJobs** tiene programa de desarrolladores/API → segunda opción.
  - **Jooble API** como alternativa.
  - **LinkedIn**: sin API de búsqueda de ofertas para terceros + anti-bot fuerte +
    ToS → **evitar scraping automático**; si acaso, manual-only/actor Apify con
    moderación, asumiendo riesgo.

### 1.4 Workout / nutrición deportiva — `workout`
- **Datos mínimos:** producto, marca, categoría (proteína, creatina, …), precio,
  precio/100g o /dosis, stock, sabores, info nutricional (proteína, kcal,
  ingredientes), imagen, URL, `externalId`.
- **Fuentes:**
  - Tiendas tipo **HSN / Prozis / MyProtein**: sin API pública → **scraping
    propio** del PDP (suelen exponer `JSON-LD` `offers.price`, igual que los
    portales inmobiliarios) vía **ScrapingBee** (JS + proxy) o adapter HTTP propio.
  - **Open Food Facts API** (gratuita) para datos nutricionales/ingredientes.
  - **Amazon Product Advertising API** solo si hay cuenta de afiliado con ventas.
- **Recomendación:** seguimiento de **precio de un producto que el usuario
  recompra** (caso de uso "sigue el valor de X"); bajo riesgo anti-bot.

### 1.5 Tendencias geolocalizadas de X — `trend` (nuevo tipo)
- **Datos mínimos:** `name` (trending topic), región/WOEID, `volume`/tweets,
  categoría mapeada (cripto, e-sports, deportes, geopolítica, política nacional…),
  URL, `observedAt`, opcional: noticias relacionadas.
- **Fuentes:** **X API v2** (de pago, Basic) con endpoints de trends limitados, o
  **actor de Apify** de tendencias de X. Enriquecer con **NewsAPI/GDELT** para
  noticias del topic. Clasificación a categorías con keywords o LLM
  (`ANTHROPIC_API_KEY` ya scaffolded).
- **Uso:** tipo propio `trend` **y** enriquecimiento de otras categorías (p. ej.
  una tendencia cripto se muestra en la tarjeta de la cripto relacionada).

### Resumen API-first por dominio

| Dominio | 1ª opción (oficial/limpia) | Fallback | Anti-bot |
|---|---|---|---|
| Inmuebles venta | Adapters propios (Fotocasa…) / WebView (Idealista) | Apify actor | Alto (Idealista) |
| Inmuebles alquiler | Igual que venta | Apify/ScrapingBee | Alto |
| Viajes | **Amadeus** (vuelos/hoteles) | Apify (Booking), Travelpayouts | Alto (Booking) |
| Trabajos | **Adzuna API** / InfoJobs API | Apify (LinkedIn, con cautela) | Muy alto (LinkedIn) |
| Workout | Scraping propio (JSON-LD) + Open Food Facts | ScrapingBee | Bajo |
| Tendencias X | X API v2 | Apify (Twitter trends) | Medio/legal |

---

## 2. Comparativa de proveedores

> Precios **aproximados** (verificar en el momento de contratar; los planes
> cambian). Modelo y encaje práctico por dominio.

### 2.1 Apify
- **Modelo:** plataforma de "actores" (scrapers preconstruidos en su Store) +
  cómputo por uso. Free tier ~5 $/mes de crédito; planes desde ~49 $/mes. Algunos
  actores cobran por resultado. **API HTTP**, **datasets** (JSON/CSV), **webhooks**
  y **scheduling** integrados.
- **Ventajas:** actores listos para Booking, LinkedIn, Amazon, Idealista,
  Twitter/X, etc. → time-to-market bajo; gestiona proxies y navegador; webhooks =
  encaja con nuestra ingesta por push.
- **Desventajas:** coste por volumen; dependes del mantenimiento del actor
  (puede romperse); salida heterogénea (hay que normalizar).
- **Encaje Nidokey:** **mejor para fuentes con actor maduro** (hoteles, X trends,
  algún portal). Sus **webhooks** → endpoint `/api/ingest/webhook/apify`.

### 2.2 ScrapingBee
- **Modelo:** API de scraping (renderiza JS, rota proxies). Pago por crédito;
  ~49 $/mes (los renders con JS consumen más créditos). **No trae scrapers
  hechos** — tú pones la lógica de parseo.
- **Ventajas:** simple, barato para catálogos JS-heavy de dificultad media (HSN,
  algún portal); tú controlas el parseo (encaja directo con un `SourceAdapter`).
- **Desventajas:** mantienes el selector/parser; anti-bot muy fuerte (DataDome)
  no siempre cae.
- **Encaje Nidokey:** **mejor para scrapers propios** de tiendas/portales de
  protección media → `workout` (HSN/Prozis) y portales inmobiliarios sin DataDome.

### 2.3 Bright Data
- **Modelo:** suite enterprise (Web Unlocker, Scraping Browser, proxies
  residenciales, datasets). Pago por uso/GB; **el más caro y potente**.
- **Ventajas:** mejor tasa de éxito contra anti-bot duro y a escala; datasets de
  marketplace.
- **Desventajas:** coste y complejidad; sobredimensionado para escala personal.
- **Encaje Nidokey:** **solo si** ScrapingBee/Apify fallan contra un objetivo
  difícil y a volumen. Diferido.

### 2.4 Octoparse
- **Modelo:** no-code/low-code visual; planes cloud ~75–209 $/mes; free limitado;
  API para descargar resultados de tareas.
- **Ventajas:** iterar sin programar; útil para no-devs.
- **Desventajas:** fuerte acoplamiento a la herramienta; mantenimiento visual;
  débil contra JS-heavy/anti-bot a escala.
- **Encaje Nidokey:** **prototipado rápido** de fuentes secundarias; no para el
  núcleo de producción.

### 2.5 Recomendación priorizada

| Necesidad | Usar primero | Por qué |
|---|---|---|
| API oficial disponible | **La API oficial** (Amadeus, Adzuna, InfoJobs, Open Food Facts, Catastro, INE) | Legal, estable, barato/gratis |
| Scraper propio (protección media) | **ScrapingBee** | Barato, control total, encaja con `SourceAdapter` |
| Fuente con actor maduro / push | **Apify** | Time-to-market + webhooks + scheduling |
| Anti-bot duro a escala | **Bright Data** (diferido) | Potencia/proxies residenciales |
| Prototipo no-code | **Octoparse** (puntual) | Iteración rápida sin código |

**Regla de oro:** API oficial → ScrapingBee (propio) → Apify (actor/push) →
Bright Data (último recurso). Octoparse solo para explorar.

---

## 3. Arquitectura de integración

Reutiliza **lo existente** (no se reinventa):
`SourceAdapter`/`FetchOutcome` (`src/features/sources/types.ts`),
`pickAdapter`/registry (`src/features/sources/registry.ts`),
`upsertRecord` (`src/features/sources/upsert.ts`),
`refreshType` (`src/features/sources/refresh.ts`),
`logImportEvent`/`ImportLog`, `getUserId`/`isCronAuthorized`.

### 3.1 Capa de proveedores (nueva, fina)
`src/features/sources/providers/{apify,scrapingbee,brightdata,octoparse}.ts`:
clientes HTTP delgados (auth con su key de env, run/poll/fetch dataset). Los
**adapters** los consumen; la lógica de negocio sigue en el adapter.

```
SourceInput → Adapter (usa Provider client) → FetchOutcome(NormalizedRecord)
            → upsertRecord(ownerId, normalized) → tabla por tipo + *Snapshot
            → BaseRecord (mapper) → UI
```

### 3.2 DTO universal + tablas por categoría
- **DTO único:** `NormalizedRecord` (ya existe) — todos los dominios lo producen.
- **Tablas nuevas** siguiendo el patrón `CryptoHolding`/`*Snapshot` (aditivo, no
  rompe `Property`): `RentingListing`, `TravelOffer`, `JobListing`,
  `WorkoutProduct`, `MarketInstrument`, `TrendTopic` (+ su `*Snapshot`).
- `upsertRecord` gana un `case` por tipo; `src/lib/records/mapper.ts` gana un
  `*ToBaseRecord` por tipo (casi idéntico gracias al contrato común).

### 3.3 Tres modos de ingesta
1. **Síncrono (usuario):** `POST /api/records/import { type, input, source? }` →
   `pickAdapter` → `adapter.fetch` → `upsertRecord`. Auth `getUserId()`.
   Para fuentes `manualOnly` → `{ needsClient: true }` y el WebView móvil postea
   el `NormalizedRecord`.
2. **Batch programado (pull):** `refreshType(type)` vía
   `GET /api/cron/refresh?type=` (cron-job.org, `CRON_SECRET`, ≤60 s en Vercel) o
   `tsx scripts/refresh-type.ts <type>` (GitHub Actions, sin límite, para
   scraping/Playwright/Apify pesado).
3. **Webhook (push):** **nuevo** `POST /api/ingest/webhook/[provider]` (Apify
   "run finished", etc.). Auth por **`PROVIDER_SECRET`** dedicado (mismo patrón
   que `isCronAuthorized`, **sin tocar `/api/auth`**). Lee el dataset →
   `upsertRecord` en bulk. Se añade a `PUBLIC_PATHS` (validación en el handler).

### 3.4 Cadencia, cuotas y retrasos
- Throttle por proveedor (como `coingecko` 1500 ms); **batch** donde se pueda.
- Cadencia por dominio: cripto/markets 1–2 min · viajes/empleo horario/diario ·
  inmuebles diario · workout semanal · X trends 15–30 min.
- **No es tiempo real:** la UI muestra `lastCheckedAt` ("actualizado hace…").
- Cuotas: registrar consumo por proveedor; backoff ante `429`/`blocked`.

### 3.5 Monitorización y errores
- `FetchOutcome` ya distingue `ok|gone|blocked|error`; cada etapa escribe en
  **`ImportLog`** (auditoría existente).
- **Alertas:** opcional, email vía **Resend** ante N fallos seguidos de un
  `source` (reutiliza credencial existente). Endpoint `/api/cron/health` para un
  ping externo.
- Métrica clave: tasa de `blocked`/`error` por `source` → señal de scraper roto.

### 3.6 Dónde corre cada cosa (infra actual)
- **Vercel Hobby** (≤60 s): APIs batch ligeras (cripto, Adzuna, Amadeus).
- **GitHub Actions** (gratis, sin límite): scraping iterativo + **Playwright** +
  runs largos de Apify/ScrapingBee. **Playwright nunca en Vercel.**
- **Diferido:** worker dedicado (Railway/Fly) + cola `pg-boss` si el volumen lo
  exige (hoy fuera de "gratis").

### 3.7 Variables de entorno nuevas (en Vercel env / `.env.local`, nunca commit)
`APIFY_TOKEN`, `SCRAPINGBEE_API_KEY`, `BRIGHTDATA_*`, `OCTOPARSE_*`,
`AMADEUS_CLIENT_ID`/`_SECRET`, `ADZUNA_APP_ID`/`_KEY`, `INFOJOBS_*`,
`X_BEARER_TOKEN`, `NEWSAPI_KEY`, `PROVIDER_SECRET` (webhooks). Actualizar
`.env.example`.

---

## 4. Tendencias geolocalizadas de X — pipeline

- **Modelo `TrendTopic`** (tabla nueva): `ownerId?` (puede ser global), `region`/
  `woeid`, `name`, `volume`, `category` (mapeada), `url`, `observedAt`,
  `meta` (tweets, sample, sentimiento, noticias[]). + `TrendSnapshot` para
  evolución del volumen.
- **Pipeline (cron 15–30 min, GitHub Actions o cron-job.org):**
  1. **Obtener** tendencias por región (X API v2 por WOEID, o actor Apify).
  2. **Clasificar** a categorías de la app (cripto, e-sports/gaming, deportes,
     geopolítica, política nacional, …) por keywords + LLM (Anthropic).
  3. **Enriquecer** con noticias del topic (NewsAPI/GDELT).
  4. **Persistir** `TrendTopic` + `TrendSnapshot`.
  5. **Exponer** vía `GET /api/records?type=trend` (móvil y web) y como
     enriquecimiento cruzado (trend cripto → tarjeta de esa cripto).
- **Legal:** zona sensible (ToS de X) → preferir **API oficial de pago**;
  scraping solo vía actor de terceros y con moderación.

---

## 5. Seguridad y legalidad

- **Preferir APIs oficiales** siempre que existan (Amadeus, Adzuna, InfoJobs,
  Open Food Facts, Catastro, INE). Reduce riesgo legal y de bloqueo.
- **ToS / robots.txt:** respetar; no scrapear donde el ToS lo prohíba
  explícitamente (LinkedIn, Booking, Airbnb) salvo **importación iniciada por el
  usuario** (WebView/userscript): el usuario extrae *sus* datos → modelo mucho más
  seguro (el patrón actual de Idealista).
- **Anti-bot:** si hay DataDome/PerimeterX → `manualOnly` (WebView) o proxies de
  proveedor; **nunca cron masivo server-side** contra esos objetivos.
- **Riesgos y mitigación:**
  - *Bloqueo de IP* → proxies del proveedor (ScrapingBee/Apify/Bright Data),
    throttle, pacing; el sidecar Playwright queda en 127.0.0.1.
  - *Cambios de HTML* → adapters aislados + `FetchOutcome` (`blocked/gone/error`)
    + monitorización por `source` en `ImportLog` (detecta rotura).
- **Datos personales / GDPR:** datos mínimos, `ownerId` scoping (no cruzar entre
  usuarios), borrado en cascada ya soportado.
- **Secretos:** keys solo en env; webhooks con `PROVIDER_SECRET`; **no tocar**
  `/api/auth` ni la lógica de tokens.

---

## 6. Roadmap por fases

### Fase 1 — Piloto (validar el patrón end-to-end con fuentes "fáciles")
- Modelos internos (tablas + mappers + `upsertRecord`/`refreshType`) para
  **`job`** y **`workout`** (los de menor fricción legal/anti-bot).
- **`job` vía Adzuna API** (oficial, free, España) → primera fuente externa nueva
  (sin scraping; valida el flujo completo de cabo a rabo).
- **`workout` vía ScrapingBee** (HSN/Prozis, JSON-LD) + **Open Food Facts** →
  valida el patrón "scraper propio con proveedor de proxy".
- Habilitar ambos tipos en `RECORD_TYPE_CONFIG` (`enabled:true`, `addMode`) y en
  el repositorio móvil.
- (Inmuebles ya funcionan; opcional: añadir un **actor de Apify** como fuente
  alternativa de un portal automatizable, para validar Apify.)

### Fase 2 — Ampliar categorías + tendencias
- **`holiday` vía Amadeus** (vuelos/hoteles) y **`renting`** (reusa scraping de
  property).
- **`market`** (bolsa) como cripto (Finnhub/Twelve Data, casi calcado).
- **Pipeline de tendencias de X** (`TrendTopic`) + clasificación a categorías
  (gaming/e-sports, cripto, deportes, geopolítica, política nacional) + noticias.
- Webhooks de Apify (`/api/ingest/webhook/apify`) para fuentes con actor.

### Fase 3 — Optimización y operación
- **Scheduling robusto:** webhooks + cron por dominio; worker desacoplado
  (Railway/Fly) para Playwright/Apify pesado; cola `pg-boss` si hace falta.
- **Monitorización/alertas:** `/api/cron/health`, alertas por email (Resend) ante
  fallos repetidos, panel "Necesita atención" por `source`.
- **Caché** (Upstash Redis) y **AVM** (Tinsa/INE) para inmuebles si procede.

---

## 7. Menús laterales contextuales por categoría (`CategoryContextPanel`)

### 7.1 Patrón
- Un componente **`CategoryContextPanel`** recibe el `type` (property, crypto,
  job, workout, …) y renderiza **herramientas específicas** desde configuración.
- **Aparece dentro de un registro** (pantalla de detalle), **no** en el listado
  general. En el listado sigue mandando el **rail vertical de tipos** actual.
- **Config-driven (clave de extensibilidad):** se amplía `RecordTypeConfig`
  (`apps/mobile/lib/records/config.ts`) — o un registro paralelo `recordTools` —
  con:
  ```ts
  type ToolDef = {
    id: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    kind: "action" | "info" | "route" | "share";
    enabled: boolean;          // false ⇒ se muestra como "Próximamente"
    route?: string;            // para kind:"route"
    // handler se resuelve en un registry por id (no en la config serializable)
  };
  // RecordTypeConfig += { tools?: ToolDef[] }
  ```
- **Añadir una categoría nueva = añadir su `tools[]`** (+ alguna pantalla de
  herramienta). **No se reescribe la UI.**

### 7.2 UI/UX y navegación
- **Móvil (recomendado):** botón/icono en la cabecera del detalle (p. ej. 🔧 o ⋯)
  → abre un **bottom sheet** "Herramientas de {categoría}" con la lista de
  `ToolDef`. Cada tool: `action` (ejecuta + toast), `info`/`route` (navega a una
  sub-pantalla o `modal`), `share` (Share nativo). Se cierra con swipe-down o
  backdrop. **No rompe** el scroll vertical del detalle ni la navegación por tabs.
  - *Alternativas consideradas:* drawer lateral derecho (mejor en tablet, requiere
    refactor de layout) y sección expandible inline (más simple, menos
    descubrible). El bottom sheet es el mejor compromiso en móvil.
- **Web (paridad):** la columna `aside` de 320 px del detalle
  (`src/app/properties/[id]/page.tsx`, grid `lg:grid-cols-[1fr_320px]`) gana una
  **`Card` "Herramientas"** con los mismos `ToolDef`; abren modal/sección.
- **Componentes reutilizables:** `Screen, Card, Section, Button, EmptyState, Chip`
  (`apps/mobile/components/ui/`) + `useTheme`. Estado mínimo:
  `useCategoryTools(type)` (devuelve `ToolDef[]`) + `<CategoryContextSheet>`
  (presentación) + un **registry de handlers por id**.

### 7.3 Inmuebles — submenú detallado (caso de referencia)
| Tool | kind | Qué hace (ahora) | Hook futuro |
|---|---|---|---|
| **Re-check precio** | action | Refresca precio (POST `/api/listings/check` o refresh del registro) | — (ya existe el runner) |
| **Catastro** | info/route | Muestra ref. catastral y datos OVC ya guardados | Integración OVC ampliada (TODO) |
| **Registro de la Propiedad** | route | Pantalla con estructura (titularidad, cargas) | Integración registro (TODO) |
| **Datos estadísticos (INE)** | route | Panel de zona: precio medio €/m², varianza, renta estimada | **INE API** por geolocalización (TODO) |
| **Simulador de hipoteca** | route | Pantalla `MortgageSimulator`: form (importe, plazo, tipo, contrato) + cálculo de cuota + tabla de amortización | Hooks para **partner bancario** y "proceso completo" (TODO) |
| Comparar / Abrir en portal / Compartir / Editar / Eliminar | action/route/share | Genéricos | — |

> **Hipoteca:** ahora solo **UI + estructura de navegación + cálculo local**
> (cuota francesa, amortización). Componentes preparados para enchufar la lógica
> real y el envío a un partner más adelante (todo como TODO bien marcado).

### 7.4 Submenús sugeridos por categoría (información / acción / compartir)
| Categoría | Herramientas sugeridas |
|---|---|
| **property** | Re-check, Catastro, Registro, INE zona, Simulador hipoteca, Comparar, Abrir portal, Compartir |
| **renting** | Re-check, INE alquiler, Calculadora rentabilidad/yield, Checklist contrato, Abrir portal, Compartir |
| **holiday** | Re-check precio, Alertas de precio, Comparar fechas, Mapa/zona, Abrir reserva, Compartir |
| **crypto** | Gráfico avanzado, Alertas de precio, Conversor, Noticias (X trend), Añadir/editar cantidad, Compartir |
| **market** | Gráfico, Alertas, Fundamentales/dividendos, Noticias, Compartir |
| **job** | Estado candidatura (acción), Info empresa, Benchmark salarial, Preparar entrevista (checklist), Abrir oferta, Compartir |
| **workout** | Precio histórico, Alertas de precio, Info nutricional (Open Food Facts), Comparar alternativas, Añadir a lista de compra, Compartir |
| **trend** | Noticias relacionadas, Sentimiento, Evolución del volumen, Seguir/fijar, Compartir |

### 7.5 Borrado y reordenado en TODAS las categorías
- **Ya es genérico y persiste por categoría:**
  - **Borrado:** `deleteRecord(record)` enruta por tipo
    (`/api/properties/:id` o `/api/records/:id?type=`). Para tipos nuevos basta el
    `DELETE` ya añadido en `/api/records/[id]`.
  - **Reordenado:** orden **local en el dispositivo** (SecureStore), clave por tipo
    `nidokey.order.<tipo>` (`lib/local-order.ts`), aplicado en la lista. Funciona
    igual para cualquier `RecordType` sin cambios.
- **Acción:** al habilitar cada categoría nueva, **no hay trabajo extra** de
  borrado/orden (el mecanismo es agnóstico del tipo).
- **Mejora futura opcional (Fase 3):** sincronizar el orden entre dispositivos/web
  con una columna `position` o tabla `UserPreference` (hoy es preferencia local
  por diseño).

---

## 8. Mapa de archivos (para la implementación futura — no se toca ahora)

- **Nuevos adapters/proveedores:** `src/features/sources/providers/*.ts`,
  `src/features/sources/adapters/{adzuna,amadeus,hsn,apify-*}.ts` (implementan
  `SourceAdapter`); registrar en `src/features/sources/registry.ts`.
- **Persistencia:** `prisma/schema.prisma` (+ modelos por tipo + `*Snapshot`,
  aditivo); `src/features/sources/upsert.ts` (+ `case` por tipo);
  `src/lib/records/mapper.ts` (+ `*ToBaseRecord`); `refresh.ts` (+ `refreshType`).
- **Endpoints:** `src/app/api/ingest/webhook/[provider]/route.ts` (nuevo,
  `PROVIDER_SECRET`); reutilizar `/api/records/import`, `/api/cron/refresh`,
  `scripts/refresh-type.ts`.
- **UI contextual:** `apps/mobile/components/CategoryContextSheet.tsx`,
  `apps/mobile/lib/records/tools.ts` (registry de `ToolDef` + handlers),
  pantallas de herramienta (p. ej. `apps/mobile/app/tools/mortgage.tsx`); ampliar
  `RecordTypeConfig`. Web: `Card` "Herramientas" en `properties/[id]/page.tsx`.
- **Infra:** `.github/workflows/refresh.yml` (cron pesado), `.env.example`
  (+ keys), opcional worker Railway/Fly.

---

## Verificación (cuando se implemente, por fase)
1. **Piloto job (Adzuna):** `POST /api/records/import { type:"job",
   input:{kind:"query", query:"react developer asturias"} }` → crea `JobListing`
   + aparece en el menú Empleos del móvil.
2. **Refresh:** `GET /api/cron/refresh?type=job` con `Bearer $CRON_SECRET` →
   actualiza; sin secreto → 401.
3. **Workout (ScrapingBee):** importar URL de producto HSN → `WorkoutProduct` con
   precio + nutrición (Open Food Facts).
4. **Panel contextual:** en el detalle de un inmueble, icono de herramientas →
   bottom sheet con Re-check/Catastro/Registro/INE/Hipoteca; "Simulador de
   hipoteca" abre la pantalla con cálculo de cuota.
5. **Borrado/orden:** en cualquier categoría nueva, long-press → ✕ borra y
   arrastrar reordena; el orden persiste tras recargar.
6. **No regresión:** `/api/auth/*`, login web/móvil, import de inmuebles y cripto
   siguen intactos.
