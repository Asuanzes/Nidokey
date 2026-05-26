/* BuySell shared shell — sidebar (web), rail (mobile), chrome, tokens, helpers.
   Load after lucide-shim.jsx and before any screen script. */

// ---- Tokens ----
const T = {
  bg: "#FAFAF7", surface: "#FFFFFF", surfaceMuted: "#F4F3EE", surfaceSunken: "#EFEEE8",
  border: "#E8E6E1", borderStrong: "#D4D1CA",
  text: "#1A1A18", textMuted: "#6B6862", textSubtle: "#9A9690", textInverse: "#FAFAF7",
  primary: "#3A5F8A", primaryHover: "#2E4D70", primarySoft: "#EAEFF6", primaryFg: "#FAFAF7",
  accent: "#C49A4D",
  successFg: "#2D6A4F", successBg: "#E8F1EC",
  warningFg: "#A86A17", warningBg: "#F7EFDE",
  dangerFg: "#A23E3E", dangerBg: "#F6E5E5",
  infoFg: "#2C7A8A", infoBg: "#E1EEF1",
  priceDownBg: "#F0F7F2", priceDownFg: "#2D6A4F",
  priceUpBg: "#FDF2F2", priceUpFg: "#A23E3E",
};
const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const TAB = { fontVariantNumeric: "tabular-nums" };
const fmtEur = (n) => `${n.toLocaleString("es-ES")} €`;

function BrandKey({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6.5" cy="12" r="3.3"/>
      <circle cx="6.5" cy="8" r="0.85" fill="#C49A4D" stroke="none"/>
      <path d="M9.8 12 H17"/>
      <path d="M17 12 H21 V17 H20 V15.5 H18.5 V17 H17 Z" fill="#C49A4D"/>
    </svg>
  );
}

// ---- Nav model ----
const navGroups = [
  { id: "catalogo", label: "Catálogo", accent: "#3A5F8A", items: [
    { id: "inmuebles",  label: "Inmuebles",  Icon: Building2 },
    { id: "duplicados", label: "Duplicados", Icon: Sparkles, count: 3 },
  ]},
  { id: "analisis", label: "Análisis", accent: "#2C7A8A", items: [
    { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { id: "actividad", label: "Actividad", Icon: Activity },
  ]},
  { id: "captura", label: "Captura", accent: "#A86A17", items: [
    { id: "importar", label: "Importar", Icon: Download },
  ]},
];
const footerItems = [
  { id: "perfil",  label: "Perfil",  Icon: User },
  { id: "ajustes", label: "Ajustes", Icon: Settings },
];

// ---- WEB SIDEBAR ----
function WebSidebar({ active }) {
  const [open, setOpen] = React.useState({ catalogo: true, analisis: true, captura: true });
  return (
    <aside style={{
      width: 240, flexShrink: 0, display: "flex", flexDirection: "column",
      borderRight: `1px solid ${T.border}`, background: T.surface, fontFamily: FONT,
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
        }}><BrandKey size={20}/></div>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>BuySell</div>
          <div style={{ fontSize: 11, color: T.textSubtle }}>Asturias</div>
        </div>
      </div>
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        {navGroups.map((g) => (
          <div key={g.id} style={{ marginBottom: 4 }}>
            <button onClick={() => setOpen(o => ({...o, [g.id]: !o[g.id]}))}
              style={{
                display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
                padding: "6px 10px", marginLeft: -2,
                borderLeft: `2px solid ${g.accent}`, background: "transparent",
                border: "none", borderLeftStyle: "solid", borderLeftWidth: 2, borderLeftColor: g.accent,
                fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.06em", color: T.textSubtle, cursor: "pointer", fontFamily: FONT,
              }}>
              <span>{g.label}</span>
              <ChevronDown size={11} color={T.textSubtle}
                style={{ transform: open[g.id] ? "none" : "rotate(-90deg)", transition: "transform 150ms" }}/>
            </button>
            {open[g.id] && g.items.map((it) => {
              const isActive = active === it.id;
              return (
                <button key={it.id} style={{
                  display: "flex", width: "100%", alignItems: "center", gap: 10,
                  padding: "6px 10px", marginTop: 1, borderRadius: 6,
                  background: isActive ? T.primarySoft : "transparent",
                  color: isActive ? T.primary : T.textMuted,
                  fontWeight: isActive ? 500 : 400, fontSize: 13,
                  border: "none", cursor: "pointer", fontFamily: FONT, textAlign: "left",
                }}>
                  <it.Icon size={15} color={isActive ? T.primary : T.textSubtle}/>
                  <span style={{ flex: 1 }}>{it.label}</span>
                  {it.count != null && (
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: "0 6px", borderRadius: 4,
                      background: isActive ? "rgba(58,95,138,0.1)" : T.surfaceMuted,
                      color: isActive ? T.primary : T.textMuted, ...TAB,
                    }}>{it.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div style={{ borderTop: `1px solid ${T.border}`, padding: 8 }}>
        {footerItems.map((it) => (
          <button key={it.id} style={{
            display: "flex", width: "100%", alignItems: "center", gap: 10,
            padding: "6px 10px", borderRadius: 6, background: "transparent",
            color: T.textMuted, fontSize: 13, border: "none", cursor: "pointer", fontFamily: FONT, textAlign: "left",
          }}><it.Icon size={15} color={T.textSubtle}/>{it.label}</button>
        ))}
      </div>
    </aside>
  );
}

function WebTopbar() {
  // Pill global de duplicados pendientes — visible en todas las pantallas web.
  // Lee el count del modelo de navegación para mantener single source of truth.
  const dupCount = navGroups
    .flatMap(g => g.items)
    .find(it => it.id === "duplicados")?.count || 0;
  return (
    <header style={{
      height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 16, borderBottom: `1px solid ${T.border}`, background: T.surface, padding: "0 24px",
    }}>
      <div style={{ position: "relative", width: "100%", maxWidth: 448 }}>
        <Search size={14} color={T.textSubtle} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}/>
        <input type="search" placeholder="Buscar inmuebles, direcciones, refs…"
          style={{
            height: 36, width: "100%", paddingLeft: 32, paddingRight: 48,
            border: `1px solid ${T.border}`, borderRadius: 6,
            background: T.bg, color: T.text, fontSize: 13, fontFamily: FONT, outline: "none",
          }}/>
        <span style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          padding: "1px 5px", borderRadius: 3, border: `1px solid ${T.border}`,
          background: T.surface, fontSize: 10, color: T.textSubtle, fontFamily: "monospace",
        }}>⌘K</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {dupCount > 0 && (
          <a href="#" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 12px 5px 10px", borderRadius: 999,
            background: T.accent + "1F",
            color: T.warningFg,
            border: `1px solid ${T.accent}55`,
            fontSize: 12, fontWeight: 500, textDecoration: "none",
            fontFamily: FONT, ...TAB,
          }}>
            <Sparkles size={12} color={T.warningFg}/>
            {dupCount} duplicado{dupCount > 1 ? "s" : ""} pendiente{dupCount > 1 ? "s" : ""} →
          </a>
        )}
        <button style={{
          height: 36, padding: "0 14px", borderRadius: 6, border: "none",
          background: T.primary, color: T.primaryFg, fontSize: 13, fontWeight: 500,
          cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 6,
        }}><Plus size={14}/> Nuevo inmueble</button>
      </div>
    </header>
  );
}

function WebShell({ active, children }) {
  return (
    <div style={{ display: "flex", height: "100%", background: T.bg, fontFamily: FONT, color: T.text }}>
      <WebSidebar active={active}/>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <WebTopbar/>
        <main style={{ flex: 1, overflowY: "auto", padding: "24px 24px 40px" }}>{children}</main>
      </div>
    </div>
  );
}

// ---- MOBILE RAIL ----
const railItemsByGroup = [
  { label: "Inmuebles", icon: Building2, id: "inmuebles" },
  { label: "Duplic.",   icon: Sparkles,  id: "duplicados", badge: 3 },
  { sep: true },
  { label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { label: "Actividad", icon: Activity, id: "actividad" },
  { sep: true },
  { label: "Importar",  icon: Download, id: "importar" },
];
const railFooterItems = [
  { label: "Perfil",  icon: User },
  { label: "Ajustes", icon: Settings },
];

function MobileRail({ active, platform }) {
  // iOS conserva labels (HIG); Android va solo iconos por preferencia del usuario.
  const showLabels = platform !== "android";
  const itemW = showLabels ? 52 : 44;
  const itemPad = showLabels ? "8px 0 6px" : 0;
  const itemH = showLabels ? "auto" : 44;
  const iconSize = showLabels ? 20 : 22;
  return (
    <div style={{
      width: 64, flexShrink: 0, display: "flex", flexDirection: "column",
      borderRight: `1px solid ${T.border}`, background: T.surface,
    }}>
      <div style={{
        height: 56, display: "flex", alignItems: "center", justifyContent: "center",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: T.primarySoft, color: T.primary,
        }}><BrandKey size={18}/></div>
      </div>
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: showLabels ? 2 : 6, paddingTop: 8 }}>
        {railItemsByGroup.map((it, i) => {
          if (it.sep) return <div key={i} style={{ width: 32, height: 1, background: T.border, margin: "6px 0" }}/>;
          const Icon = it.icon;
          const isActive = active === it.id;
          return (
            <a key={it.id} href="#"
               aria-label={it.label}
               title={it.label}
               style={{
              width: itemW, height: itemH, padding: itemPad, borderRadius: showLabels ? 10 : 12,
              textDecoration: "none", textAlign: "center",
              background: isActive ? T.primarySoft : "transparent", position: "relative",
              display: showLabels ? "block" : "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={iconSize} color={isActive ? T.primary : T.textMuted}/>
              {showLabels && (
                <div style={{ fontSize: 9, marginTop: 3, color: isActive ? T.primary : T.textSubtle,
                  fontWeight: isActive ? 600 : 400, fontFamily: FONT }}>{it.label}</div>
              )}
              {it.badge > 0 && (
                <span style={{
                  position: "absolute", top: showLabels ? 4 : 4, right: showLabels ? 6 : 4,
                  minWidth: 14, height: 14,
                  padding: "0 4px", borderRadius: 999, background: T.dangerFg, color: "#fff",
                  fontSize: 9, fontWeight: 700, lineHeight: "14px", textAlign: "center", ...TAB,
                  boxShadow: !showLabels ? `0 0 0 2px ${isActive ? T.primarySoft : T.surface}` : "none",
                }}>{it.badge}</span>
              )}
            </a>
          );
        })}
      </nav>
      <div style={{ borderTop: `1px solid ${T.border}`, padding: "8px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: showLabels ? 2 : 6 }}>
        {railFooterItems.map((it) => {
          const Icon = it.icon;
          return (
            <a key={it.label} href="#"
               aria-label={it.label}
               title={it.label}
               style={{
              width: itemW, height: itemH, padding: itemPad, borderRadius: showLabels ? 10 : 12,
              textDecoration: "none", textAlign: "center",
              display: showLabels ? "block" : "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={showLabels ? 18 : 20} color={T.textSubtle}/>
              {showLabels && (
                <div style={{ fontSize: 9, marginTop: 3, color: T.textSubtle, fontFamily: FONT }}>{it.label}</div>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}

function AndroidBar() {
  return (
    <div style={{
      height: 28, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 16px", fontSize: 12, fontWeight: 600, color: T.text, background: T.surface, fontFamily: FONT,
    }}>
      <span style={TAB}>9:30</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Signal size={12}/><Wifi size={12}/><Battery size={14}/>
      </div>
    </div>
  );
}
function AndroidGesture() {
  return <div style={{ height: 24, display: "flex", alignItems: "center", justifyContent: "center", background: T.surface }}>
    <div style={{ width: 112, height: 4, borderRadius: 999, background: `${T.text}cc` }}/>
  </div>;
}

function IOSBar() {
  return (
    <div style={{ position: "relative", height: 47, background: T.surface }}>
      <div style={{ position: "absolute", left: 28, top: "50%", transform: "translateY(-50%)", fontSize: 15, fontWeight: 600, color: T.text, fontFamily: FONT, ...TAB }}>9:41</div>
      <div style={{ position: "absolute", left: "50%", top: 11, width: 110, height: 31, borderRadius: 999, background: T.text, transform: "translateX(-50%)" }}/>
      <div style={{ position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: 5 }}>
        <Signal size={14}/><Wifi size={14}/><Battery size={16}/>
      </div>
    </div>
  );
}
function IOSHome() {
  return <div style={{ height: 34, display: "flex", alignItems: "end", justifyContent: "center", paddingBottom: 8, background: T.surface }}>
    <div style={{ width: 134, height: 5, borderRadius: 999, background: T.text }}/>
  </div>;
}

function MobileShell({ platform, active, header, children }) {
  const isIOS = platform === "ios";
  return (
    <div style={{
      width: 393, height: 852, display: "flex", flexDirection: "column", overflow: "hidden",
      background: T.bg, fontFamily: FONT, color: T.text,
      borderRadius: isIOS ? 40 : 28, boxShadow: "0 0 0 1px rgba(0,0,0,0.08)",
    }}>
      {isIOS ? <IOSBar/> : <AndroidBar/>}
      {/* iOS HIG: la nav header va full-width sobre el rail */}
      {isIOS && header}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <MobileRail active={active} platform={platform}/>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Android: header sigue dentro de la columna a la derecha del rail */}
          {!isIOS && header}
          <div style={{ flex: 1, overflowY: "auto" }}>{children}</div>
        </div>
      </div>
      {isIOS ? <IOSHome/> : <AndroidGesture/>}
    </div>
  );
}

// ---- Shared UI ----
function SCard({ title, right, children, noPad }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, boxShadow: "0 1px 2px rgba(20,20,18,0.04)", overflow: "hidden" }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: FONT }}>{title}</span>
          {right}
        </div>
      )}
      <div style={noPad ? {} : { padding: 16 }}>{children}</div>
    </div>
  );
}

function SBadge({ label, bg, fg }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5,
    padding: "2px 7px", borderRadius: 6, fontSize: 11, fontWeight: 500,
    background: bg, color: fg, border: `1px solid ${fg}22` }}>
    <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor", opacity: 0.7 }}/>
    {label}
  </span>;
}

function SStat({ label, value, hint }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8,
      boxShadow: "0 1px 2px rgba(20,20,18,0.04)", padding: 16,
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em", color: T.textSubtle }}>{label}</div>
      <div style={{ marginTop: 6, fontSize: 24, fontWeight: 600, letterSpacing: "-0.015em", color: T.text, ...TAB }}>{value}</div>
      {hint && <div style={{ marginTop: 4, fontSize: 11, color: T.textMuted }}>{hint}</div>}
    </div>
  );
}

// Export everything
Object.assign(window, {
  T, FONT, TAB, fmtEur, BrandKey,
  WebShell, MobileShell,
  SCard, SBadge, SStat,
  navGroups, footerItems,
});
