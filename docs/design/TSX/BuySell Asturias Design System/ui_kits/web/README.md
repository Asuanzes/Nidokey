# BuySell Asturias — Web UI Kit

A hi-fi recreation of the BuySell Asturias web app. Open `index.html` to interact with it.

## What's here

- **`index.html`** — entry point. Loads React 18 + Babel + the two JSX files below.
- **`components.jsx`** — all primitives and shell pieces: `IconKey`, `Button`, `Badge`, `StatusBadge`, `PriceDelta`, `Card` / `CardHeader` / `CardBody`, `Stat`, `PageHeader`, `Sidebar`, `Topbar`, `AppShell`, `PropertyCard`, `PropertyTable`, `FiltersSidebar`, `PriceHistoryChart`, plus a few hand-drawn Lucide-style icons.
- **`screens.jsx`** — the five screens wired through one stateful `<App>`:
  - **Dashboard** — KPIs, portal breakdown, €/m² per city, attention list
  - **Inmuebles** — table or grid view, sort + filters sidebar (live)
  - **Detail** — gallery placeholder, price-history chart, all property metadata
  - **Duplicados** — paired comparison cards with reason chips
  - **Actividad** — grouped timeline of price snapshots

## Click-through

The default route is **Inmuebles**. Click any property row → property detail. The "← Volver" button returns you. The Filtros panel updates results live; toggle the table/grid view from the toolbar.

## What's intentionally NOT here

- No backend — all data is in `PROPERTIES` at the top of `screens.jsx`.
- No property photos — the design system has no rights to fabricate them, so the gallery and thumbnails fall back to a calm warm-grey placeholder tile with an image glyph. In production, swap `PropertyImage`'s placeholder for the real `<img src={...}>`.
- No new-property form, no cadastre integration, no scraping controls — these exist in the source but are out of scope for a brand-fidelity kit.
