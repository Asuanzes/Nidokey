# Ingesta de ofertas de empleo con Apify (POC)

Primer pipeline de ingesta del vertical **empleo** (`job`) para Nidokey, usando
**actores ya hechos de Apify** (InfoJobs, LinkedIn). Diseñado como **POC** con el
plan **free de Apify ($5/ciclo)**: backend-only, sin BBDD todavía (persistencia
como esqueleto + TODO), sin UI.

Encaja en el framework de fuentes existente (`src/features/sources/`), igual que
cripto/mercado, para que el salto a vertical completo sea trivial.

## Actores elegidos (y por qué)

| Plataforma | Actor por defecto | Modelo de precio | Por qué |
|---|---|---|---|
| **InfoJobs** (España, primario) | `alvaraaz/infojobs-actor` | **pay-per-event $2/1.000 (~$0.002/oferta), SIN mínimo** | Apto free tier. Input limpio: keywords, location (provincia), workModel, jobsNumber (mín. 20). Output: id, título, empresa, ubicación, descripción, URL, workModel, fecha, technologies[], salario. |
| **LinkedIn** (secundario) | `valig/linkedin-jobs-scraper` | **pay-per-result ~$0.28–0.4/1.000** | El más barato fiable. Input conocido (title, location, datePosted, contractType, experienceLevel, remote, limit). 100 ofertas ≈ **$0.04**. ✓ Probado. |
| Indeed (futuro) | `curious_coder/indeed-scraper` | — | No en esta iteración. |

**EVITAR** (no aptos para el free tier de $5):
- `studio-amba/infojobs-scraper` → exige permitir **mínimo $5/run** (se come el crédito de golpe).
- `scrapestorm/infojobs-job-scraper---barato-cheap` → pese al nombre, es **alquiler $19.89/mes**.
- `fetchclub/…`, `bebity/…` (LinkedIn) → **alquiler $19–30/mes**.

Regla: usar solo **pay-per-result / pay-per-event** y mirar siempre la pestaña
*Pricing* del actor (algunos imponen un mínimo de coste por run).

> Los actores se pueden cambiar sin tocar código con `APIFY_INFOJOBS_ACTOR` /
> `APIFY_LINKEDIN_ACTOR` (forma `author/name`).

## Cómo configurar `APIFY_TOKEN`

1. Apify Console → **Settings → API & Integrations** → copia tu **Personal API
   token** (formato `apify_api_xxx`).
2. Pégalo en **`.env.local`** (raíz del repo, gitignored — **NUNCA** en el repo
   ni en el chat):
   ```
   APIFY_TOKEN=apify_api_xxxxxxxxxxxxxxxxxxxx
   ```
3. (Solo si más adelante se ejecuta en servidor) añádelo también en **Vercel →
   Settings → Environment Variables** (Production).

## Cómo lanzar una ingesta de prueba

```bash
npm run test-jobs
```

- Sin `APIFY_TOKEN` → imprime un aviso y sale (no gasta nada).
- Con token → lanza InfoJobs con `{ keywords: "react", location: "Asturias",
  maxItems: 5 }` e imprime 5 ofertas normalizadas. En la consola de Apify verás
  el run con su coste (céntimos).

Para LinkedIn o búsquedas propias, desde código:
```ts
import { ingestLinkedInOffers } from "@/features/sources/jobs/ingest-linkedin";
import { ingestJobs } from "@/features/sources/jobs/ingest";

await ingestLinkedInOffers({ keywords: "react", location: "Spain", maxItems: 10 });
await ingestJobs({ keywords: "qa", platforms: ["infojobs", "linkedin"], maxItems: 10 });
```

## Arquitectura

```
params (keywords, location, remote, maxItems)
  → ingest-infojobs.ts / ingest-linkedin.ts        (build input + normalize)
      → providers/apify.ts  runActorGetItems(actorId, input, { maxItems, maxTotalChargeUsd })
          → POST /v2/acts/{actor}/run-sync-get-dataset-items   (token de env)
      → ApifyItem[]  → JobOffer[]
  → ingest.ts (coordina) → jobOfferToNormalized() → saveJobOffers(ownerId)  // TODO upsert
```

Archivos:
- `src/features/sources/providers/apify.ts` — cliente Apify (fetch, sin SDK).
- `src/features/sources/jobs/types.ts` — `JobOffer`, params, `jobOfferToNormalized`.
- `src/features/sources/jobs/_item.ts` — lectores defensivos de campos.
- `src/features/sources/jobs/ingest-infojobs.ts` / `ingest-linkedin.ts` — ingesta.
- `src/features/sources/jobs/ingest.ts` — coordinador + `saveJobOffers` (esqueleto).
- `scripts/test-jobs-ingestion.ts` — prueba manual (`npm run test-jobs`).

## Salvaguardas de coste ($5)

- El provider **siempre** manda `maxItems` (default 25) y `maxTotalChargeUsd`
  (default $0.10) como tope por run.
- Recomendado en POC: **runs manuales** o **1 vez al día**, **1–2 búsquedas**,
  `maxItems` bajo. **Sin cron** ni refresco automático en esta fase.
- Cálculo rápido: $5 / $0.40 por 1.000 ≈ **12.500 ofertas** de LinkedIn antes de
  agotar el crédito (pay-per-result). Más que de sobra para un POC.

## Riesgos y limitaciones

- **Esquema de input por actor:** cada actor nombra los campos a su manera. El
  input por defecto de InfoJobs es "mejor esfuerzo"; si el actor lo rechaza
  (validación), pasa el input exacto de su pestaña **Input** vía
  `params.actorInput`, o cambia de actor con `APIFY_INFOJOBS_ACTOR`. El de
  LinkedIn (`valig`) sí tiene input conocido.
- **Cambios de HTML / mantenimiento del actor:** si el actor deja de funcionar o
  cambia su salida, la ingesta puede devolver campos vacíos. La normalización es
  defensiva (prueba varias claves) pero no infalible.
- **ToS:** LinkedIn/InfoJobs tienen términos restrictivos. Esto es un POC de uso
  personal con actores de terceros y volumen mínimo; no es scraping masivo propio
  ni producción. No scrapear desde el frontend (todo en backend).
- **Moneda/salario:** los salarios vienen como texto libre; el parser extrae
  importes (millares con `.`) sin anualizar mensuales. LinkedIn no fuerza moneda;
  el mapper asume EUR por defecto (simplificación POC).

## Camino futuro → vertical de empleo completo

Cuando se quiera mostrar "Empleos" en la app (no en esta iteración):

1. **Prisma** (aditivo, `prisma db push`): modelos `JobListing` + `JobSnapshot`
   espejando el patrón de `MarketInstrument`/`MarketSnapshot` (ownerId, recordType
   "job", title, subtitle, status, company, currentValue=salario¢, currency,
   imageUrl, source, externalId, lastCheckedAt, meta Json; `@@unique([ownerId,
   externalId, source])`).
2. **upsert.ts:** `case "job"` → `upsertJob(ownerId, normalized)` + `getJobById`.
3. **mapper.ts:** `jobToBaseRecord(j)`.
4. **registry.ts:** `job: [apifyJobsAdapter]` (un `SourceAdapter` que envuelva
   `ingestJobs` y exponga `search()` para el patrón buscar→elegir→registrar).
5. **API:** ramas `job` en `/api/records`, `/api/records/[id]`,
   `/api/records/import`, `/api/records/search`.
6. **Móvil:** en `apps/mobile/lib/records/config.ts` poner `job.enabled = true`,
   `addMode: "search"`; añadir la ruta en `records-repository.ts`. La tarjeta
   reutiliza `DefaultCard` (title, subtitle=empresa·ubicación, primaryValue=
   salario, `meta.footnote`, logo). Tools en `tools.ts` (`job: JOB_TOOLS`).

`saveJobOffers()` ya deja el `// TODO` exacto donde iría el upsert.
