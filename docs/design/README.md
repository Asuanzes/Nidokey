# Design — BuySell Asturias

Carpeta para todo lo relacionado con el diseño de la app (móvil y web).
Aquí viven mockups, flujos, tokens y notas. El código vive en `apps/mobile/`
y `src/`; aquí solo se documenta **qué** y **cómo se debe ver**.

## Identidad

- **Tagline visual**: "latón envejecido sobre acero"
- **Mark**: llave medieval (`IconKey`) sobre fondo cálido off-white
- **Tono**: sobrio, informacional, denso (es una herramienta de gestión, no un feed)
- **Idioma**: español (Asturias por defecto)

## Estructura

```
docs/design/
├── README.md          ← este fichero
├── tokens.json        ← colores, radii, sombras, tipografía (fuente de verdad)
├── flows/             ← descripciones narrativas de flujos (md)
│   └── (vacío, añade aquí cuando documentes flujos completos)
├── screens/           ← mockups de pantallas (PNG/JPG)
│   └── (vacío, suelta aquí las imágenes)
└── components/        ← mockups de componentes reutilizables
    └── (vacío)
```

## Convención de nombres de archivos

Pantallas:
```
screens/<plataforma>-<seccion>-<estado>.png

ejemplos:
  screens/mobile-inmuebles-list.png
  screens/mobile-inmuebles-empty.png
  screens/mobile-inmuebles-loading.png
  screens/mobile-ficha-detalle.png
  screens/mobile-ficha-detalle-galeria-fullscreen.png
  screens/mobile-login-phase-email.png
  screens/mobile-login-phase-otp.png
  screens/web-dashboard.png
```

Flujos (markdown con embed de imágenes):
```
flows/01-onboarding-mobile.md
flows/02-import-bookmarklet.md
flows/03-resolver-duplicado.md
```

## Estados obligatorios por pantalla

Para cada pantalla, documentar al menos estos estados cuando apliquen:

| Estado | ¿Cuándo? |
|---|---|
| `default` | Render normal con datos |
| `empty` | Sin datos (catalog vacío, sin matches, sin resultados) |
| `loading` | Mientras llega la primera carga |
| `error` | Fallo de red o API |
| `partial` | Datos cargados parcialmente (p.ej. sin phash, sin catastro) |

## Pantallas actuales del proyecto

### Móvil (`apps/mobile/app/`)
- `login.tsx` — 2 fases: email → código OTP
- `(tabs)/index.tsx` — **Inmuebles** (lista)
- `(tabs)/matches.tsx` — **Duplicados** (read-only por ahora)
- `(tabs)/search.tsx` — **Buscar** (search debounced)
- `(tabs)/account.tsx` — **Cuenta**
- `property/[id].tsx` — Ficha detalle con galería

### Web (`src/app/`)
- `/login` — magic-link
- `/dashboard` — KPIs y métricas
- `/properties` — catálogo con filtros
- `/properties/[id]` — ficha detalle
- `/matches` — duplicados
- `/activity` — feed de cambios
- `/bookmarklet` — onboarding del userscript

## Cómo trabajar con diseños aquí

1. **Sueltas la imagen** del mockup en `docs/design/screens/` con el nombre convenido
2. Si requiere contexto (flujo de varias pantallas, interacciones), creas un `.md` en `docs/design/flows/`
3. **Le dices a Claude Code**:
   > "Implementa `apps/mobile/app/(tabs)/settings.tsx` siguiendo `docs/design/screens/mobile-settings-default.png`. Tokens en `docs/design/tokens.json`. Convenciones de móvil en `CLAUDE.md` §8."
4. Claude Code lee imagen + tokens + convenciones y genera el código

## Reglas para mockups

- Las imágenes deben ser **PNG o JPG** (no PSD, no Sketch propietario)
- Tamaños recomendados:
  - Mobile iPhone 14/15: **393×852**
  - Tablet iPad: 820×1180
  - Web desktop: 1440×900
- Si exportas de Figma: 2x scale para nitidez (786×1704 px para móvil)
- Anota en la imagen o en un `.md` adjunto **qué es interactivo** y a dónde lleva
  (flechas, números de paso, etc.)

## Sincronización tokens ↔ código

- Si cambias `tokens.json`, hay que sincronizar a mano:
  - `src/app/globals.css` (web — CSS custom properties)
  - `tailwind.config.ts` (si añades algún alias)
  - `apps/mobile/**/*.tsx` (mobile — están en literales hex por screen, no hay tokens runtime aún)
- TODO futuro: extraer estos valores a `@buysell/shared/design-tokens` para que web y mobile lean del mismo sitio
