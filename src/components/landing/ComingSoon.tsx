import { IconKey } from "@/components/brand/icons";
import {
  BRAND_PHRASES_LEFT,
  BRAND_PHRASES_RIGHT,
  type BrandPhrase,
} from "./brand-phrases";

/**
 * Página pública temporal para la raíz `/`: mensaje "Próximamente" rodeado por la
 * frase de marca "Tu nido, tu key." en 18 idiomas (9 a cada lado).
 *
 * La landing completa sigue intacta en `@/components/landing/Landing` (no se
 * borra nada). Cuando las apps estén publicadas en tiendas, restaurar la landing
 * es un cambio de UNA línea en `src/app/page.tsx`:
 *   - <ComingSoon />  →  <Landing />
 *
 * Server Component estático, sin auth ni chrome de app. Reutiliza los tokens de
 * marca (steel `--primary` + cobre `--brand-accent`) y el icono de la llave.
 */

const APP_NAME = "Nidokey";

// Resalta las palabras de marca "nido" y "key" (donde aparecen en alfabeto latino)
// con el cobre de la marca. En idiomas con otro alfabeto (árabe) no hay match y la
// frase se muestra tal cual.
function Slogan({ text }: { text: string }) {
  const parts = text.split(/(\bnido\b|\bkey\b)/gi);
  return (
    <>
      {parts.map((part, i) =>
        /^(nido|key)$/i.test(part) ? (
          <span key={i} className="font-medium text-accent">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function PhraseList({
  phrases,
  side,
}: {
  phrases: BrandPhrase[];
  side: "left" | "right";
}) {
  return (
    <ul
      className={[
        // móvil: rejilla de 2 columnas debajo del centro
        "grid w-full grid-cols-2 gap-x-6 gap-y-4",
        // desktop: columna vertical pegada al centro
        "lg:flex lg:w-auto lg:flex-col lg:gap-y-5",
        side === "left"
          ? "lg:items-end lg:text-right"
          : "lg:items-start lg:text-left",
      ].join(" ")}
    >
      {phrases.map((p) => (
        <li key={p.code} dir="auto" className="leading-snug">
          <div className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            {p.label}
          </div>
          <div className="text-sm text-text-muted">
            <Slogan text={p.slogan} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ComingSoon() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-6 py-16 text-center text-text">
      {/* halo sutil steel detrás del contenido */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-80 opacity-60"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, var(--primary-soft) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex w-full max-w-6xl flex-col items-center gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center lg:gap-x-12">
        {/* Frase de marca — 9 idiomas (izquierda en desktop, debajo en móvil) */}
        <div className="order-2 w-full lg:order-1 lg:w-auto">
          <PhraseList phrases={BRAND_PHRASES_LEFT} side="left" />
        </div>

        {/* Contenido central */}
        <div className="order-1 flex flex-col items-center lg:order-2">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
            <IconKey size={36} />
          </span>
          <div className="mt-4 text-lg font-semibold text-accent">{APP_NAME}</div>

          <h1 className="mt-10 text-[40px] font-bold uppercase leading-none tracking-tight text-primary sm:text-[56px]">
            Próximamente
          </h1>

          <p
            lang="en"
            className="mt-6 max-w-md text-lg leading-relaxed text-text-muted"
          >
            We&rsquo;re polishing the Android and iOS apps.
          </p>
        </div>

        {/* Frase de marca — 9 idiomas (derecha en desktop, debajo en móvil) */}
        <div className="order-3 w-full lg:w-auto">
          <PhraseList phrases={BRAND_PHRASES_RIGHT} side="right" />
        </div>
      </div>
    </main>
  );
}
