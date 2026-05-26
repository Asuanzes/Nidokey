# Claude Code — implementation prompt for the new vertical-tabs navigation

> Copy everything below the `---` into Claude Code (VS Code) as a single
> message. Open the BuySell repo first.

---

# BuySell Asturias — implementar nueva navegación vertical-tabs + rediseño de la pantalla Inmuebles

## Contexto

Hemos rediseñado la navegación de BuySell para usar **vertical tabs en todas las plataformas** (web + Android + iOS) con **grupos colapsables** estilo Chrome Vertical Tabs, pero adaptado a la sobriedad de BuySell (acentos como hairlines de 2 px, sin chips saturados, sin emoji). También hemos rediseñado la pantalla **Inmuebles** como la pantalla representativa de cada plataforma.

Tienes 3 ficheros de diseño-spec en TSX bajo `screens/tsx/` (vienen del Design System pero los copio aquí abajo si los necesitas embebidos en el chat):

- `screens/tsx/web-inmuebles.tsx` — Next.js + Tailwind, drop-in para web
- `screens/tsx/mobile-android-inmuebles.tsx` — Expo + React Native + lucide-react-native
- `screens/tsx/mobile-ios-inmuebles.tsx` — idéntico al anterior salvo headers/StatusBar (iOS large-title 22 / 700, Android 20 / 600)

Los specs tienen **datos hardcoded** — tu trabajo es conservar el diseño y conectarlo a los datos reales del repo.

## Trabajo a hacer

### Web — `src/`

1. **Reemplaza `src/components/AppShell.tsx`** con la nueva sidebar agrupada. El spec está en `screens/tsx/web-inmuebles.tsx` (componente `Sidebar`). Cambios respecto al actual:
   - **Grupos colapsables**: Catálogo, Análisis, Captura. Cada uno con un acento en su header como **`border-left: 2px solid <accent>`** sobre el botón uppercase del grupo (`Catálogo` = `#3A5F8A`, `Análisis` = `#2C7A8A`, `Captura` = `#A86A17`).
   - **Estado abierto/cerrado** persistido en `localStorage` (key `buysell.sidebar.groups`, JSON de `Record<string, boolean>`).
   - **Items del nav**: usa el array `NAV_GROUPS` del spec.
   - **Footer**: solo Perfil + Ajustes. Mueve "Cerrar sesión" como ítem dentro de la pantalla de Ajustes (no en el sidebar).
   - **Activo** se marca con `pathname.startsWith(item.href)` como hoy; clases activas: `bg-primary-soft text-primary font-medium`.
   - Los `href` correctos son: `inmuebles → /properties`, `duplicados → /matches`, `dashboard → /dashboard`, `actividad → /activity`, `importar → /bookmarklet`, `perfil → /perfil`, `ajustes → /ajustes`. **Crea los stubs de página vacíos para los que no existan todavía** (los iremos rellenando después). Cualquier item sin destino: `aria-disabled` y `cursor-not-allowed`.

2. **Adapta `src/app/properties/page.tsx`** al nuevo layout visual del spec:
   - Toolbar superior con conteo de fichas + sync info (eyebrow `"23 fichas · sincronizado hace 12 min · 3 cambios nuevos"`) a la izquierda, botón Filtros + dropdown Ordenar a la derecha.
   - Grid de **3 columnas fijas** (`grid grid-cols-3 gap-4`) por encima de `lg`. No subas a 4 col — si el usuario quiere densidad, debe usar la vista Tabla.
   - El componente `PropertyCard` del spec sustituye al actual `src/features/properties/PropertyCard.tsx`. Mantén la firma del prop pero ajusta el JSX al spec.
   - **Datos reales**: NO uses el `MOCK_PROPS` del spec — usa la query Prisma que ya hay en `properties/page.tsx`. La info de "duplicados" sale de `prisma.matchSuggestion.count({ where: { sourceId: { equals: p.id }, dismissedAt: null, score: { gte: 60 } } })`. Cárgalo en el mismo `Promise.all` para no hacer N+1.
   - Mueve `FiltersSidebar` a un `Sheet` lateral que se abre con el botón "Filtros" — la sidebar de navegación principal ya ocupa el flanco izquierdo. Usa Radix UI Dialog (o tu pattern habitual) con `side="right"`.

3. **Topbar**: el search field del spec sustituye al `GlobalSearch` actual. Mismo placeholder, mismo `⌘K` indicator a la derecha del input. Mantén `Cmd/Ctrl + K` como atajo (focus input).

### Mobile — `apps/mobile/`

⚠️ **Instala estas deps primero** si no están:
```
cd apps/mobile
npm install lucide-react-native expo-status-bar react-native-safe-area-context
```

4. **Reemplaza `apps/mobile/app/_layout.tsx`** — cambia el componente `Tabs` por un layout que renderiza el **rail vertical de 56 px** siempre visible a la izquierda + un `Stack` para el contenido. NO uses bottom tabs.
   - El rail es el mismo del spec (`Rail` en `mobile-android-inmuebles.tsx`).
   - Cada item del rail navega via `router.push(...)` (de `expo-router`).
   - El badge rojo de contador (Duplicados) usa `T.danger` como background.
   - El divisor entre grupos es un `View` de 1 px en `T.border`, márgenes verticales 8 px.

5. **Reemplaza `apps/mobile/app/(tabs)/index.tsx`** (o `apps/mobile/app/index.tsx` según routing) con la pantalla del spec:
   - Para detectar plataforma y aplicar los pequeños divergencias (header), usa `Platform.OS`. **Una sola implementación** — el repo no necesita dos ficheros divergentes.
   - El header debe respetar: **iOS = título 22 / bold + bare `+` button**; **Android = título 20 / semibold + filled FAB primary**.
   - StatusBar: en iOS `<StatusBar style="dark" />` sin background; en Android `<StatusBar style="dark" backgroundColor="#FFFFFF" translucent={false} />`.
   - Wrap todo en `<SafeAreaView edges={["top", "bottom"]}>` de `react-native-safe-area-context`.
   - **Datos reales**: el endpoint `/api/properties` ya existe en el server. Crea un hook `useInmuebles()` (en `apps/mobile/hooks/useInmuebles.ts`) que haga `fetch` autenticado al backend (mira `apps/mobile/lib/` para ver el patrón de auth mobile que ya tienes). Con `useState` + `useEffect` basta — no instales SWR/Query si no estaban antes.

6. **Tokens compartidos**: el objeto `T` que aparece duplicado en los specs móvil — extráelo a `apps/mobile/constants/tokens.ts` y haz que ambos ficheros del repo lo importen desde ahí. Mantén la misma key list que el spec.

7. **Brand mark**: el spec usa un placeholder `<Text>⚿</Text>`. Crea el componente real en `apps/mobile/components/brand/IconKey.tsx` usando `react-native-svg` (instala `react-native-svg` si falta — viene por defecto en Expo). Porta el SVG de `src/components/brand/icons.tsx` (función `IconKey`) — son 4 paths, ~15 líneas.

## Tokens — cero invención

Toda la paleta y los radii salen de `src/app/globals.css` (CSS vars) y `tailwind.config.ts`. No introduzcas colores nuevos. Si necesitas un color para un caso de uso no cubierto, **pregunta** antes de improvisar.

## Convenciones del repo a respetar

- **Idioma**: español castellano (`lang="es"`), sentence case, sin emoji.
- **Inter** como tipografía (ya configurada vía `next/font/google` en web — para mobile usa `expo-font` con los `.woff2` de `/fonts/` que ya tenemos en el design system; o cae a la sans del sistema si bloquea).
- **`tabular-nums`** en todo lo que sea precio, m², %, contadores.
- **Lucide** como icon library — `lucide-react` en web, `lucide-react-native` en mobile. **No** uses `@expo/vector-icons` ni inventes SVGs.
- **`text-[xxpx]` arbitrary tailwind** en web está bien (el spec lo usa para 11/12/13) — no fuerces el `theme.fontSize` del config si no encaja.

## Criterio de aceptación

Visualmente, las 3 pantallas deben coincidir píxel-a-píxel con los 3 HTML que tengo en el design system (`screens/web-inmuebles.html`, `screens/mobile-android-inmuebles.html`, `screens/mobile-ios-inmuebles.html`). Estos HTML se pueden abrir y comparar lado-a-lado contra tu output. **Antes de cerrar, ejecuta:**

- Web: `npm run dev` → abre `localhost:4200/properties` con el sidebar nuevo visible.
- Mobile: `npm --workspace @buysell/mobile run start` → en Expo Go, abre Android e iOS, la pantalla Inmuebles debe renderizar idéntica a los specs.

## Lo que NO debes tocar

- El modelo Prisma (`prisma/schema.prisma`).
- Los adapters de scraping (`src/features/scraping/`).
- La integración Catastro (`src/features/cadastre/`).
- `next-auth` setup.

## Cuando termines

Genera un commit por plataforma:
1. `feat(web): vertical-tabs navigation + redesigned properties grid`
2. `feat(mobile): vertical rail navigation + properties list screen`
3. `chore(design): extract tokens to constants module`

Y pasa screenshots de las 3 pantallas a `docs/design/screens/`:
- `web-inmuebles-list.png`
- `mobile-android-inmuebles-list.png`
- `mobile-ios-inmuebles-list.png`
