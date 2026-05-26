# Prompt — Claude.ai (Artifacts) para diseño de BuySell

> Pega este bloque en una conversación nueva de claude.ai con el repo
> `Asuanzes/BuySell` conectado (GitHub connector). El output esperado son
> Artifacts renderizables en React (Tailwind) con los 3 layouts.

---

## Contexto

Estoy diseñando **BuySell Asturias**: una herramienta de inteligencia
inmobiliaria de uso personal. Consolida anuncios de varios portales
españoles en un único catálogo del propietario, con histórico de precios,
deduplicación automática y enriquecimiento catastral.

El repo está conectado a esta conversación. Antes de diseñar, lee:

- `CLAUDE.md` — el brief completo (28 features, ADRs, convenciones)
- `docs/design/tokens.json` — design tokens (colores, radii, sombras, tipografía)
- `docs/design/README.md` — convenciones de diseño
- `src/app/globals.css` — CSS custom properties en uso
- `src/components/AppShell.tsx` — sidebar actual de la web (para ver el patrón ya implementado)
- `src/components/brand/icons.tsx` — iconos de marca (`IconKey`, `IconHorreo`, `IconPicos`)

## Identidad visual

- Tagline visual: **"latón envejecido sobre acero"**
- Master mark: **llave medieval** (IconKey)
- Tono: **sobrio, informacional, denso** — es una herramienta de gestión personal, no un feed social
- Idioma: español
- Inter como tipografía base (13px body, tabular nums en precios)

## Lo que quiero diseñar

Pantallas principales en **3 plataformas**:

1. **Web** (escritorio, 1440×900)
2. **Android** (phone, 393×852 equivalente Pixel 7)
3. **iOS** (phone, 393×852 equivalente iPhone 14/15)

## Navegación pedida: vertical tabs (sidebar) en TODAS las plataformas

Inspiración: **Chrome Vertical Tabs** (imagen adjunta) — sidebar con grupos
colapsables, cada grupo es una categoría coloreada, cada ítem un enlace con
icono + label.

### Adaptaciones por plataforma

**Web (escritorio)**:
- Sidebar izquierda de ~240px, similar a la imagen de referencia pero más
  minimalista (sin bordes redondeados grandes, sin colores tan saturados en
  los headers — más cercano a la estética sobria de los tokens)
- Grupos colapsables con header en `text-muted` (#6B6862) y línea separadora
- Contenido principal a la derecha

**Móvil (Android + iOS) — REQUERIMIENTO DEL USUARIO**:
- **Vertical tabs en lado izquierdo** (overlay tipo drawer o sidebar fijo ~80–100px)
- Solo **icono visible** (sin texto, o texto muy pequeño debajo) — minimalismo
- Contenido principal ocupa el resto
- El icono debe **representar visualmente la información** del enlace

> ⚠️ **Antes de implementar tal cual, evalúa la decisión y dame tu lectura
> profesional**: en mobile lo estándar es bottom tabs (alcance del pulgar).
> Sidebar vertical en mobile funciona en tablet o en phone landscape, pero en
> portrait reduce el área de contenido y es menos ergonómico. Posibles
> compromisos: (a) drawer que se abre con gesto desde izquierda, (b) rail
> estrecho de ~64px siempre visible solo con iconos, (c) bottom tabs + un
> botón "más" que abre drawer con secciones secundarias. Propón la mejor
> opción argumentada — pero si tras el análisis sigue siendo viable el
> sidebar fijo, hazlo así porque es la preferencia del usuario.

## Secciones a representar

El sistema de navegación debe contener (mínimo) estas entradas, agrupadas:

### Grupo "Catálogo"
- **Inmuebles** — icono: casa o tag (lista de propiedades guardadas)
- **Buscar** — icono: lupa
- **Duplicados** — icono: capas o chispa (sugerencias de fusión)

### Grupo "Análisis"
- **Dashboard** — icono: gráfico o panel (KPIs)
- **Actividad** — icono: pulso o reloj (cambios recientes de precio)

### Grupo "Captura"
- **Importar** — icono: download o flecha-abajo (instrucciones bookmarklet/userscript)

### Grupo "Cuenta"
- **Perfil** — icono: persona
- **Ajustes** — icono: engranaje
- **Cerrar sesión** — icono: log-out (solo en footer del sidebar)

Cada grupo debe llevar **un color discreto** (no saturado como el ejemplo
Chrome, más bien una variante suave del primary o un gris neutro). Usa los
tokens `--primary-soft`, `--surface-muted`, `--surface-sunken` como base.

## Pantalla representativa por plataforma

Para cada plataforma, diseña la pantalla **"Inmuebles" (lista de propiedades)**
con datos mock:

- Header: título "Inmuebles" + contador "23 fichas"
- Lista de cards de propiedades:
  - Foto (16:10 aspect)
  - Badge de status (En venta / Reservado / Vendido / Retirado)
  - Título (max 2 líneas)
  - Tipo · barrio · ciudad
  - Precio en grande con tabular numerics (€ format es-ES)
  - Características: habitaciones · baños · m² construidos
  - (Opcional) badge "N duplicados" si tiene matches pendientes

Datos mock (usa estos para que se vea realista):
1. "Piso luminoso en La Manjoya con vistas" · Piso · La Manjoya, Oviedo · 195.000 € · 3 hab · 2 baños · 95 m²
2. "Chalet pareado con jardín y garaje" · Chalet · Cabueñes, Gijón · 385.000 € · 4 hab · 3 baños · 180 m²
3. "Ático con terraza en el centro" · Ático · Centro, Avilés · 165.000 € · 2 hab · 1 baño · 72 m²
4. "Estudio reformado cerca de la playa" · Estudio · San Lorenzo, Gijón · 89.000 € · 0 hab · 1 baño · 35 m²

## Entrega esperada

Genera **3 Artifacts React** (TSX + Tailwind utility classes), uno por
plataforma, autocontenidos y renderizables en el preview de Artifacts:

1. `web-inmuebles.tsx` — viewport 1440×900, sidebar + contenido
2. `mobile-android-inmuebles.tsx` — viewport 393×852, status bar Android style
3. `mobile-ios-inmuebles.tsx` — viewport 393×852, status bar iOS style con notch

Los 3 deben:
- Usar **exactamente los colores de `tokens.json`** (no inventar paleta nueva)
- Usar Inter como fuente
- Aplicar `font-variant-numeric: tabular-nums` en precios
- Datos hardcodeados con los mocks de arriba
- Sin dependencias externas más allá de React + Tailwind (preview de Artifacts)
- Lucide-react icons (ya disponible en preview) — propón qué icono concreto
  para cada entrada de nav

## Iteración

Tras la primera versión, espero **una pregunta tuya por plataforma** sobre:
- Spacing / densidad
- Tamaño de iconos del sidebar móvil
- Comportamiento del drawer (si propones drawer)
- Cualquier ambigüedad que detectes

No me sirvas todo perfecto a la primera — quiero iterar contigo. Empieza con
los Artifacts y luego me preguntas.

## Cuando estén aprobados

Cuando los 3 mockups estén OK, hacemos screenshots y los guardamos en
`docs/design/screens/` con los nombres:

- `web-inmuebles-list.png`
- `mobile-android-inmuebles-list.png`
- `mobile-ios-inmuebles-list.png`

Después esos PNGs + el código React del Artifact se pasan a **Claude Code en
VS Code** para que implemente el .tsx real en:

- `src/app/properties/page.tsx` (web — ya existe, hay que adaptarlo)
- `apps/mobile/app/(tabs)/index.tsx` (mobile — ya existe, hay que adaptarlo)

Y para el nuevo patrón de navegación vertical en móvil, posiblemente:

- `apps/mobile/app/_layout.tsx` (cambiar Tabs por Drawer/Sidebar custom)

---

**Empieza confirmando que has leído `CLAUDE.md`, `tokens.json` y los ficheros
listados arriba. Dame en 3-4 frases tu lectura del proyecto y de la decisión
de vertical tabs en mobile. Luego procedes con los Artifacts.**
