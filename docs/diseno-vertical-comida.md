# Vertical «Comida a domicilio» — Diseño técnico

> **Flag de sesión: «vertical-comida»** — invocar este nombre para retomar.
> Estado: DISEÑO CERRADO (2026-06-12), implementación pendiente (v1).
> Origen: diseño multi-agente (3 exploradores del repo + 2 diseñadores +
> revisor adversarial que cazó 12 incoherencias contra el código real, ya
> corregidas aquí).

**Principios heredados del codebase**: categoría no-CRUD tipo chat (no pasa por
`/api/records`), precios en cents, guards que devuelven 404 (nunca 403),
idempotencia por `clientId`, `after()` para efectos post-respuesta, tiempo real
reutilizando el gateway WS del VPS (aviso opaco → refetch + polling fallback +
push Expo), `prisma db push` (NUNCA migrate), v1-v2 100 % OTA (sin módulos
nativos nuevos).

---

## 1. Modelo de datos

Sin colisiones con el schema actual (verificado contra `prisma/schema.prisma`).
El **carrito NO se persiste** (contexto local del móvil); la primera fila en
BBDD es el `FoodOrder` en el checkout.

```prisma
enum FoodOrderStatus {
  CREATED          // checkout hecho, intent aún no creado
  PENDING_PAYMENT  // intent creado, esperando webhook
  PAID             // SOLO vía webhook firmado
  PREPARING        // restaurante aceptó
  READY            // restaurante: listo para recoger
  IN_DELIVERY      // repartidor recogió
  DELIVERED        // terminal
  CANCELLED        // terminal
}

enum FoodPaymentStatus { CREATED PENDING SUCCEEDED FAILED REFUNDED EXPIRED }
enum FoodStaffRole { OWNER MANAGER STAFF }
enum FoodOrderActor { CUSTOMER RESTAURANT COURIER SYSTEM }

model Restaurant {
  id               String   @id @default(cuid())
  name             String
  slug             String   @unique
  description      String?  @db.Text
  imageUrl         String?            // key R2 "food/r/<id>/cover.jpg" o URL
  phone            String?
  address          String
  city             String
  postalCode       String?
  latitude         Float              // WGS84 — bounding box + haversine
  longitude        Float
  isOpen           Boolean  @default(true)   // interruptor manual del restaurante
  openingHours     Json?              // { mon: [["12:00","16:00"]], … } — informativo v1
  minOrderCents    Int      @default(0)
  deliveryFeeCents Int      @default(0)
  deliveryRadiusM  Int      @default(5000)
  currency         String   @default("EUR")
  active           Boolean  @default(true)   // alta/baja por ADMIN, nunca borrar
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  staff      RestaurantStaff[]
  categories MenuCategory[]
  items      MenuItem[]
  orders     FoodOrder[]

  @@index([active, city])
  @@index([latitude, longitude])
}

// Capacidad "actúo como restaurante" = fila aquí (sin RBAC global, patrón guard chat).
model RestaurantStaff {
  id           String        @id @default(cuid())
  restaurantId String
  restaurant   Restaurant    @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  role         FoodStaffRole @default(STAFF)
  createdAt    DateTime      @default(now())

  @@unique([restaurantId, userId])
  @@index([userId])
}

// Capacidad "actúo como repartidor" = fila aquí (alta por admin/seed).
model CourierProfile {
  id         String    @id @default(cuid())
  userId     String    @unique
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  active     Boolean   @default(true)
  vehicle    String?            // "bike" | "moto" | "car"
  lastLat    Float?
  lastLng    Float?
  lastSeenAt DateTime?
  createdAt  DateTime  @default(now())

  @@index([active])
}

model MenuCategory {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  name         String
  sortOrder    Int        @default(0)
  active       Boolean    @default(true)

  items MenuItem[]

  @@index([restaurantId, sortOrder])
}

model MenuItem {
  id           String        @id @default(cuid())
  restaurantId String
  restaurant   Restaurant    @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  categoryId   String?
  category     MenuCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  name         String
  description  String?       @db.Text
  imageUrl     String?            // key R2 "food/r/<rid>/items/<id>.jpg"
  priceCents   Int                // fuente de verdad del precio
  available    Boolean       @default(true)
  allergens    String[]      @default([])
  sortOrder    Int           @default(0)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([restaurantId, available])
}

// Direcciones guardadas del cliente (el pedido lleva SNAPSHOT aparte).
model FoodAddress {
  id         String   @id @default(cuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  label      String             // "Casa", "Trabajo"
  line       String
  city       String
  postalCode String?
  latitude   Float              // geocodificadas SERVER-SIDE (src/lib/geocode.ts)
  longitude  Float
  notes      String?  @db.VarChar(280)
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())

  @@index([userId])
}

model FoodOrder {
  id           String          @id @default(cuid())
  code         String          @unique           // "NK-7F3K2A" para soporte/UI
  customerId   String?
  customer     User?           @relation(fields: [customerId], references: [id], onDelete: SetNull)
  restaurantId String
  restaurant   Restaurant      @relation(fields: [restaurantId], references: [id], onDelete: Restrict)
  courierId    String?                            // soft-ref a User.id (histórico)
  status       FoodOrderStatus @default(CREATED)
  clientId     String?                            // idempotencia checkout (patrón ChatMessage)

  // SNAPSHOT de entrega
  deliveryAddress String
  deliveryCity    String?
  deliveryLat     Float
  deliveryLng     Float
  deliveryNotes   String?       @db.VarChar(280)

  // Importes SIEMPRE recalculados server-side, en céntimos
  subtotalCents    Int
  deliveryFeeCents Int
  totalCents       Int
  currency         String       @default("EUR")

  expiresAt    DateTime?                          // createdAt+30min mientras no PAID (cron)
  paidAt       DateTime?
  acceptedAt   DateTime?
  readyAt      DateTime?
  pickedUpAt   DateTime?
  deliveredAt  DateTime?
  cancelledAt  DateTime?
  cancelReason String?          @db.VarChar(280)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  items   FoodOrderItem[]
  payment FoodPayment?
  events  FoodOrderEvent[]

  @@unique([customerId, clientId])               // idempotencia POST /orders
  @@index([customerId, createdAt])               // historial del cliente
  @@index([restaurantId, status, createdAt])     // panel restaurante
  @@index([courierId, status])                   // panel repartidor
  @@index([status, expiresAt])                   // cron de expiración
  @@index([status, courierId, createdAt])        // pool: READY sin courier
}

model FoodOrderItem {
  id             String    @id @default(cuid())
  orderId        String
  order          FoodOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)
  menuItemId     String?                  // soft-ref: el plato puede borrarse del menú
  nameSnapshot   String                   // SNAPSHOT (los precios/nombres del menú cambian)
  unitPriceCents Int                      // SNAPSHOT del MenuItem.priceCents
  quantity       Int
  totalCents     Int
  notes          String?   @db.VarChar(280)

  @@index([orderId])
}

// 1:1 con el pedido. Agnóstico de proveedor: provider + ids opacos.
model FoodPayment {
  id               String            @id @default(cuid())
  orderId          String            @unique
  order            FoodOrder         @relation(fields: [orderId], references: [id], onDelete: Cascade)
  provider         String                       // "stripe" | "redsys" | "paypal" | "fake"
  providerIntentId String?
  providerRefundId String?
  status           FoodPaymentStatus @default(CREATED)
  amountCents      Int                          // DEBE == order.totalCents; verificado vs webhook
  currency         String            @default("EUR")
  checkoutUrl      String?           @db.Text
  errorCode        String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@unique([provider, providerIntentId])
  @@index([status, updatedAt])                  // cron de reconciliación
}

// Idempotencia de webhooks: insert con unique → P2002 = ya procesado → 200.
model PaymentWebhookEvent {
  id          String   @id @default(cuid())
  provider    String
  eventId     String                  // id del evento DEL PROVEEDOR
  type        String
  orderId     String?                 // soft-ref forense
  payload     Json?                   // cuerpo crudo (datos de tarjeta JAMÁS llegan)
  processedAt DateTime @default(now())

  @@unique([provider, eventId])
  @@index([orderId])
}

// Auditoría de transiciones (timeline del cliente + forense).
model FoodOrderEvent {
  id         String           @id @default(cuid())
  orderId    String
  order      FoodOrder        @relation(fields: [orderId], references: [id], onDelete: Cascade)
  fromStatus FoodOrderStatus?
  toStatus   FoodOrderStatus
  actorType  FoodOrderActor
  actorId    String?                  // userId; null para SYSTEM
  meta       Json?
  createdAt  DateTime         @default(now())

  @@index([orderId, createdAt])
}
```

**`User`** gana relaciones aditivas: `foodOrders FoodOrder[]`,
`foodAddresses FoodAddress[]`, `restaurantStaff RestaurantStaff[]`,
`courierProfile CourierProfile?`. Aplicar con `npx prisma db push`.

### Matriz de estados

Guard `TRANSITIONS` en `src/lib/food/state.ts`. Toda transición:
`prisma.foodOrder.updateMany({ where: { id, status: from }, data: … })` —
`count === 0` ⇒ 409 (optimistic concurrency, sin carreras) — + `FoodOrderEvent`
en la misma `$transaction`. Efectos en `after()`.

| De → A | Quién | Efectos (`after()`) |
|---|---|---|
| ∅ → CREATED | Cliente (`POST /orders`) | — |
| CREATED → PENDING_PAYMENT | Sistema (`/pay` crea intent) | — |
| PENDING_PAYMENT → **PAID** | **SOLO webhook firmado** | notify gateway + 🛎 push staff + push cliente |
| CREATED\|PENDING_PAYMENT → CANCELLED | Cliente o cron TTL (30 min) | expira intent best-effort; payment → EXPIRED |
| PAID → PREPARING | Restaurante (`accept`) | notify + push cliente "👨‍🍳" |
| PAID\|PREPARING → CANCELLED | Restaurante (`reject` + motivo) | **refund automático** + notify + push |
| PREPARING → READY | Restaurante (`ready`) | notify (couriers ven el pool) |
| READY → IN_DELIVERY | Courier asignado (`pickup`; antes `claim`) | notify + push cliente "🛵" |
| IN_DELIVERY → DELIVERED | Courier (`deliver`) | notify + push "✅" |

- `DELIVERED`/`CANCELLED` terminales (rectificaciones = admin/SQL).
- `claim` = `updateMany({ where: { id, status: { in: [PREPARING, READY] }, courierId: null } })` — el primero gana. No cambia status (eso lo hace `pickup`).
- El cliente NO cancela tras `PAID` en v1 (hay dinero y cocina); tras pago cancela el restaurante (con refund) o soporte.

---

## 2. Flujo de usuario en la categoría comida

Entrada por el rail, patrón chat (`(tabs)/index.tsx`): `const isFood = type === "food"`
+ `{isFood && <FoodHome />}` + `useRecords({type}, {enabled: !isChat && !isFood})`.

| Pantalla | Archivo | Qué hace |
|---|---|---|
| **FoodHome** (inline) | `components/food/FoodHome.tsx` | Cabecera «📍 Entregar en: {label}» (tocable) · banner de pedido activo (≠ terminal → `/food/order/[id]`) · buscador debounce 250 ms + chips de cocina · FlatList de RestaurantCard (foto, distancia, fee, «Cerrado») · botón «Mis pedidos». Sin dirección → EmptyState con CTA (prerequisito) |
| Dirección | `app/food/address.tsx` | Formulario manual → `POST /api/food/addresses` que **geocodifica server-side** (`src/lib/geocode.ts`) y guarda lat/lng; lista con `isDefault`. GPS (`expo-location`) = v3; el formulario manual queda como fallback PERMANENTE |
| Carta | `app/food/restaurant/[id].tsx` | Secciones del menú, stepper −/+. **Carrito en contexto local** (`lib/food/cart-context.tsx`): un carrito = un restaurante (modal «¿Vaciar?»). Barra sticky «Ver carrito · N · X €» |
| Carrito | `app/food/cart.tsx` | Qty editable, notas; resumen de `POST /api/food/orders/quote` (server-side; el cliente nunca calcula lo que se cobra) |
| Checkout | `app/food/checkout.tsx` | Dirección + resumen + pago. `POST /orders` → `POST /orders/[id]/pay` → `WebBrowser.openAuthSessionAsync(checkoutUrl, "nidokey://food/order/{id}")` |
| Pedido/seguimiento | `app/food/order/[id].tsx` | Stepper vertical de estados (CANCELADO rama roja), items, total, timeline. Al volver del pago: «Verificando pago…» + polling de `payment-status` — **el return URL jamás confirma nada**. Tiempo real: gateway + polling adaptativo (5 s sin socket / 60 s con) + push |
| Historial | `app/food/orders.tsx` | Cards (restaurante, fecha, total, badge) + «Repetir pedido» |

**Paso por pasarela (v2)** — los checkouts hospedados exigen return-URL **https**
(rechazan esquemas custom):
```
openAuthSessionAsync(checkoutUrl, "nidokey://food/order/{id}")
  pasarela → success_url = https://nidokey.es/food/pay/return?orderId={id}   ← página puente (PUBLIC_PATHS)
  la puente redirige a nidokey://food/order/{id}?from=payment → el browser se cierra solo
```

**Restaurante y repartidor: misma app, gateados por capacidad** (fila en BBDD;
`GET /api/food/me` → `{staffOf[], isCourier}` en contexto ligero; la UI solo se
pinta si existe la capacidad — la seguridad real es el guard 404 del server):
- **Panel restaurante** (`app/food/restaurant-panel/`): cola por estado —
  *Nuevos (PAGADO)* → Aceptar/Rechazar(motivo); *En preparación* → Listo.
  Tiempo real + haptic (`expo-haptics` instalado). v2: gestión de carta
  (disponibilidad/precio/fotos vía R2 presigned).
- **Modo repartidor** (`app/food/courier/`): toggle Disponible; pool de READY
  cercanos → «Aceptar reparto» (claim); entrega activa con direcciones +
  **«Abrir en Maps»** (`https://maps.google.com/?daddr=lat,lng` — OTA, sin
  react-native-maps) + Recogido/Entregado.

---

## 3. APIs y eventos (incluyendo pagos)

Convenciones: Zod → 400 `flatten()`, `requireUserId()`, guard → 404, `after()`.
Guards nuevos en `src/lib/food/guard.ts`: `getStaffOrNull`, `getCourierOrNull`,
`getOrderForViewerOrNull` (cliente ∨ staff ∨ courier asignado).

### Descubrimiento (cliente)
| Endpoint | Notas |
|---|---|
| `GET /api/food/restaurants?lat&lng&q?&radiusM?` | Bounding box SQL + `haversineMeters` (`@nidokey/shared/similarity`) + sort distancia, take 30 |
| `GET /api/food/restaurants/[id]` | Carta completa (imágenes R2 firmadas) |
| `GET /api/food/search?q&lat&lng` | Platos por nombre ∩ restaurantes del radio |
| `GET/POST/PATCH/DELETE /api/food/addresses` | El POST geocodifica server-side |

### Pedido
| Endpoint | Notas |
|---|---|
| `POST /api/food/orders/quote` | Recalcula subtotal/fee/total server-side (solo lectura) |
| `POST /api/food/orders` | `{restaurantId, clientId, addressId∨address, items[]}` → relee MenuItem de BBDD (**ignora precios del cliente**), valida active+isOpen, radio, mínimo; snapshots; `expiresAt=+30min`. Idempotente por `[customerId, clientId]` |
| `GET /api/food/orders?role=customer\|restaurant\|courier&status?&active?` | Listados por actor |
| `GET /api/food/orders/[id]` | DTO completo (items, payment.status, timeline) |
| `POST /api/food/orders/[id]/cancel` | Cliente, solo CREATED\|PENDING_PAYMENT |

### Pagos
| Endpoint | Notas |
|---|---|
| `POST /api/food/orders/[id]/pay` | Crea/reutiliza FoodPayment; intent con `amount = order.totalCents` de BBDD → `{checkoutUrl}`. Si el payment previo está FAILED\|EXPIRED y el pedido sigue vivo: **nuevo intent sobre la misma fila** |
| `POST /api/payments/webhook/[provider]` | ⚠️ **Añadir a PUBLIC_PATHS del middleware** (la firma del proveedor ES la auth; sin esto el Edge devuelve 401). Verificar firma → insert PaymentWebhookEvent (P2002 ⇒ ya procesado ⇒ 200) → verificar `amount === payment.amountCents` → `$transaction`: payment→SUCCEEDED + order→PAID + event → `after(notify+push)`. 200 siempre que la firma valide |
| `GET /api/food/orders/[id]/payment-status` | Solo lectura; lo pollea el móvil al volver |
| `GET /food/pay/return?orderId` (página) | Puente https→`nidokey://` (en PUBLIC_PATHS) |

### Transiciones / staff / cron
| Endpoint | Quién |
|---|---|
| `POST /orders/[id]/accept` · `/reject {reason}` · `/ready` | Staff |
| `GET /api/food/courier/available?lat&lng` · `POST /orders/[id]/claim` · `/pickup` · `/deliver` | Courier |
| `POST/PATCH /api/food/restaurants/[id]/menu` · `PATCH …/open` | Staff OWNER\|MANAGER |
| `GET /api/food/me` | `{staffOf[], isCourier}` |
| `/api/cron/food-expire` · `/api/cron/food-reconcile` | CRON_SECRET (GitHub Actions, patrón chat-cleanup) |

### Tiempo real (gateway existente — cambio mínimo)
```jsonc
// Vercel → POST {gateway}/notify (HMAC x-nidokey-signature, igual que chat)
{ "event": "order", "orderId": "…", "status": "PAID", "participantIds": ["uid1","uid2"] }
```
- ⚠️ El gateway HOY descarta `event !== "message"`: añadir rama `order` en
  `gateway/server.mjs` (+ contador `relayedOrder` en /healthz) y **redesplegar
  al VPS ANTES** de que el backend emita.
- `participantIds` pre-filtrados en Vercel:
  `[customerId, ...staffUserIds, courierId].filter(u => u && u !== actorUserId)`
  (resolver `RestaurantStaff.userId[]`; nunca pasar `restaurantId`). El gateway
  hace fan-out plano.
- Móvil: extender `lib/chat/socket.ts` con `onOrderEvent(cb)` (mismo WS/ticket/
  backoff) → coalescing 300 ms → refetch. Polling fallback siempre.

### Pasarela agnóstica — `src/lib/payments/provider.ts`
```ts
interface PaymentProvider {
  createIntent(p: { amountCents: number; currency: string; orderId: string; returnUrl: string }):
    Promise<{ intentId: string; checkoutUrl: string }>;
  verifyWebhook(req: Request): Promise<{ eventId: string; type: "succeeded"|"failed"|"refunded";
    intentId: string; amountCents: number } | null>;   // null = firma inválida
  getIntentStatus(intentId: string): Promise<"pending"|"succeeded"|"failed"|"expired">;
  refund(intentId: string): Promise<{ refundId: string }>;
  expire(intentId: string): Promise<void>;
}
```
- **Guardar**: provider, intentId, refundId, status, amountCents, checkoutUrl,
  errorCode + cada evento con su eventId. **NO guardar JAMÁS** (ni en logs):
  PAN/CVV/caducidad/3DS — la tarjeta solo se teclea en la página del proveedor
  → alcance **SAQ-A**.
- **Anti-inconsistencias**: (1) total server-side dos veces (pedido e intent) y
  verificado en el webhook; (2) **webhook-first** — PAID nunca por return URL;
  (3) idempotencia por `[provider, eventId]` único; (4) `/pay` idempotente;
  (5) TTL 30 min único; carrera webhook-tardío vs cron: pago confirmado sobre
  pedido ya CANCELLED ⇒ **refund automático**; (6) reconciliación cada 15 min
  (`getIntentStatus` de PENDING estancados — cubre webhooks perdidos; el
  proveedor además reintenta días); (7) refund de `reject` síncrono con
  errorCode + retry si falla.

---

## 4. Integración con el resto de categorías

| # | Archivo | Cambio |
|---|---|---|
| 1 | `packages/shared/src/records.ts` | `"food"` en union `RecordType` y `RECORD_TYPES` |
| 2 | `apps/mobile/lib/records/config.ts` | `food: { color, colorDark, icon: "restaurant-outline", enabled: true, addMode: "soon" }` |
| 3 | `locales/{es,en}/translation.json` | `types.food.*` + namespace `food.*` |
| 4 | `lib/records/category-icons.ts` | SVG monocromo |
| 5 | `(tabs)/index.tsx` | `isFood` + `{isFood && <FoodHome/>}` + bypass useRecords |
| 6 | `(tabs)/importar.tsx` | `.filter(tp => tp !== "chat" && tp !== "food")` |
| 7 | `lib/chat/socket.ts` + `gateway/server.mjs` | Canal `order` (móvil + VPS) |
| 8-10 | Nuevos: `app/food/*`, `components/food/*`, `src/app/api/food/**`, `src/lib/food/*`, `src/lib/payments/*`, schema | — |

**Como viajes**: ubicación → opciones → elegir → pagar → seguir. **Distinto de
records**: sin alta libre (restaurantes por seed/admin: `prisma/seed.ts` +
Prisma Studio), sin URL-import, sin dedup, sin búsqueda global/dashboard/
actividad (records-based → cero trabajo extra). **Historial**: dentro de la
categoría (`/food/orders` desde FoodHome); opcional fila en Cuenta si ≥1 pedido.

---

## 5. MVP incremental

### v1 — Circuito completo con pasarela FAKE (100 % OTA)
**Corte: cliente pide → restaurante acepta → courier entrega, estados en tiempo
real. Sin dinero real, MISMO circuito de pago.**
- Modelos + seed (2-3 restaurantes), categoría en rail, FoodHome, dirección
  manual + geocode server-side, búsqueda bounding box + haversine, carta,
  carrito local, checkout.
- 🔑 Provider **`"fake"`**: página propia «Simular pago OK/KO» que dispara el
  MISMO webhook firmado — el invariante *PAID-solo-vía-webhook* + idempotencia
  + TTL se prueban desde el día 1; nada que desmontar en v2. (Contrareembolso
  DESCARTADO en v1: exigiría `paymentMethod` y rama de matriz aparte.)
- Panel restaurante (aceptar/rechazar/listo) + modo courier (claim/pickup/
  deliver) gateados por fila.
- Tiempo real: rama `order` en gateway (⚠️ redeploy VPS primero) + push + polling.
- Cron `food-expire` (TTL 30 min).

### v2 — Dinero real con checkout hospedado (100 % OTA)
- `StripeProvider` (o Redsys/PayPal) tras la interfaz; webhook real en
  PUBLIC_PATHS; página puente `/food/pay/return`.
- `openAuthSessionAsync` + «Verificando pago…» + polling payment-status.
- Refund automático en reject, cron `food-reconcile`, reintento tras FAILED.
- Gestión de carta en el panel (disponibilidad/precio/fotos R2).

### v3 — Experiencia «Glovo» nativa (BUILD; iOS en Mac)
- 🔨 `expo-location`: «Usar mi ubicación» + tracking del courier (posición
  foreground 10-15 s → endpoint → relay opaco gateway → cliente refetchea).
- 🔨 `react-native-maps`: mapa en seguimiento y courier (intermedio OTA: webview).
- 🔨 SDK nativo de pasarela (PaymentSheet) — mismos endpoints; `/pay` devolvería
  además `clientSecret`; checkout hospedado queda como fallback permanente.
- OTA en paralelo: ratings, multi-pedido, horarios avanzados.

**Regla de oro**: el formulario manual de dirección y el checkout por navegador
NO se eliminan nunca — son el fallback de los caminos nativos.
