import Link from "next/link";
import {
  IconKey,
  IconPortfolio,
  IconAscenso,
  IconFoco,
  IconHorreo,
  IconPicos,
} from "@/components/brand/icons";

/**
 * Landing pública (raíz `/`). Presentación + descarga de Nidokey. Server
 * Component estático: sin auth, sin el chrome de la app (AppShell hace bypass
 * para `/`). Reutiliza los tokens de marca (steel `--primary` + bronce
 * `--brand-accent`) y los iconos de `components/brand`.
 *
 * Los botones de descarga van como "Próximamente" porque la app aún no está
 * publicada en tiendas; al publicar, basta sustituir `href`/estado en StoreBadge.
 */

const APP_NAME = "Nidokey";

const VERTICALS: {
  icon: typeof IconKey;
  title: string;
  body: string;
}[] = [
  {
    icon: IconPortfolio,
    title: "Inmuebles",
    body:
      "Guarda anuncios de varios portales como una sola ficha: histórico de precios, deduplicación automática y datos oficiales del Catastro.",
  },
  {
    icon: IconAscenso,
    title: "Cripto y mercado",
    body:
      "Sigue criptomonedas, acciones, ETF y fondos con su cotización, gráfico de 7 días y el logo de cada activo.",
  },
  {
    icon: IconFoco,
    title: "Empleos",
    body:
      "Busca ofertas en InfoJobs, LinkedIn e Indeed a la vez, filtra por zona y guarda las que te interesen.",
  },
];

const FEATURES = [
  "Histórico de precios",
  "Deduplicación inteligente",
  "Enriquecimiento con Catastro",
  "Importar compartiendo una URL",
  "Búsqueda global",
  "Modo claro y oscuro",
];

export function Landing() {
  return (
    <div className="min-h-screen bg-bg text-text">
      {/* ===== Top bar ===== */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
            <IconKey size={22} />
          </span>
          <div className="leading-tight">
            <div className="text-md font-semibold text-accent">{APP_NAME}</div>
            <div className="text-[11px] text-text-subtle">Asturias</div>
          </div>
        </div>
        <Link
          href="/login"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
        >
          Acceder
        </Link>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        {/* halo sutil steel detrás del hero */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 h-72 opacity-60"
          style={{
            background:
              "radial-gradient(60% 100% at 50% 0%, var(--primary-soft) 0%, transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-5xl items-center gap-12 px-6 pb-8 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-14">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-text-muted shadow-xs">
              <IconHorreo size={14} className="text-accent" />
              Hecho en Asturias
            </span>
            <h1 className="mt-5 text-[34px] font-bold leading-[1.1] tracking-tight text-text sm:text-[44px]">
              Inmuebles, mercados y empleos.
              <br />
              <span className="text-primary">En un solo sitio.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-muted">
              {APP_NAME} reúne tus anuncios, cotizaciones y ofertas de empleo —
              con histórico de precios, deduplicación y datos oficiales— en una
              app sobria para tu móvil.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <StoreBadge store="android" />
              <StoreBadge store="ios" />
            </div>
            <p className="mt-3 text-xs text-text-subtle">
              Próximamente en Google Play y App Store.
            </p>
          </div>

          {/* Mockup del móvil */}
          <div className="flex justify-center lg:justify-end">
            <PhoneMock />
          </div>
        </div>
      </section>

      {/* ===== Verticales ===== */}
      <section className="mx-auto max-w-5xl px-6 py-14">
        <h2 className="text-2xl font-semibold tracking-tight text-text">
          Todo lo que sigues, en un panel
        </h2>
        <p className="mt-2 max-w-2xl text-md text-text-muted">
          Tres mundos en la misma app, con el mismo cuidado por el dato y el
          histórico.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {VERTICALS.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.title}
                className="rounded-xl border border-border bg-surface p-5 shadow-xs"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
                  <Icon size={24} />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-text">{v.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                  {v.body}
                </p>
              </div>
            );
          })}
        </div>

        {/* Chips de características */}
        <div className="mt-8 flex flex-wrap gap-2.5">
          {FEATURES.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-3 py-1.5 text-sm text-text-muted"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {f}
            </span>
          ))}
        </div>
      </section>

      {/* ===== Descarga ===== */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center shadow-sm sm:p-12">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
            <IconKey size={26} />
          </span>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-text">
            Llévatela en el móvil
          </h2>
          <p className="mx-auto mt-2 max-w-md text-md text-text-muted">
            {APP_NAME} para Android e iOS. Sin contraseñas: entras con un código
            por email.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <StoreBadge store="android" />
            <StoreBadge store="ios" />
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <IconKey size={18} className="text-primary" />
            <span className="font-semibold text-accent">{APP_NAME}</span>
            <span className="text-text-subtle">· Hecho en Asturias</span>
            <IconPicos size={16} className="text-text-subtle" />
          </div>
          <div className="flex items-center gap-4 text-sm text-text-subtle">
            <span>© {new Date().getFullYear()}</span>
            <Link href="/login" className="hover:text-text-muted">
              Acceder
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ───────────────────────── Mockup del móvil ───────────────────────── */

/** Marco de móvil estilizado con tarjetas mock (evoca la UI bronce/steel). */
function PhoneMock() {
  return (
    <div
      className="relative w-[248px] rounded-[2rem] border border-border-strong bg-surface p-2.5 shadow-md"
      style={{ aspectRatio: "9 / 19" }}
      aria-hidden
    >
      {/* notch */}
      <div className="mx-auto mb-2 mt-1 h-1.5 w-16 rounded-full bg-border-strong" />
      <div className="flex h-[calc(100%-1.5rem)] flex-col gap-2 overflow-hidden rounded-[1.4rem] bg-bg p-3">
        <div className="px-0.5 pb-1 text-[13px] font-bold text-text">Registros</div>
        <MockMarketRow name="BTC" sub="Bitcoin" price="60.375 €" up />
        <MockMarketRow name="SXR8.DE" sub="iShares S&P 500" price="702 €" up />
        <MockJobRow />
        <MockPropertyRow />
      </div>
    </div>
  );
}

function MockMarketRow({
  name,
  sub,
  price,
  up,
}: {
  name: string;
  sub: string;
  price: string;
  up?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-2.5 py-2">
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-full bg-surface-sunken ring-1 ring-inset ring-border" />
        <div className="leading-tight">
          <div className="text-[12px] font-semibold text-text">{name}</div>
          <div className="text-[10px] text-text-subtle">{sub}</div>
        </div>
      </div>
      <div className="text-right leading-tight">
        <div className="text-[12px] font-bold text-accent">{price}</div>
        <div className={`text-[10px] ${up ? "text-success" : "text-danger"}`}>
          {up ? "▲ 0,9%" : "▼ 0,4%"}
        </div>
      </div>
    </div>
  );
}

function MockJobRow() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2">
      <span className="h-9 w-9 rounded-md bg-surface-sunken ring-1 ring-inset ring-border" />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[12px] font-semibold text-text">
          Desarrollador/a React
        </div>
        <div className="truncate text-[10px] text-text-subtle">Bilbao · LinkedIn</div>
        <div className="text-[10px] font-semibold text-accent">28.000–35.000 €</div>
      </div>
    </div>
  );
}

function MockPropertyRow() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2">
      <span className="h-9 w-9 rounded-md bg-surface-sunken ring-1 ring-inset ring-border" />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[12px] font-semibold text-text">
          Piso en Oviedo centro
        </div>
        <div className="truncate text-[10px] text-text-subtle">3 hab · 95 m²</div>
        <div className="text-[10px] font-bold text-accent">189.000 €</div>
      </div>
    </div>
  );
}

/* ───────────────────────── Badges de tienda ───────────────────────── */

/**
 * Badge estilo tienda, marcado "Próximamente" (no clicable). Al publicar:
 * cambiar a `<Link href=...>` y quitar el ribbon. iOS y Android comparten estilo.
 */
function StoreBadge({ store }: { store: "android" | "ios" }) {
  const label = store === "android" ? "Google Play" : "App Store";
  return (
    <div
      role="button"
      aria-disabled
      aria-label={`${label} — Próximamente`}
      className="relative inline-flex cursor-default items-center gap-2.5 rounded-xl bg-text px-4 py-2.5 text-text-inverse opacity-90"
    >
      {store === "android" ? <PlayMark /> : <AppleMark />}
      <span className="text-left leading-tight">
        <span className="block text-[10px] uppercase tracking-wide opacity-70">
          Próximamente en
        </span>
        <span className="block text-[15px] font-semibold">{label}</span>
      </span>
    </div>
  );
}

function PlayMark() {
  return (
    <svg width="20" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M3.6 2.3 13.5 12 3.6 21.7c-.3-.2-.5-.6-.5-1.1V3.4c0-.5.2-.9.5-1.1Z" fill="#34A853" />
      <path d="M16.8 8.7 13.5 12l3.3 3.3 3.6-2c.8-.5.8-1.6 0-2.1l-3.6-2Z" fill="#FBBC04" />
      <path d="M3.6 2.3c.2-.1.5-.1.8.1l12.4 6.3-3.3 3.3L3.6 2.3Z" fill="#EA4335" />
      <path d="M13.5 12l3.3 3.3L4.4 21.6c-.3.2-.6.2-.8.1L13.5 12Z" fill="#4285F4" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="18" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.8-3.5.8-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.6 2.3 2.8 2.3 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.2.9-1.3 1.2-2.5 1.2-2.6-.1 0-2.4-.9-2.4-3.5Zm-2.3-6.4c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.2Z" />
    </svg>
  );
}
