# Despliegue — Fase 0 (auth) + Fase 1 (cripto)

> Implementado en la rama `refactor/records-ui`. **No desplegado todavía.** El
> código está completo y verificado (tsc web+móvil 0 errores, `prisma generate`
> OK, bundle Metro OK), pero la cripto solo mostrará datos reales tras estos
> pasos. Nada de esto cambia auth de login/OTP ni rompe inmuebles.

## Qué se ha construido

- **Fase 0 — auth unificada**: `getUserId()` resuelve cookie web + JWT móvil +
  token `bs_` en un único sitio → elimina la clase de error "Token inválido".
  `/api/listings/import` e `/api/listings/check` usan ese resolver; los crons se
  protegen con `CRON_SECRET`.
- **Fase 1 — cripto vía CoinGecko**: modelos `CryptoHolding`/`CryptoSnapshot`,
  framework `SourceAdapter`, ingesta `POST /api/records/import`, lectura
  `GET /api/records?type=crypto`, refresh `GET /api/cron/refresh?type=crypto`.

## Checklist de despliegue (gratis, sin Vercel Pro)

1. **Merge a `main`** (dispara el deploy de Vercel):
   ```
   git checkout main && git merge refactor/records-ui && git push
   ```
   > Aviso: `main` incluye también todo el trabajo de UI móvil de la rama.

2. **Aplicar la migración** contra la DB de producción (Vercel Postgres/Neon):
   ```
   DATABASE_URL="<URL de prod>" npx prisma migrate deploy
   ```
   Aplica `20260531000000_add_record_type` y `20260531120000_add_crypto`
   (ambas aditivas, no destructivas).

3. **Variables de entorno en Vercel** (Project → Settings → Environment Variables):
   - `CRON_SECRET` = genera uno: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   (CoinGecko no necesita clave.)

4. **Alta del cron gratis en cron-job.org**:
   - URL: `https://nidokey.es/api/cron/refresh?type=crypto`
   - Método: GET
   - Cabecera: `Authorization: Bearer <CRON_SECRET>`
   - Intervalo: cada 1-2 min.

5. **Verificar**:
   - Añadir una cripto:
     ```
     curl -X POST https://nidokey.es/api/records/import \
       -H "Authorization: Bearer <JWT móvil o bs_ token>" \
       -H "Content-Type: application/json" \
       -d '{"type":"crypto","input":{"kind":"symbol","symbol":"BTC","quote":"EUR"}}'
     ```
     → 201 con el `record` (BaseRecord de BTC).
   - Listar: `GET https://nidokey.es/api/records?type=crypto` (con auth) → BTC con precio.
   - Refresh manual: `GET …/api/cron/refresh?type=crypto` con la cabecera del secreto → `{checked, updated}`; sin secreto → 401.
   - **Móvil**: pestaña Registros → icono cripto → aparece BTC y refresca al volver a foco.

## Notas / pendientes

- **Sin desplegar, la pestaña cripto del móvil dará error** (llama a
  `/api/records?type=crypto` que aún no existe en prod). Es lo esperado hasta el
  paso 1-2.
- **Añadir cripto desde el móvil (UI)**: de momento se añade vía API (paso 5) o
  un futuro formulario de símbolo en la pantalla Importar. No incluido en Fase 1.
- **Precisión sub-céntimo**: tokens por debajo de 0,01 € pierden precisión en
  `Int` (céntimos). El precio crudo se guarda en `meta.priceRaw`. Futuro: Decimal.
- **GitHub Actions** (`scripts/refresh-type.ts` / `npm run refresh`) queda listo
  para los tipos pesados/scraping de fases posteriores (property/renting).
