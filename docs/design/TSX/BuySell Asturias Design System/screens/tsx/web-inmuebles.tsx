// ──────────────────────────────────────────────────────────────────────────
// screens/tsx/web-inmuebles.tsx
// Design spec for BuySell web — Inmuebles page with the new vertical-tabs sidebar.
// Drop-in for Next.js 15 App Router + Tailwind. Tailwind classes match the
// repo's tailwind.config.ts. Data is hard-coded — wire to Prisma in the real
// page.tsx (see CLAUDE_CODE_PROMPT.md).
// ──────────────────────────────────────────────────────────────────────────
"use client";

import * as React from "react";
import {
  Building2, Search, Sparkles, LayoutDashboard, Activity, Download,
  User, Settings, MapPin, Bed, Bath, Maximize2, Plus, ChevronDown,
  Image as ImageIcon, ArrowUp, ArrowDown, Filter,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────────
// Brand mark — steel-blue line + aged-brass accent
// ──────────────────────────────────────────────────────────────────────────
function IconKey({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="6.5" cy="12" r="3.3" />
      <circle cx="6.5" cy="8" r="0.85" fill="#C49A4D" stroke="none" />
      <path d="M9.8 12 H17" />
      <path d="M17 12 H21 V17 H20 V15.5 H18.5 V17 H17 Z" fill="#C49A4D" />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Navigation model
// Each group carries an accent colour used as a 2px left border on the group
// header. Aged-brass-on-steel restraint: accents are subtle, not chip fills.
// ──────────────────────────────────────────────────────────────────────────
type NavItem = {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  count?: number;
};
type NavGroup = { id: string; label: string; accent: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    id: "catalogo", label: "Catálogo", accent: "#3A5F8A",
    items: [
      { id: "inmuebles",  label: "Inmuebles",  Icon: Building2 },
      { id: "duplicados", label: "Duplicados", Icon: Sparkles, count: 3 },
    ],
  },
  {
    id: "analisis", label: "Análisis", accent: "#2C7A8A",
    items: [
      { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
      { id: "actividad", label: "Actividad", Icon: Activity },
    ],
  },
  {
    id: "captura", label: "Captura", accent: "#A86A17",
    items: [
      { id: "importar", label: "Importar", Icon: Download },
    ],
  },
];

const FOOTER_ITEMS: NavItem[] = [
  { id: "perfil",  label: "Perfil",  Icon: User },
  { id: "ajustes", label: "Ajustes", Icon: Settings },
];

// ──────────────────────────────────────────────────────────────────────────
// Sidebar — Chrome Vertical Tabs inspiration, BuySell vocabulary:
//   • hairline borders (1px) instead of chips
//   • group accent only as a 2px left border on the header
//   • collapsible per group (chevron 90° rotation)
//   • active item: bg-primary-soft + text-primary, weight 500
// ──────────────────────────────────────────────────────────────────────────
export function Sidebar({
  current,
  onChange,
}: {
  current: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = React.useState<Record<string, boolean>>({
    catalogo: true, analisis: true, captura: true,
  });
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <aside className="flex h-screen w-[240px] shrink-0 flex-col border-r border-border bg-surface">
      {/* Brand */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
          <IconKey size={20} />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-text">BuySell</div>
          <div className="text-[11px] text-text-subtle">Asturias</div>
        </div>
      </div>

      {/* Groups */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((g) => (
          <div key={g.id} className="mb-1">
            <button
              type="button"
              onClick={() => toggle(g.id)}
              className="flex w-full items-center justify-between px-2.5 py-1.5 pl-[10px] text-[10px] font-semibold uppercase tracking-[0.06em] text-text-subtle hover:text-text-muted"
              style={{ borderLeft: `2px solid ${g.accent}`, marginLeft: -2 }}
            >
              <span>{g.label}</span>
              <ChevronDown
                size={11}
                className={`transition-transform ${open[g.id] ? "" : "-rotate-90"}`}
              />
            </button>

            {open[g.id] && (
              <div className="mt-0.5 space-y-px">
                {g.items.map((it) => {
                  const active = current === it.id;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => onChange(it.id)}
                      className={
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors " +
                        (active
                          ? "bg-primary-soft font-medium text-primary"
                          : "text-text-muted hover:bg-surface-muted hover:text-text")
                      }
                    >
                      <it.Icon
                        size={15}
                        className={active ? "text-primary" : "text-text-subtle"}
                      />
                      <span className="flex-1 text-left">{it.label}</span>
                      {it.count != null && (
                        <span
                          className={
                            "tabular-nums rounded px-1.5 text-[11px] font-medium " +
                            (active
                              ? "bg-primary/10 text-primary"
                              : "bg-surface-muted text-text-muted")
                          }
                        >
                          {it.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer (Cuenta) — no Cerrar sesión here; moved into Ajustes */}
      <div className="space-y-px border-t border-border p-2">
        {FOOTER_ITEMS.map((it) => (
          <button
            key={it.id}
            type="button"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-text-muted hover:bg-surface-muted hover:text-text"
          >
            <it.Icon size={15} className="text-text-subtle" />
            {it.label}
          </button>
        ))}
      </div>
    </aside>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Topbar — search on the left (max-w-md), CTA on the right
// Matches the existing AppShell.tsx pattern.
// ──────────────────────────────────────────────────────────────────────────
function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-6">
      <div className="relative w-full max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
        <input
          type="search"
          placeholder="Buscar inmuebles, direcciones, refs…"
          className="h-9 w-full rounded-md border border-border bg-bg pl-9 pr-12 text-[13px] text-text placeholder:text-text-subtle outline-none hover:border-border-strong focus:border-primary"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border border-border bg-surface px-1 py-px font-mono text-[10px] text-text-subtle">
          ⌘K
        </span>
      </div>
      <button
        type="button"
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-fg hover:bg-primary-hover"
      >
        <Plus size={14} /> Nuevo inmueble
      </button>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Mock data — REPLACE with Prisma findMany() result in real page.tsx
// ──────────────────────────────────────────────────────────────────────────
type Property = {
  id: number;
  title: string;
  type: string;
  neighborhood: string | null;
  city: string;
  status: "FOR_SALE" | "RESERVED" | "SOLD" | "WITHDRAWN";
  price: number;
  rooms: number;
  baths: number;
  area: number;
  duplicates: number;
  delta: number;
};

const MOCK_PROPS: Property[] = [
  { id: 1, title: "Piso luminoso en La Manjoya con vistas", type: "Piso", neighborhood: "La Manjoya", city: "Oviedo", status: "FOR_SALE", price: 195000, rooms: 3, baths: 2, area: 95, duplicates: 2, delta: -3.7 },
  { id: 2, title: "Chalet pareado con jardín y garaje", type: "Chalet", neighborhood: "Cabueñes", city: "Gijón", status: "RESERVED", price: 385000, rooms: 4, baths: 3, area: 180, duplicates: 0, delta: 0 },
  { id: 3, title: "Ático con terraza en el centro", type: "Ático", neighborhood: "Centro", city: "Avilés", status: "FOR_SALE", price: 165000, rooms: 2, baths: 1, area: 72, duplicates: 1, delta: -2.4 },
  { id: 4, title: "Estudio reformado cerca de la playa", type: "Estudio", neighborhood: "San Lorenzo", city: "Gijón", status: "SOLD", price: 89000, rooms: 0, baths: 1, area: 35, duplicates: 0, delta: 0 },
  { id: 5, title: "Casa de pueblo con hórreo en parcela", type: "Casa", neighborhood: null, city: "Cangas de Onís", status: "FOR_SALE", price: 178000, rooms: 4, baths: 2, area: 145, duplicates: 0, delta: -3.8 },
  { id: 6, title: "Dúplex con dos terrazas y garaje incluido", type: "Dúplex", neighborhood: "La Magdalena", city: "Avilés", status: "FOR_SALE", price: 215000, rooms: 3, baths: 2, area: 105, duplicates: 0, delta: -2.3 },
];

const STATUS_MAP: Record<Property["status"], { label: string; cls: string }> = {
  FOR_SALE:  { label: "En venta",  cls: "bg-info-soft text-info border-info/15" },
  RESERVED:  { label: "Reservado", cls: "bg-warning-soft text-warning border-warning/20" },
  SOLD:      { label: "Vendido",   cls: "bg-success-soft text-success border-success/15" },
  WITHDRAWN: { label: "Retirado",  cls: "bg-surface-muted text-text-muted border-border" },
};

const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

function StatusBadge({ s }: { s: Property["status"] }) {
  const c = STATUS_MAP[s];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${c.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {c.label}
    </span>
  );
}

function PriceDelta({ pct }: { pct: number }) {
  if (pct === 0) return null;
  const down = pct < 0;
  const Icon = down ? ArrowDown : ArrowUp;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
      style={{
        background: down ? "#F0F7F2" : "#FDF2F2",
        color: down ? "#2D6A4F" : "#A23E3E",
      }}
    >
      <Icon size={10} />
      {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Property card — for the 3-col grid
// ──────────────────────────────────────────────────────────────────────────
function PropertyCard({ p }: { p: Property }) {
  return (
    <div className="group overflow-hidden rounded-lg border border-border bg-surface shadow-xs transition-shadow hover:shadow-sm">
      <div className="relative aspect-[16/10] bg-surface-muted">
        <div className="absolute inset-0 flex items-center justify-center text-text-subtle">
          <ImageIcon size={28} strokeWidth={1.5} />
        </div>
        <div className="absolute left-3 top-3">
          <StatusBadge s={p.status} />
        </div>
        {p.duplicates > 0 && (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-surface/95 px-1.5 py-0.5 text-[10px] font-medium text-primary shadow-xs backdrop-blur">
            <Sparkles size={9} /> {p.duplicates}{" "}
            {p.duplicates === 1 ? "duplicado" : "duplicados"}
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug text-text">
          {p.title}
        </h3>
        <div className="flex items-center gap-1 text-[12px] text-text-muted">
          <MapPin size={11} />
          <span>
            {p.type} · {p.neighborhood ? `${p.neighborhood}, ` : ""}
            {p.city}
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <div className="text-[18px] font-semibold tracking-tight text-text tabular-nums">
            {eur(p.price)}
          </div>
          <PriceDelta pct={p.delta} />
        </div>
        <div className="flex items-center gap-3 border-t border-border pt-2.5 text-[12px] text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Bed size={11} /> {p.rooms} hab
          </span>
          <span className="inline-flex items-center gap-1">
            <Bath size={11} /> {p.baths}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Maximize2 size={11} /> {p.area} m²
          </span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Page — wires Sidebar + Topbar + content. In your real app, this is the
// content of /app/properties/page.tsx. Sidebar/Topbar live in AppShell.
// ──────────────────────────────────────────────────────────────────────────
export default function InmueblesPage({ data = MOCK_PROPS }: { data?: Property[] }) {
  const [current, setCurrent] = React.useState("inmuebles");
  const [sort, setSort] = React.useState("updatedAt-desc");
  return (
    <div className="flex h-screen bg-bg text-text">
      <Sidebar current={current} onChange={setCurrent} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="min-w-0 flex-1 overflow-y-auto px-6 py-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.015em] text-text">
                Inmuebles
              </h1>
              <p className="mt-1 text-[13px] text-text-muted">
                {data.length} fichas · sincronizado hace 12 min · 3 cambios nuevos
              </p>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-text-muted">
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-[12px] text-text hover:bg-surface-muted"
              >
                <Filter size={12} /> Filtros
              </button>
              <span>Ordenar por</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-8 rounded-md border border-border bg-surface px-2 pr-7 text-[12px] text-text"
              >
                <option value="updatedAt-desc">Más recientes</option>
                <option value="currentPrice-asc">Precio: menor</option>
                <option value="currentPrice-desc">Precio: mayor</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {data.map((p) => (
              <PropertyCard key={p.id} p={p} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
