# Arquitectura de registros (records) — Nidokey

> Estado: refactor `refactor/records-ui` (mayo 2026). Documenta el modelo
> unificado de registros y la arquitectura por capas de la app móvil.

Nidokey nació como catálogo de inmuebles pero está diseñado para escalar a más
tipos de registro (cryptos, jobs, workouts, holidays, renting…). Para no
reescribir la UI por cada tipo, todo gira en torno a un contrato común:
**`BaseRecord`**.

---

## 1. Modelo de dominio (`@nidokey/shared`)

`packages/shared/src/records.ts` — compartido web ↔ móvil:

| Símbolo | Qué es |
|---|---|
| `RecordType` | Unión de tipos: `property` \| `crypto` \| `job` \| `workout` \| `holiday` \| `renting`. |
| `BaseRecord` | Contrato común a todo registro: `id, type, title, subtitle?, status?, primaryValue?, imageUrl?, createdAt?, updatedAt?, meta`. |
| `RecordListParams` | Filtros de listado (`type`, `query`, `limit`). |
| `metaField(record, key, fallback)` | Lectura tipada de `meta`. |

Los campos específicos de cada tipo viven en `meta` (sin tipar en la base) y se
resuelven en el detalle. La lista y la cabecera del detalle se construyen **solo**
con los campos de `BaseRecord`.

---

## 2. Capas de la app móvil

Separación estricta **data → domain → UI** (la UI nunca llama a `fetch`/`api()`
directamente):

```
apps/mobile/
├─ lib/
│  ├─ api.ts                  # cliente HTTP base (auth Bearer + base URL). NO TOCAR auth.
│  ├─ records/
│  │  ├─ config.ts            # RECORD_TYPE_CONFIG (label, color, icono, enabled)
│  │  ├─ mappers.ts           # /api/properties|search  ->  BaseRecord
│  │  └─ property.ts          # PropertyDetail + fetchPropertyDetail
│  ├─ data/
│  │  └─ records-repository.ts# fetchRecords / searchRecords  (ÚNICA puerta a datos)
│  └─ hooks/
│     ├─ useQuery.ts          # fetching unificado (foco + intervalo)
│     ├─ useRecords.ts        # lista de records
│     └─ useRecord.ts         # un record (detalle)
├─ components/
│  ├─ ui/                     # kit: Button, Card, Chip, Section, EmptyState, Screen
│  └─ RecordCard.tsx          # tarjeta genérica sobre BaseRecord
└─ app/(tabs)/…               # pantallas (solo presentación)
```

### Fetching unificado — `useQuery`

Sustituye el patrón `useState + useEffect + fetch` que cada pantalla repetía.
Aporta en un solo sitio: `data/error/loading/refreshing/refetch` + revalidación
**al volver a primer plano** (`AppState`) y **por intervalo** (tiempo casi real).
No es SWR/React Query (sin caché global); si se adopta uno, este hook es el único
punto a cambiar.

- `useRecords({ type })` → lista, revalida en foco + cada 60 s.
- `useRecord(fetcher, deps)` → detalle, revalida en foco.

---

## 3. Cómo añadir un nuevo tipo de registro

1. **Tipo**: añade el valor a `RecordType` y a `RECORD_TYPES` en
   `packages/shared/src/records.ts`.
2. **Config UI**: añade la entrada en `RECORD_TYPE_CONFIG`
   (`apps/mobile/lib/records/config.ts`) con `label`, `color`, `icon`,
   `enabled: true`.
3. **Datos**: en `records-repository.ts`, añade la rama del nuevo `type` en
   `fetchRecords` (mapeando su endpoint a `BaseRecord` con un mapper nuevo).
4. **(Opcional) Detalle**: crea `lib/records/<tipo>.ts` con su tipo de detalle y
   fetcher, y un renderer de secciones específico.

La lista, los chips de filtro y la `RecordCard` **no se tocan**: ya leen del
registry y de `BaseRecord`.

---

## 4. Backend

| Endpoint | Estado | Notas |
|---|---|---|
| `GET /api/properties`, `/api/properties/:id` | ✅ en producción | Fuente actual que consume la app. |
| `GET /api/records?type=`, `/api/records/:id` | 🟡 implementado, **NO desplegado** | Wrapper sobre lo existente → `BaseRecord`. Owner-scoped (`requireUserId` + `ownerId` ⇒ 404 si ajeno). No lee aún la columna `recordType`, así que es desplegable incluso antes de la migración. |

- `src/lib/records/mapper.ts`: `propertyToBaseRecord` (Prisma → `BaseRecord`).
- **Prisma**: `Property.recordType String @default("property")` + índice
  (migración `20260531000000_add_record_type`, **aditiva**). Escrita a mano (sin
  DB local); **pendiente de aplicar** con `prisma migrate deploy` tras revisión.

### Plan de adopción de `/api/records` (cuando se decida)

1. Aplicar la migración (`prisma migrate deploy`) + `prisma generate`.
2. Desplegar el backend (las rutas `/api/records` ya están en el repo).
3. En el móvil, cambiar **solo** `records-repository.ts` para apuntar a
   `/api/records` en vez de `/api/properties`. Nada más cambia.

---

## 5. Zona crítica: autenticación (NO TOCAR)

El refactor **no modifica** la auth (web magic-link ni móvil JWT HS256, issuer
`nidokey-mobile`). El único cambio relacionado fue ampliar
`/api/listings/import` para aceptar también el JWT móvil además de los tokens
`bs_` (documentado en el commit). Generación/verificación de tokens, endpoints
`/api/auth/*` y middleware quedan intactos.

---

## 6. Pendiente

- [ ] Aplicar migración `recordType` + desplegar `/api/records` (tras revisión).
- [ ] Migrar el móvil a `/api/records` (1 archivo).
- [ ] Plan de seguridad de registros — ver `docs/seguridad-registros.md`
      (documento; **no implementado** hasta aprobación).
- [ ] Build de release standalone (bug de entry en monorepo SDK 54, pendiente).
- [ ] Patches en `node_modules` (react-native-webview AGP, react-native-share-menu
      sdk) → migrar a `patch-package` para que sobrevivan a `npm install`.
