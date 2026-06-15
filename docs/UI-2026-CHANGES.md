# UI 2026 — cambios de interfaz (diseño normativo)

> **Flag de sesión: «ui-2026»**. Estado: DISEÑO CERRADO (2026-06-15). Implementa **Codex**.
> Base: `main` con el rediseño 2100 ya fusionado (merge `eabe337`). Todo es **JS → OTA**,
> sin recompilar nativo. **NO romper** vintage ni el 2100 actual; defaults = aspecto actual.

## Principios (NO romper)
- Reutilizar patrones existentes; no añadir librerías nativas (slider = JS con
  `react-native-gesture-handler` + `react-native-reanimated`, ya presentes).
- **Defaults conservadores**: color neón por defecto = el magenta actual; intensidad por
  defecto = la actual → con todo por defecto, la app se ve EXACTAMENTE igual que ahora.
- Tipos estrictos: `tsc --noEmit -p apps/mobile/tsconfig.json` = 0 antes de cada commit.
- Trabajar en rama `feat/ui-2026`. Backend (onboarding) con `prisma db push` (Neon, aditivo).

---

## Punto 1 — Fondo del chat: YA HECHO
Los wallpapers estáticos antiguos se retiraron en `cc6dc23`. El chat (lista) muestra el
fondo dinámico (`<Screen background>` → `ScreenBackground`). **Decisión del usuario: mantener
el dinámico.** ⇒ **Sin cambios.** (No reintroducir `home-bg`/`WallpaperSheet`.)

---

## Punto 2 — Botón "+" (Importar) rosa neón en oscuro
Archivo: `apps/mobile/app/(tabs)/_layout.tsx` (FAB central, ~líneas 108-130; `fabBg = is2100 ? th.primary : FAB_BG`).
- Con el **Punto 4** (acento global 2100), `th.primary` en 2100 = color neón elegido (default rosa)
  → el "+" ya toma el color. **Añadir glow** al FAB en **2100 oscuro**: sombra del color
  (`shadowColor: fabBg`, opacidad/radio escalados por la **intensidad** del Punto 4), como hace `NeonIcon`.
- Vintage se queda como está (sin neón). El "+" no cambia en vintage.

---

## Punto 3 — Sección "Tema" en Ajustes
Crear pantalla **`apps/mobile/app/theme-settings.tsx`** (patrón de `app/category-settings.tsx`):
agrupa **Apariencia** (claro/oscuro/auto), **Estilo** (vintage/2100) y —cuando estilo=2100—
**Color neón** (Punto 4) + **Intensidad del neón** (Punto 4).
- En `apps/mobile/app/(tabs)/account.tsx`: **quitar** las secciones inline "Apariencia"
  (líneas ~55-67) y "Estilo de la app" (~69-81) y dejar **un único enlace "Tema"**
  (igual que el enlace a Categorías), que navega a `/theme-settings`.
- Registrar `theme-settings` como `Stack.Screen` en `_layout.tsx` (con header, título `t("account.theme")`).
- Componentes reutilizables (los usa también el Onboarding, Punto 6):
  `ThemeModeSelector`, `StyleSelector`, `NeonAccentPicker`, `NeonIntensitySlider`
  (en `apps/mobile/components/theme/`).
- i18n: `account.theme` = "Tema"; `theme.appearance`, `theme.style`, `theme.neon_color`,
  `theme.neon_intensity`, etc.

---

## Punto 4 — Color neón configurable (8) + intensidad (acento GLOBAL 2100)
**Contexto nuevo** `apps/mobile/lib/neon-context.tsx` (patrón de `app-style-context.tsx`):
```ts
type NeonAccentId = "rosa"|"azul"|"verde"|"rojo"|"bronce"|"cian"|"violeta"|"ambar";
type NeonCtx = {
  accent: NeonAccentId;      // default "rosa"
  setAccent(id: NeonAccentId): void;
  intensity: number;          // 0..1, default 0.6
  setIntensity(v: number): void;
};
```
Persistir en SecureStore: `nidokey.neon.accent`, `nidokey.neon.intensity`. Provider bajo
`AppStyleProvider` en `_layout.tsx`.

**Paleta (8) — cada una con primary/dark + soft):** definir en `lib/neon-accents.ts`.
`rosa` = el magenta ACTUAL (default, no cambia nada): `{ light:"#D44D7C", dark:"#F26D9A" }`.
Otros (light/dark): `azul` (metálico) `#3E6BB0`/`#5B8FD6`, `verde` `#2E9E6B`/`#46C98C`,
`rojo` `#D24B4B`/`#F26D6D`, `bronce` `#B5803A`/`#D9A85A`, `cian` `#1F9BB0`/`#45C7DD`,
`violeta` `#8A4FC2`/`#B07FE6`, `ambar` `#E07B2E`/`#F2A24D`. Las variantes "soft"
(`primarySoft`/`accentSoft`) se derivan mezclando el color con `bg` (helper `mixHex`, como
`ScreenBackground`), p.ej. ~12-16% sobre el fondo.

**Aplicación GLOBAL en 2100** (decisión del usuario): en `ThemedShell` (`_layout.tsx`), cuando
`appStyle==="2100"`, partir de `T2100/TD2100` y **sobrescribir** `primary`, `primaryFg`,
`primarySoft`, `accent`, `accentSoft` con los del acento neón elegido:
```ts
const base = appStyle === "2100" ? (dark ? TD2100 : T2100) : (dark ? TD : T);
const th = appStyle === "2100" ? applyNeonAccent(base, accent, dark) : base;
```
Así todo el cromo 2100 (botones, chips, énfasis, tabs, FAB, fondos que usan `th.primary`)
toma el color elegido. Vintage NO se toca. `applyNeonAccent` en `lib/neon-accents.ts`.

**Intensidad** → escala el neón (solo visible en oscuro): `NeonIcon` consume
`useNeon().intensity` y multiplica `shadowOpacity`, `shadowRadius`, `haloOpacity` y la opacidad
de las capas de glow. Mismo factor para el glow del FAB (Punto 2). Con intensidad por defecto
(0.6) el resultado ≈ actual; rango sugerido 0.2–1.0.

**Slider OTA-safe**: `NeonIntensitySlider` con `react-native-gesture-handler` +
`reanimated` (NADA de `@react-native-community/slider`, que es nativo). Si resulta complejo,
fallback a 4 niveles (Bajo/Medio/Alto/Máx) con `Chip`.

---

## Punto 5 — Resaltado de tabs en 2100 claro (como categorías)
Archivo: `apps/mobile/app/(tabs)/_layout.tsx`. Hoy en 2100 el tab activo usa `NeonIcon framed=true`
→ pastilla `accentSoft` (en 2100 claro se ve como un cuadrado feo). El rail de categorías
(`(tabs)/index.tsx` railItem activo) usa: `borderColor: accent` + `backgroundColor: accentSoft`
+ `borderRadius: 16`.
- **Fix:** en 2100, envolver el icono del tab en un contenedor con el **mismo estilo del railItem**
  (borde `th.accent` + fondo `th.accentSoft` + `borderRadius` ~14-16) cuando está activo, y pasar
  `framed={false}` a `NeonIcon` (que no dibuje su pastilla). El **glow** del icono se mantiene
  (visible en oscuro). Así el resaltado del tab = el de las categorías, en claro y oscuro.
- No tocar vintage (ya usa borde+accentSoft correcto).

---

## Punto 6 — Onboarding de nuevos usuarios
**Backend** (`src/`):
- Prisma `User`: añadir `onboardingCompletedAt DateTime?` (`prisma db push`, aditivo).
- `src/app/api/auth/mobile/verify/route.ts`: devolver en `user` también `username` y un flag
  `needsOnboarding: boolean` (= `onboardingCompletedAt == null`).
- `src/app/api/account/route.ts` (PATCH ya existe para name/username): aceptar opcional
  `onboardingCompleted?: boolean` → set `onboardingCompletedAt = now()`. (Validación Zod;
  `requireUserId`; formas de error estándar.)

**Móvil** (`apps/mobile/`):
- `lib/auth-context.tsx`: extender `User` con `username: string|null` y `needsOnboarding: boolean`;
  `lib/api.ts authVerifyOtp` devolver ambos.
- Nueva pantalla **`app/onboarding.tsx`** (stack screen, sin header, multi-paso):
  a. **Nombre de usuario** (alias público chat): reutiliza validación + `PATCH /api/account`
     (`name`+`username`) y `GET /api/account/username-available` (ya existen).
  b. **Categorías activas**: reutiliza `useCategoryPrefs()` (`toggleHidden`, `setStartCategory`).
  c. **Tema**: reutiliza `StyleSelector` + `ThemeModeSelector` (+ `NeonAccentPicker` si 2100) del Punto 3.
  d. **Idioma**: reutiliza `LanguageSelector` / `useLanguage().setLanguage`.
  Al terminar: `PATCH /api/account { onboardingCompleted:true }` + flag local SecureStore
  `nidokey.onboarding.done` (doble seguro) → `router.replace("/(tabs)")`.
- `app/_layout.tsx` (AuthGate, ~líneas 199-212): si `authed` && `needsOnboarding` (o falta el
  flag local) && ruta ≠ `/onboarding` → `router.replace("/onboarding")`. Si completado y en
  `/onboarding` → `/(tabs)`. Registrar `onboarding` como `Stack.Screen` (headerShown:false).
- i18n: bloque `onboarding.*` (ES fuente + EN).

---

## Verificación
`tsc --noEmit -p apps/mobile/tsconfig.json` = 0. Probar: defaults → app idéntica a ahora;
cambiar color neón → cromo 2100 cambia; intensidad → glow sube/baja en oscuro; tab activo en
2100 claro = estilo categorías; "+" con glow en 2100 oscuro; nuevo usuario → onboarding;
usuario existente → directo a la app. No romper Android ni vintage.
