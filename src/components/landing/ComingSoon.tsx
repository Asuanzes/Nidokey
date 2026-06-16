import {
  BRAND_PHRASES_LEFT,
  BRAND_PHRASES_RIGHT,
  BRAND_WORDS,
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

// Resalta las palabras de marca en cobre — "nido"/"key" en alfabeto latino y su
// transliteración en árabe (نيدو/كِي), tomadas de BRAND_WORDS para no descuadrar.
const BRAND_RE = new RegExp(`(${BRAND_WORDS.join("|")})`, "gi");
const BRAND_SET = new Set(BRAND_WORDS.map((w) => w.toLowerCase()));

function Slogan({ text }: { text: string }) {
  return (
    <>
      {text
        .split(BRAND_RE)
        .filter(Boolean)
        .map((part, i) =>
          BRAND_SET.has(part.toLowerCase()) ? (
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
        <li
          key={p.code}
          dir="auto"
          className="text-sm leading-snug text-text-muted"
        >
          <Slogan text={p.slogan} />
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nidokey-logo.png" alt="Nidokey" width={64} height={64} className="h-16 w-16 rounded-2xl" />
          <div className="mt-4 text-lg font-semibold text-accent">{APP_NAME}</div>

          <h1
            lang="en"
            className="mt-10 text-[40px] font-bold uppercase leading-none tracking-tight text-primary sm:text-[56px]"
          >
            Coming soon
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
