/* global React */
/* eslint-disable react/prop-types */

// ============================================================
// Tokens — mirrors colors_and_type.css. Kept in JS for components
// that need to compute colors inline (charts, conditional pills).
// ============================================================

const T = {
  bg: "#FAFAF7",
  surface: "#FFFFFF",
  surfaceMuted: "#F4F3EE",
  surfaceSunken: "#EFEEE8",
  border: "#E8E6E1",
  borderStrong: "#D4D1CA",
  text: "#1A1A18",
  textMuted: "#6B6862",
  textSubtle: "#9A9690",
  primary: "#3A5F8A",
  primaryHover: "#2E4D70",
  primarySoft: "#EAEFF6",
  brassAccent: "#C49A4D",
  success: "#2D6A4F",
  successSoft: "#E8F1EC",
  warning: "#A86A17",
  warningSoft: "#F7EFDE",
  danger: "#A23E3E",
  dangerSoft: "#F6E5E5",
  info: "#2C7A8A",
  infoSoft: "#E1EEF1",
  priceUpBg: "#FDF2F2",
  priceUpFg: "#A23E3E",
  priceDownBg: "#F0F7F2",
  priceDownFg: "#2D6A4F",
};

// ============================================================
// Brand mark — the BuySell forged-key icon
// ============================================================

function IconKey({ size = 24, color = "currentColor", brass = T.brassAccent }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6.5" cy="12" r="3.3" />
      <circle cx="6.5" cy="8" r="0.85" fill={brass} stroke="none" />
      <path d="M9.8 12 H17" />
      <path d="M17 12 H21 V17 H20 V15.5 H18.5 V17 H17 Z" fill={brass} />
    </svg>
  );
}

// ============================================================
// Tiny Lucide-style icons — only what the kit needs
// ============================================================

const SI = (paths, viewBox = "0 0 24 24") => ({ size = 16, color = "currentColor", style }) => (
  <svg width={size} height={size} viewBox={viewBox} fill="none" stroke={color}
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>
    {paths}
  </svg>
);

const IconDashboard = SI(<>
  <rect x="3" y="3" width="7" height="9" rx="1"/>
  <rect x="14" y="3" width="7" height="5" rx="1"/>
  <rect x="14" y="12" width="7" height="9" rx="1"/>
  <rect x="3" y="16" width="7" height="5" rx="1"/>
</>);
const IconBuildings = SI(<>
  <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
  <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
  <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
  <path d="M10 6h4M10 10h4M10 14h4M10 18h4"/>
</>);
const IconSparkles = SI(<>
  <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z"/>
  <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z"/>
</>);
const IconActivity = SI(<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>);
const IconSearches = SI(<>
  <rect x="3" y="3" width="7" height="7" rx="1"/>
  <rect x="14" y="3" width="7" height="7" rx="1"/>
  <rect x="3" y="14" width="7" height="7" rx="1"/>
  <rect x="14" y="14" width="7" height="7" rx="1"/>
</>);
const IconSettings = SI(<>
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
</>);
const IconPlus = SI(<><path d="M5 12h14M12 5v14"/></>);
const IconSearch = SI(<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>);
const IconPin = SI(<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>);
const IconBed = SI(<><path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/></>);
const IconBath = SI(<><path d="M9 6 6 3M19 13v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3"/><path d="M3 13h18"/></>);
const IconArea = SI(<><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>);
const IconUp = SI(<><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>);
const IconDown = SI(<><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>);
const IconMinus = SI(<line x1="5" y1="12" x2="19" y2="12"/>);
const IconBack = SI(<polyline points="15 18 9 12 15 6"/>);
const IconEdit = SI(<><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></>);
const IconExt = SI(<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>);
const IconCalendar = SI(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>);
const IconRefresh = SI(<><path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8.9 6.5 2.5L21 8"/><polyline points="21 3 21 8 16 8"/></>);
const IconAlert = SI(<><path d="m10.29 3.86-8.37 14.5A2 2 0 0 0 3.66 21h16.68a2 2 0 0 0 1.74-2.64l-8.37-14.5a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>);
const IconImage = SI(<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.83 0L6 21"/></>);
const IconFireplace = SI(<><path d="M12 2c2 3 4 5 4 8a4 4 0 1 1-8 0c0-3 2-5 4-8z"/></>);
const IconGarage = SI(<><path d="M3 12 12 3l9 9"/><path d="M5 12v8h14v-8"/><path d="M9 16h6"/></>);
const IconTerrace = SI(<><path d="M12 22V12"/><path d="M5 10a7 7 0 0 1 14 0H5z"/><path d="M3 22h18"/></>);

const NAV_ICON = {
  dashboard: IconDashboard, properties: IconBuildings, matches: IconSparkles,
  activity: IconActivity, searches: IconSearches, settings: IconSettings,
};

// ============================================================
// Primitives
// ============================================================

function Button({ variant = "secondary", size = "md", children, onClick, disabled }) {
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 6, fontWeight: 500, cursor: "pointer", userSelect: "none",
    transition: "background-color 100ms, color 100ms, opacity 100ms",
    fontFamily: "inherit", border: "1px solid transparent",
    opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto",
  };
  const sz = size === "sm"
    ? { height: 28, padding: "0 10px", fontSize: 12 }
    : { height: 36, padding: "0 14px", fontSize: 13 };
  const variants = {
    primary:   { background: T.primary, color: "#FAFAF7" },
    secondary: { background: T.surface, color: T.text, borderColor: T.border },
    ghost:     { background: "transparent", color: T.text },
    danger:    { background: T.danger, color: "#FAFAF7" },
  };
  const [hover, setHover] = React.useState(false);
  const hoverStyles = {
    primary:   { background: T.primaryHover },
    secondary: { background: T.surfaceMuted },
    ghost:     { background: T.surfaceMuted },
    danger:    { opacity: 0.9 },
  };
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{...base, ...sz, ...variants[variant], ...(hover && !disabled ? hoverStyles[variant] : {})}}>
      {children}
    </button>
  );
}

function Badge({ tone = "neutral", dot = false, children, icon }) {
  const tones = {
    neutral: { bg: T.surfaceMuted, fg: T.textMuted, border: T.border },
    primary: { bg: T.primarySoft, fg: T.primary, border: "rgba(58,95,138,0.15)" },
    success: { bg: T.successSoft, fg: T.success, border: "rgba(45,106,79,0.15)" },
    warning: { bg: T.warningSoft, fg: T.warning, border: "rgba(168,106,23,0.20)" },
    danger:  { bg: T.dangerSoft,  fg: T.danger,  border: "rgba(162,62,62,0.15)" },
    info:    { bg: T.infoSoft,    fg: T.info,    border: "rgba(44,122,138,0.15)" },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: t.bg, color: t.fg, border: `1px solid ${t.border}`,
      padding: "2px 6px", borderRadius: 6, fontSize: 12, fontWeight: 500,
    }}>
      {dot && <span style={{width:6, height:6, borderRadius:999, background:"currentColor", opacity:0.7}}/>}
      {icon}
      {children}
    </span>
  );
}

const STATUS_MAP = {
  FOR_SALE:   { tone: "info",    label: "En venta" },
  RESERVED:   { tone: "warning", label: "Reservado" },
  SOLD:       { tone: "success", label: "Vendido" },
  WITHDRAWN:  { tone: "neutral", label: "Retirado" },
  PRICE_DROP: { tone: "success", label: "Bajada de precio" },
  PRICE_UP:   { tone: "danger",  label: "Subida de precio" },
};

function StatusBadge({ status }) {
  const cfg = STATUS_MAP[status] ?? { tone: "neutral", label: status };
  return <Badge tone={cfg.tone} dot>{cfg.label}</Badge>;
}

function PriceDelta({ from, to, size = "sm", showAbsolute = false }) {
  if (from == null || to == null || from === 0) {
    return <span style={{color: T.textSubtle, fontSize: size === "sm" ? 12 : 13}}>—</span>;
  }
  const diff = to - from;
  const pct = (diff / from) * 100;
  const dir = diff === 0 ? "flat" : diff > 0 ? "up" : "down";
  const palette = dir === "up"
    ? { bg: T.priceUpBg, fg: T.priceUpFg }
    : dir === "down"
    ? { bg: T.priceDownBg, fg: T.priceDownFg }
    : { bg: T.surfaceMuted, fg: T.textMuted };
  const Icon = dir === "up" ? IconUp : dir === "down" ? IconDown : IconMinus;
  const abs = Math.abs(diff);
  const fmt = abs.toLocaleString("es-ES") + " €";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: palette.bg, color: palette.fg,
      padding: size === "sm" ? "2px 6px" : "4px 8px",
      borderRadius: 6, fontSize: size === "sm" ? 12 : 13,
      fontWeight: 500, fontVariantNumeric: "tabular-nums",
    }}>
      <Icon size={size === "sm" ? 11 : 13} />
      {Math.abs(pct).toFixed(1)}%
      {showAbsolute && <span style={{opacity: 0.7, marginLeft: 4}}>· {fmt}</span>}
    </span>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 8, boxShadow: "0 1px 2px rgba(20,20,18,0.04)",
      overflow: "hidden", ...style,
    }}>{children}</div>
  );
}

function CardHeader({ title, meta, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "14px 20px", borderBottom: `1px solid ${T.border}`,
    }}>
      <h3 style={{margin: 0, fontSize: 13, fontWeight: 600, color: T.text}}>{title}</h3>
      {meta || children}
    </div>
  );
}

function CardBody({ children, style }) {
  return <div style={{padding: 20, fontSize: 13, color: T.text, ...style}}>{children}</div>;
}

function Stat({ label, value, hint }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 8, boxShadow: "0 1px 2px rgba(20,20,18,0.04)",
      padding: 16,
    }}>
      <div style={{fontSize: 11, fontWeight: 500, textTransform: "uppercase",
                   letterSpacing: "0.04em", color: T.textSubtle}}>{label}</div>
      <div style={{marginTop: 6, fontSize: 24, fontWeight: 600, letterSpacing: "-0.015em",
                   color: T.text, fontVariantNumeric: "tabular-nums"}}>{value}</div>
      {hint && <div style={{marginTop: 4, fontSize: 11, color: T.textMuted}}>{hint}</div>}
    </div>
  );
}

function PageHeader({ title, description, actions }) {
  return (
    <div style={{display: "flex", alignItems: "flex-start", justifyContent: "space-between",
                  gap: 16, paddingBottom: 24}}>
      <div>
        <h1 style={{margin: 0, fontSize: 24, lineHeight: "32px", fontWeight: 600,
                    letterSpacing: "-0.015em", color: T.text}}>{title}</h1>
        {description && (
          <p style={{margin: "4px 0 0", fontSize: 13, color: T.textMuted}}>{description}</p>
        )}
      </div>
      {actions && <div style={{display: "flex", gap: 8}}>{actions}</div>}
    </div>
  );
}

// ============================================================
// App shell — sidebar + topbar
// ============================================================

function Sidebar({ current, onNavigate }) {
  const items = [
    { id: "dashboard", label: "Dashboard" },
    { id: "properties", label: "Inmuebles" },
    { id: "matches", label: "Duplicados" },
    { id: "activity", label: "Actividad" },
    { id: "searches", label: "Búsquedas", disabled: true },
  ];
  return (
    <aside style={{
      width: 224, flexShrink: 0, display: "flex", flexDirection: "column",
      borderRight: `1px solid ${T.border}`, background: T.surface,
    }}>
      <div style={{
        height: 56, display: "flex", alignItems: "center", gap: 8,
        borderBottom: `1px solid ${T.border}`, padding: "0 16px",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 6, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: T.primarySoft, color: T.primary,
          boxShadow: "inset 0 0 0 1px rgba(58,95,138,0.15)",
        }}>
          <IconKey size={20} />
        </div>
        <div style={{lineHeight: 1.1}}>
          <div style={{fontSize: 13, fontWeight: 600, color: T.text}}>BuySell</div>
          <div style={{fontSize: 11, color: T.textSubtle}}>Asturias</div>
        </div>
      </div>
      <nav style={{flex: 1, padding: "12px 8px"}}>
        {items.map(it => {
          const Icon = NAV_ICON[it.id];
          const active = current === it.id;
          return (
            <button key={it.id}
              onClick={() => !it.disabled && onNavigate?.(it.id)}
              disabled={it.disabled}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "6px 10px", marginBottom: 2,
                borderRadius: 6, border: 0, cursor: it.disabled ? "not-allowed" : "pointer",
                background: active ? T.primarySoft : "transparent",
                color: active ? T.primary : T.textMuted,
                fontWeight: active ? 500 : 400, fontSize: 13, textAlign: "left",
                opacity: it.disabled ? 0.5 : 1,
                fontFamily: "inherit",
              }}>
              <Icon size={15} color={active ? T.primary : T.textSubtle}/>
              {it.label}
            </button>
          );
        })}
      </nav>
      <div style={{borderTop: `1px solid ${T.border}`, padding: 8}}>
        <button style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          padding: "6px 10px", borderRadius: 6, border: 0, background: "transparent",
          color: T.textMuted, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
        }}>
          <IconSettings size={15} color={T.textSubtle}/> Ajustes
        </button>
      </div>
    </aside>
  );
}

function Topbar({ onNewProperty, searchValue, onSearchChange }) {
  return (
    <header style={{
      height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 16, borderBottom: `1px solid ${T.border}`, background: T.surface,
      padding: "0 24px",
    }}>
      <div style={{position: "relative", width: "100%", maxWidth: 448}}>
        <IconSearch size={14} color={T.textSubtle}
          style={{position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)"}}/>
        <input type="search" value={searchValue ?? ""} onChange={onSearchChange}
          placeholder="Buscar inmuebles, direcciones, refs..."
          style={{
            height: 36, width: "100%", paddingLeft: 32, paddingRight: 12,
            border: `1px solid ${T.border}`, borderRadius: 6,
            background: T.bg, color: T.text, fontSize: 13,
            fontFamily: "inherit", outline: "none",
          }}/>
      </div>
      <Button variant="primary" onClick={onNewProperty}>
        <IconPlus size={14}/> Nuevo inmueble
      </Button>
    </header>
  );
}

function AppShell({ current, onNavigate, children, onNewProperty }) {
  return (
    <div style={{display: "flex", minHeight: "100vh", background: T.bg}}>
      <Sidebar current={current} onNavigate={onNavigate}/>
      <div style={{display: "flex", flexDirection: "column", flex: 1, minWidth: 0}}>
        <Topbar onNewProperty={onNewProperty}/>
        <main style={{flex: 1, padding: "32px 24px", minWidth: 0}}>{children}</main>
      </div>
    </div>
  );
}

// ============================================================
// Domain: PropertyCard, PropertyTable, FiltersSidebar, Chart
// ============================================================

function PropertyImage({ photo, alt = "", style }) {
  if (photo) {
    return <img src={photo} alt={alt} referrerPolicy="no-referrer"
      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }}/>;
  }
  // Placeholder — sober warm-grey tile with a hint of a roof glyph
  return (
    <div style={{
      width: "100%", height: "100%", background: T.surfaceMuted,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: T.textSubtle, ...style,
    }}>
      <IconImage size={24}/>
    </div>
  );
}

function PropertyCard({ p, onClick }) {
  const prev = p.priceHistory?.length >= 2 ? p.priceHistory.at(-2).price : null;
  const last = p.priceHistory?.length >= 1 ? p.priceHistory.at(-1).price : p.currentPrice;
  const [hover, setHover] = React.useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: "relative", overflow: "hidden",
        borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface,
        boxShadow: hover
          ? "0 1px 3px rgba(20,20,18,0.06), 0 1px 2px rgba(20,20,18,0.04)"
          : "0 1px 2px rgba(20,20,18,0.04)",
        cursor: "pointer", transition: "box-shadow 100ms",
      }}>
      <div style={{position: "relative", aspectRatio: "4/3", background: T.surfaceMuted}}>
        <PropertyImage photo={p.photo} alt={p.title}/>
        <div style={{position: "absolute", top: 12, left: 12}}>
          <StatusBadge status={p.status}/>
        </div>
      </div>
      <div style={{padding: 16}}>
        <h3 style={{margin: 0, fontSize: 13, fontWeight: 600, color: T.text,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>
          {p.title}
        </h3>
        <div style={{display: "flex", alignItems: "center", gap: 4, marginTop: 8,
                     fontSize: 12, color: T.textMuted}}>
          <IconPin size={11}/> {p.neighborhood ? `${p.neighborhood}, ${p.city}` : p.city}
        </div>
        <div style={{display: "flex", alignItems: "baseline", justifyContent: "space-between", marginTop: 8}}>
          <div style={{fontSize: 16, fontWeight: 600, color: T.text, fontVariantNumeric: "tabular-nums"}}>
            {formatPrice(p.currentPrice)}
          </div>
          <PriceDelta from={prev} to={last}/>
        </div>
        <div style={{display: "flex", alignItems: "center", gap: 12, marginTop: 10, paddingTop: 10,
                     borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.textMuted}}>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}><IconBed size={12}/>{p.rooms ?? "—"}</span>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}><IconBath size={12}/>{p.bathrooms ?? "—"}</span>
          <span style={{display:"inline-flex", alignItems:"center", gap:4}}><IconArea size={12}/>{p.builtArea ?? "—"} m²</span>
        </div>
      </div>
    </div>
  );
}

function PropertyTable({ rows, onRowClick }) {
  return (
    <div style={{
      border: `1px solid ${T.border}`, borderRadius: 8, background: T.surface,
      overflow: "hidden", boxShadow: "0 1px 2px rgba(20,20,18,0.04)",
    }}>
      <table style={{width: "100%", borderCollapse: "collapse", fontSize: 13}}>
        <thead style={{background: "rgba(244,243,238,0.6)"}}>
          <tr>
            <th style={th(20)}>Inmueble</th>
            <th style={th()}>Tipo</th>
            <th style={th()}>Estado</th>
            <th style={{...th(), textAlign: "right"}}>Precio</th>
            <th style={{...th(), textAlign: "right"}}>Δ</th>
            <th style={{...th(), textAlign: "right"}}>Hab.</th>
            <th style={{...th(20, "right"), textAlign: "right"}}>m²</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const prev = r.priceHistory?.length >= 2 ? r.priceHistory.at(-2).price : null;
            const last = r.priceHistory?.length >= 1 ? r.priceHistory.at(-1).price : r.currentPrice;
            return (
              <tr key={r.id} onClick={() => onRowClick?.(r)}
                style={{borderBottom: i === rows.length - 1 ? 0 : `1px solid ${T.border}`,
                        cursor: "pointer"}}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(244,243,238,0.4)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <td style={td(20)}>
                  <div style={{display:"flex", alignItems:"center", gap:12}}>
                    <div style={{width: 56, height: 40, borderRadius: 6, overflow: "hidden",
                                 border: `1px solid ${T.border}`}}>
                      <PropertyImage photo={r.photo}/>
                    </div>
                    <div style={{minWidth: 0}}>
                      <div style={{fontWeight: 500, color: T.text, fontSize: 13,
                                   whiteSpace: "nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>
                        {r.title}
                      </div>
                      <div style={{display:"inline-flex", alignItems:"center", gap:4, marginTop: 2,
                                   fontSize: 12, color: T.textMuted}}>
                        <IconPin size={11}/>{r.neighborhood ? `${r.neighborhood}, ${r.city}` : r.city}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{...td(), color: T.textMuted}}>{TYPE_LABEL[r.type] ?? r.type}</td>
                <td style={td()}><StatusBadge status={r.status}/></td>
                <td style={{...td(), textAlign: "right", fontWeight: 600,
                            fontVariantNumeric: "tabular-nums"}}>{formatPrice(r.currentPrice)}</td>
                <td style={{...td(), textAlign: "right"}}><PriceDelta from={prev} to={last}/></td>
                <td style={{...td(), textAlign: "right", color: T.textMuted,
                            fontVariantNumeric: "tabular-nums"}}>
                  <span style={{display:"inline-flex", alignItems:"center", gap:4}}>
                    <IconBed size={11}/>{r.rooms ?? "—"}
                  </span>
                </td>
                <td style={{...td(20, "right"), textAlign: "right", color: T.textMuted,
                            fontVariantNumeric: "tabular-nums"}}>{r.builtArea ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function th(pad = 12, side = "left") {
  const r = {
    padding: `8px 12px`, textAlign: "left", fontSize: 12, fontWeight: 500,
    color: T.textMuted, borderBottom: `1px solid ${T.border}`,
  };
  if (side === "left") r.paddingLeft = pad;
  if (side === "right") r.paddingRight = pad;
  return r;
}
function td(pad = 12, side = "left") {
  const r = { padding: `12px`, color: T.text, verticalAlign: "middle" };
  if (side === "left") r.paddingLeft = pad;
  if (side === "right") r.paddingRight = pad;
  return r;
}

const TYPE_LABEL = {
  PISO: "Piso", HOUSE: "Casa", ATICO: "Ático", CHALET: "Chalet",
  DUPLEX: "Dúplex", ESTUDIO: "Estudio", LOFT: "Loft", LOCAL: "Local",
  TERRENO: "Terreno", OTRO: "Otro",
};

function formatPrice(cents) {
  if (cents == null) return "—";
  return Math.round(cents).toLocaleString("es-ES") + " €";
}

// ============================================================
// FiltersSidebar — properties list right rail
// ============================================================

function Field({ label, children }) {
  return (
    <label style={{display: "block"}}>
      <span style={{display: "block", fontSize: 12, fontWeight: 500, color: T.textMuted,
                    marginBottom: 6}}>{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  const [focus, setFocus] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  return (
    <input {...props}
      onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: "100%", height: 36, padding: "0 12px",
        border: `1px solid ${focus ? T.primary : hover ? T.borderStrong : T.border}`,
        borderRadius: 6, background: T.surface, color: T.text, fontSize: 13,
        fontFamily: "inherit", outline: "none",
        transition: "border-color 100ms",
        ...props.style,
      }}/>
  );
}

function Select({ children, ...props }) {
  return (
    <select {...props}
      style={{
        width: "100%", height: 36, padding: "0 32px 0 12px",
        border: `1px solid ${T.border}`, borderRadius: 6,
        background: T.surface, color: T.text, fontSize: 13,
        fontFamily: "inherit", outline: "none", appearance: "none",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236B6862' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
      }}>
      {children}
    </select>
  );
}

function FiltersSidebar({ filters, onChange, onClear, onApply }) {
  const f = filters;
  return (
    <aside style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 8, boxShadow: "0 1px 2px rgba(20,20,18,0.04)",
      padding: 16, alignSelf: "flex-start", position: "sticky", top: 24,
    }}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16}}>
        <h3 style={{margin: 0, fontSize: 13, fontWeight: 600, color: T.text}}>Filtros</h3>
        <button onClick={onClear}
          style={{background: "transparent", border: 0, padding: 0, cursor: "pointer",
                  color: T.textMuted, fontSize: 12, fontFamily: "inherit"}}>
          Limpiar
        </button>
      </div>
      <div style={{display: "flex", flexDirection: "column", gap: 12}}>
        <Field label="Ciudad">
          <Input placeholder="Oviedo, Gijón..." value={f.city ?? ""}
            onChange={(e) => onChange("city", e.target.value)}/>
        </Field>
        <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8}}>
          <Field label="Tipo">
            <Select value={f.type ?? ""} onChange={(e) => onChange("type", e.target.value)}>
              <option value="">Todos</option>
              <option value="PISO">Piso</option>
              <option value="HOUSE">Casa</option>
              <option value="ATICO">Ático</option>
              <option value="CHALET">Chalet</option>
            </Select>
          </Field>
          <Field label="Estado">
            <Select value={f.status ?? ""} onChange={(e) => onChange("status", e.target.value)}>
              <option value="">Cualquiera</option>
              <option value="FOR_SALE">En venta</option>
              <option value="RESERVED">Reservado</option>
              <option value="SOLD">Vendido</option>
            </Select>
          </Field>
        </div>
        <Field label="Precio (€)">
          <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8}}>
            <Input type="number" placeholder="Mín" value={f.minPrice ?? ""}
              onChange={(e) => onChange("minPrice", e.target.value)}/>
            <Input type="number" placeholder="Máx" value={f.maxPrice ?? ""}
              onChange={(e) => onChange("maxPrice", e.target.value)}/>
          </div>
        </Field>
        <Field label="Habitaciones mín.">
          <Select value={f.minRooms ?? ""} onChange={(e) => onChange("minRooms", e.target.value)}>
            <option value="">Cualquiera</option>
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}+</option>)}
          </Select>
        </Field>
        <div>
          <div style={{marginBottom: 6, fontSize: 12, fontWeight: 500, color: T.textMuted}}>
            Características
          </div>
          {[["hasFireplace","Chimenea"], ["hasGarage","Garaje"], ["hasTerrace","Terraza"]].map(([k, l]) => (
            <label key={k} style={{display: "flex", alignItems: "center", gap: 8,
                                    fontSize: 13, color: T.text, marginTop: 6, cursor: "pointer"}}>
              <input type="checkbox" checked={!!f[k]}
                onChange={(e) => onChange(k, e.target.checked)}
                style={{width: 16, height: 16, accentColor: T.primary, cursor: "pointer"}}/>
              {l}
            </label>
          ))}
        </div>
      </div>
      <div style={{marginTop: 20}}>
        <Button variant="primary" onClick={onApply}>
          <span style={{flex:1, textAlign:"center"}}>Aplicar filtros</span>
        </Button>
      </div>
    </aside>
  );
}

// ============================================================
// Price history chart — hand-rolled, matches the Recharts look
// ============================================================

function PriceHistoryChart({ data, height = 200 }) {
  if (!data?.length) {
    return <div style={{
      height, display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, color: T.textSubtle,
    }}>Sin histórico de precios.</div>;
  }
  const w = 600, h = height;
  const pad = { l: 40, r: 12, t: 8, b: 22 };
  const prices = data.map(d => d.price);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const padY = range * 0.15;
  const yMin = min - padY, yMax = max + padY;
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / (data.length - 1 || 1);
  const y = (v) => pad.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (h - pad.t - pad.b);
  const pathLine = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.price)}`).join(" ");
  const pathArea = `${pathLine} L ${x(data.length-1)} ${h - pad.b} L ${x(0)} ${h - pad.b} Z`;
  // Y-axis ticks (3)
  const yTicks = [0, 0.5, 1].map(t => yMin + t * (yMax - yMin));
  // X labels — first, middle, last
  const xLabels = [0, Math.floor(data.length/2), data.length-1].map(i => ({
    x: x(i),
    label: new Date(data[i].observedAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
  }));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{width: "100%", height}}>
      <defs>
        <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={T.primary} stopOpacity="0.18"/>
          <stop offset="100%" stopColor={T.primary} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* horizontal grid */}
      {yTicks.map((v, i) => (
        <line key={i} x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)}
          stroke={T.border} strokeDasharray="3 3"/>
      ))}
      {/* y labels */}
      {yTicks.map((v, i) => (
        <text key={i} x={pad.l - 6} y={y(v) + 4} fill={T.textSubtle}
          fontSize="11" textAnchor="end" fontFamily="inherit">
          {(v / 1000).toFixed(0)}k
        </text>
      ))}
      {/* x labels */}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={h - 6} fill={T.textSubtle}
          fontSize="11" textAnchor="middle" fontFamily="inherit">
          {l.label}
        </text>
      ))}
      <path d={pathArea} fill="url(#priceFill)"/>
      <path d={pathLine} fill="none" stroke={T.primary} strokeWidth="2"/>
    </svg>
  );
}

// ============================================================
// Export to window so sibling Babel scripts can use them
// ============================================================

Object.assign(window, {
  T, IconKey,
  IconDashboard, IconBuildings, IconSparkles, IconActivity, IconSearches, IconSettings,
  IconPlus, IconSearch, IconPin, IconBed, IconBath, IconArea,
  IconUp, IconDown, IconMinus, IconBack, IconEdit, IconExt, IconCalendar, IconRefresh,
  IconAlert, IconImage, IconFireplace, IconGarage, IconTerrace,
  Button, Badge, StatusBadge, PriceDelta,
  Card, CardHeader, CardBody, Stat, PageHeader,
  Sidebar, Topbar, AppShell,
  PropertyCard, PropertyTable, PropertyImage,
  Field, Input, Select, FiltersSidebar,
  PriceHistoryChart,
  TYPE_LABEL, STATUS_MAP, formatPrice,
});
