import { IconKey } from "@/components/brand/icons";

/**
 * Página pública temporal para la raíz `/`: solo un mensaje "Próximamente".
 *
 * La landing completa sigue intacta en `@/components/landing/Landing` (no se
 * borra nada). Cuando las apps estén publicadas en tiendas, restaurar la landing
 * es un cambio de UNA línea en `src/app/page.tsx`:
 *   - <ComingSoon />  →  <Landing />
 *
 * Server Component estático, sin auth ni chrome de app. Reutiliza los tokens de
 * marca (steel `--primary` + bronce `--brand-accent`) y el icono de la llave.
 */

const APP_NAME = "Nidokey";

export function ComingSoon() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-6 text-center text-text">
      {/* halo sutil steel detrás del contenido */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-80 opacity-60"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, var(--primary-soft) 0%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center">
        {/* Logo de marca */}
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/15">
          <IconKey size={36} />
        </span>
        <div className="mt-4 text-lg font-semibold text-accent">{APP_NAME}</div>

        {/* Mensaje principal */}
        <h1 className="mt-10 text-[40px] font-bold uppercase leading-none tracking-tight text-primary sm:text-[56px]">
          Próximamente
        </h1>

        <p className="mt-6 max-w-md text-lg leading-relaxed text-text-muted">
          Estamos puliendo las apps de Android e iOS.
        </p>
      </div>
    </main>
  );
}
