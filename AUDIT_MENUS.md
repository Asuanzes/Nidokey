# AUDITORÍA — Pipeline de cartas/menús (vertical comida)

> Objetivo: diagnosticar por qué **casi ningún menú se visualiza** y por qué el que
> carga puede tardar **> 1 minuto**, y rediseñar el pipeline para que el usuario
> **nunca** espere a scraping + LLM en tiempo real.
>
> Alcance: SOLO la parte de menús. La lógica de Google Places para descubrir
> restaurantes **no se toca**.

---

## 1. Mapa del código actual

| Pieza | Archivo | Rol |
|---|---|---|
| Descubrir restaurantes | `src/lib/food/google-restaurants.ts` · `src/features/sources/providers/google-places.ts` | Google Places API v1 → upsert `Restaurant` (`source="google"`). **Intacto.** |
| Endpoint lista | `src/app/api/food/restaurants/route.ts` | Descubre + `after(() => prewarmMenus(restaurants, 3))` |
| Endpoint ficha (lectura) | `src/app/api/food/restaurants/[id]/route.ts` | Lee carta de BBDD, calcula `menuPlan()`, `after(plan.scrape)`, devuelve `{ restaurant, menuStatus }` |
| Refresco manual | `src/app/api/food/restaurants/[id]/refresh-menu/route.ts` | Pone `menuFetchedAt=null` para forzar re-scrape en el siguiente GET |
| Pipeline de menú | `src/lib/food/menu-scrape.ts` | `menuPlan` / `scrapeAndStoreMenu` / `prewarmMenus` / `extractMenu` |
| Render/scrape #1 | `src/features/sources/providers/crawl4ai.ts` | Crawl4AI (Playwright) en VPS `scrape.nidokey.es` → markdown |
| Render/scrape #2 (fallback) | `src/features/sources/providers/firecrawl.ts` | Firecrawl (de pago) → search + scrape+json |
| Estructurar a JSON | `src/features/sources/providers/llm-extract.ts` | Gemini → Groq → Claude |
| Móvil (consumo) | `apps/mobile/app/food/restaurant/[id].tsx` | Abre la ficha, **polling cada 1,5 s** mientras `menuStatus === "fetching"` |

---

## 2. Flujo actual (paso a paso, con tiempos)

```
Usuario abre restaurante
        │
        ▼
GET /api/food/restaurants/[id]      (maxDuration = 300 s)
        │  lee Restaurant + categories + items de Neon         ~50–150 ms
        │  hasMenu = ¿hay items?
        │  menuPlan() decide estado
        │     ├─ no-google → "ready"/"empty"  (fin)
        │     ├─ fresco (<90 días) → "ready"/"unavailable"  (fin)
        │     └─ stale/nunca → status "fetching" + thunk scrape
        │  if (plan.scrape) after(plan.scrape)   ← FIRE-AND-FORGET
        ▼
RESPUESTA { restaurant, menuStatus:"fetching" }  ───────────►  el móvil pinta esqueleto y empieza POLLING (cada 1,5 s)

   … en paralelo, dentro del MISMO lambda, after() ejecuta scrapeAndStoreMenu():

   resolveMenuUrl()
     ├─ placeWebsite() (Google details)                       ~0,3–1 s
     └─ si no hay web propia → firecrawlSearch()               hasta 15 s
   extractMenu(url)
     ├─ TIER 1 (gratis): Crawl4AI render home                 hasta 30 s
     │     └─ extractFromMarkdown → LLM                        hasta 60 s (+ reintentos Groq 429: +20–30 s ×3)
     │     └─ si home sin carta → pickMenuLink → Crawl4AI render carta   +30 s
     │           └─ LLM otra vez                               +60 s
     └─ TIER 2 (fallback de pago): Firecrawl scrape+json       hasta 45 s
   guardar en BBDD (transacción: borra+recrea categorías/items)  ~100–300 ms
   set menuFetchedAt = now()

   POLLING del móvil: cada 1,5 s vuelve a GET /[id] hasta que menuStatus != "fetching"
```

**Tiempo del peor caso de un scrape exitoso:** `1 + 30 + 60 + 30 + 60 ≈ 180 s`.
**Tiempo típico (home trae carta):** `1 + 30 + 60 ≈ 90 s`.

---

## 3. Cuellos de botella y BUGS (causas raíz)

### 🔴 BUG #1 — La cascada de LLMs **no** cascada (causa principal de "no se ve nada")
`llm-extract.ts::extractJson`:

```ts
if (hasGeminiKey()) return geminiExtractJson(...);   // si LANZA, NUNCA prueba Groq/Claude
if (hasGroqKey())   return groqExtractJson(...);
if (hasAnthropicKey()) return anthropicExtractJson(...);
return null;
```

Elige el **primer** proveedor configurado y, si ese lanza `ProviderUnavailableError`,
el error se propaga: **nunca** se prueba el siguiente. Según la nota de proyecto,
**Gemini gratis no funciona en EU (billing)**. Si `GEMINI_API_KEY` está puesta en
Vercel, **toda** extracción lanza → no se estructura ninguna carta → "no disponible".
El `try/catch` de `extractMenu` lo desvía a Firecrawl, pero Firecrawl es de pago y
suele no estar configurado → `categories: []` → "unavailable". **Resultado: 0 menús.**

### 🔴 BUG #2 — `after()` + `inFlight` por-instancia en serverless (duplicados + cuelgues)
- `inFlight` es un `Set` **en memoria del lambda**. El polling del móvil cada 1,5 s
  puede caer en **instancias distintas**, donde `inFlight` está vacío → cada poll
  dispara **otro** `after(plan.scrape)`. → N scrapes concurrentes del **mismo**
  restaurante → saturan el límite/min de Groq (429 → esperas de 20–30 s) → todo se
  ralentiza y el dedup no sirve entre instancias.
- El trabajo de `after()` vive atado al lambda; si la plataforma **recicla** la
  instancia tras enviar la respuesta, el scrape **muere a medias** → `menuFetchedAt`
  no se setea → el móvil se queda en **"Preparando carta…" para siempre**.

### 🟠 BOTTLENECK #3 — Render + LLM en serie, con salto de enlace
Crawl4AI (Playwright, hasta 30 s) + LLM (hasta 60 s), y si la home no trae carta se
**repite** con la página de carta (+30 s +60 s). De ahí el **> 1 min**.

### 🟠 BOTTLENECK #4 — El scrape va atado a la request del usuario
`maxDuration = 300` en el endpoint de lectura porque el lambda debe seguir vivo para
el `after()`. Aunque la respuesta sale rápida, el trabajo pesado **comparte ciclo de
vida** con la request → frágil y caro.

### 🟡 Otros
- `prewarmMenus(restaurants, 3)` en el endpoint de lista hace el mismo trabajo pesado
  vía `after()` al abrir la lista → mismos problemas #2/#3.
- Sin instrumentación de tiempos por paso → imposible medir dónde se va el tiempo.

---

## 4. Arquitectura nueva (cola + worker + cron)

**Principio:** la request del usuario solo **lee** y **encola**; el trabajo pesado
corre en un **worker** desacoplado (cron), con **lock en BBDD** (no en memoria) que
funciona entre instancias.

```
┌─ Usuario abre restaurante ──────────────────────────────────────────────┐
│ GET /api/food/restaurants/[id]      (maxDuration por defecto)            │
│   • lee carta de Neon                                  ~50–150 ms        │
│   • si google + sin carta fresca y no en cola:                          │
│         UPDATE menuStatus='PENDING', menuQueuedAt=now()  (1 UPDATE barato)│
│   • (fast-path opcional) after(processMenu(id)) con LOCK en BBDD         │
│   • devuelve { restaurant, menuStatus }  ◄── SIEMPRE < ~300 ms          │
└──────────────────────────────────────────────────────────────────────────┘
        móvil: si "fetching" → esqueleto + polling 1,5 s (igual que ahora)

┌─ Worker (desacoplado) ───────────────────────────────────────────────────┐
│ GET /api/cron/food-menus   (Bearer CRON_SECRET, maxDuration=300)         │
│   • claim atómico: updateMany WHERE menuStatus='PENDING' → 'FETCHING'    │
│     (+ reclama 'FETCHING' colgados > 5 min)   ◄── LOCK entre instancias  │
│   • por cada uno (secuencial, respeta rate-limit del LLM):               │
│       processMenu(id):                                                   │
│         resolveMenuUrl → Crawl4AI (fallback Firecrawl) → 1 LLM           │
│         guarda carta · menuStatus = READY | EMPTY | FAILED               │
│   • logs de tiempo por paso (resolve/crawl/llm/total)                    │
└──────────────────────────────────────────────────────────────────────────┘
        disparado por GitHub Actions cada 5 min (mismo patrón que refresh.yml)
        + el fast-path after() del open para que la PRIMERA apertura sea rápida
```

**Cambios clave respecto al actual:**
1. **Estado en BBDD** (`Restaurant.menuStatus` + `menuQueuedAt` + `menuAttempts`) en
   vez de `inFlight` en memoria → dedup/lock real entre instancias (arregla BUG #2).
2. **Un solo LLM principal = Groq**, con cascada **real** (try/catch por proveedor):
   `Groq → Claude → Gemini` (Gemini al final para que su fallo en EU **no bloquee**).
   Arregla BUG #1. (No se cambian keys ni se borra ningún proveedor; solo el orden y
   que el fallo de uno pase al siguiente.)
3. **Lectura desacoplada**: el endpoint de usuario solo lee + encola; `maxDuration`
   baja a por defecto.
4. **Worker cron** = único sitio donde corre Crawl4AI + LLM (maxDuration=300, fuera
   del camino del usuario).
5. **Firecrawl sigue siendo solo fallback** dentro de `extractMenu` (sin cambios).
6. **Fast-path** `after(processMenu(id))` en el open, pero con **lock en BBDD** para
   que no choque con el cron; el cron es la **red de seguridad** que garantiza que
   todo PENDING acabe resolviéndose aunque el lambda del open muera.

### Estados de `menuStatus`
| Estado | Significado | `menuStatus` API (móvil) |
|---|---|---|
| `null` | no-google (seed) o sin tocar | `ready`/`empty` según items |
| `PENDING` | encolado, sin procesar | `fetching` |
| `FETCHING` | worker procesándolo (lock) | `fetching` |
| `READY` | carta guardada con items | `ready` |
| `EMPTY` | scrapeado pero sin carta | `unavailable` |
| `FAILED` | falló tras N intentos | `unavailable` |

El contrato con el móvil (`"ready" | "fetching" | "unavailable" | "empty"`) **no
cambia** → la app no necesita modificarse.

---

## 5. Plan de pruebas

### 5.1 Medir latencia (antes vs después)
- **Antes (baseline):** abrir 10 restaurantes nuevos de Google y cronometrar desde
  el `GET /[id]` hasta que `menuStatus` pasa a `ready`/`unavailable`. Anotar cuántos
  se quedan en `fetching` > 3 min (= "nunca cargan").
- **Después:**
  - **Latencia de la request de usuario**: medir el tiempo de respuesta del
    `GET /[id]` (debe ser `< ~300 ms`, ya no espera a nada).
  - **Latencia hasta carta visible**: tiempo desde el open hasta `ready` (fast-path
    debería dar ~30–90 s en primera apertura; instantáneo si ya está cacheada).
  - **Fiabilidad**: % de restaurantes que acaban en `READY`/`EMPTY`/`FAILED` (estado
    terminal) en vez de quedarse en `fetching`. Objetivo: ~100 % terminal.

### 5.2 Logs de tiempos por paso
`processMenu` emite (tag `[food-menu]`):
```
[food-menu] <id> resolveUrl=Xms crawl=Yms llm=Zms total=Tms status=READY items=N
```
- Verificar en Vercel logs / `vercel logs` qué paso domina (Crawl4AI vs LLM).
- Confirmar que el LLM ya **no** entra por Gemini cuando falla (ver el proveedor que
  responde en el log; debe ser Groq).

### 5.3 Casos concretos
1. **Web propia con carta en home** → READY en una sola pasada (1 render + 1 LLM).
2. **Web sin carta en home** → sigue el enlace a /carta (2 renders + 2 LLM).
3. **Sin web ni Firecrawl** → EMPTY (no se queda colgado).
4. **Gemini configurado pero roto** → la extracción cae a Groq y **sí** estructura.
5. **Doble apertura rápida (2 dispositivos)** → un solo scrape (lock en BBDD), no dos.
6. **Lambda del open muere** → el cron recoge el PENDING/locked-stale y lo termina.
7. **Refrescar carta** → vuelve a PENDING y se re-scrapea.

### 5.4 Verificación funcional mínima
- `npm run lint` y build de tipos OK.
- Móvil: abrir restaurante nuevo → esqueleto → carta en < ~90 s; reabrir → instantáneo.
- Cron manual: `curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/food-menus`
  procesa la cola y devuelve un resumen `{ processed, ready, empty, failed }`.

---

## 6. Cambios a implementar (mínimos)

| Archivo | Cambio | Riesgo |
|---|---|---|
| `prisma/schema.prisma` | +`menuStatus`, `menuQueuedAt`, `menuAttempts` en `Restaurant` | requiere `prisma db push` (Neon) |
| `src/features/sources/providers/llm-extract.ts` | Cascada real con try/catch; orden Groq→Claude→Gemini | bajo |
| `src/lib/food/menu-scrape.ts` | `enqueueMenu` / `enqueueMenusForList` / `processMenu` / `runMenuQueue` + lock BBDD + logs de tiempo; `menuStatusFor` puro | medio |
| `src/app/api/food/restaurants/[id]/route.ts` | Solo lee + encola (+ fast-path after con lock); baja `maxDuration` | bajo |
| `src/app/api/food/restaurants/route.ts` | `prewarmMenus` → `enqueueMenusForList` (encolar, no scrapear) | bajo |
| `src/app/api/food/restaurants/[id]/refresh-menu/route.ts` | Re-encolar (PENDING) en vez de solo nullear | bajo |
| `src/app/api/cron/food-menus/route.ts` | **NUEVO** worker cron (Bearer CRON_SECRET) | bajo |
| `.github/workflows/food-menus.yml` | **NUEVO** ping cada 5 min (patrón de `refresh.yml`) | bajo |

**No se toca:** Google Places (descubrimiento), keys/tokens, lógica de pedidos/pagos,
el contrato `menuStatus` con el móvil.
