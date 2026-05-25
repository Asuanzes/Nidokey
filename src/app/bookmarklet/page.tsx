import { PageHeader } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-static";

export default function BookmarkletPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Importador de anuncios"
        description="Instala el script una vez con Tampermonkey. A partir de ahí, en cada anuncio de Idealista verás un botón flotante para importar la ficha a BuySell."
      />

      <Card>
        <div className="space-y-5 p-6">
          <div>
            <div className="mb-2 text-sm font-medium text-text">
              1. Instala la extensión Tampermonkey
            </div>
            <p className="text-sm text-text-muted">
              Necesaria porque Idealista bloquea bookmarklets vía Content-Security-Policy. Tampermonkey ejecuta el script en contexto privilegiado, fuera del CSP de la página.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href="https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-muted"
              >
                Chrome / Edge / Brave
              </a>
              <a
                href="https://addons.mozilla.org/firefox/addon/tampermonkey/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-surface-muted"
              >
                Firefox
              </a>
            </div>
            <p className="mt-2 text-xs text-text-subtle">
              Si usas Firefox, también vale <a href="https://violentmonkey.github.io/" target="_blank" rel="noreferrer" className="text-primary hover:underline">Violentmonkey</a> (open source).
            </p>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-text">
              2. Instala el script de BuySell
            </div>
            <p className="text-sm text-text-muted">
              Con Tampermonkey ya activo, abre este enlace y pulsa <strong>“Instalar”</strong>:
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                { slug: "idealista", label: "Idealista" },
                { slug: "fotocasa", label: "Fotocasa" },
                { slug: "pisos", label: "Pisos.com" },
                { slug: "habitaclia", label: "Habitaclia" },
                { slug: "yaencontre", label: "Yaencontre" },
                { slug: "thinkspain", label: "ThinkSPAIN" },
                { slug: "indomio", label: "Indomio" },
              ].map((s) => (
                <a
                  key={s.slug}
                  href={`/api/bookmarklet/${s.slug}.user.js`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg shadow-sm hover:bg-primary-hover"
                >
                  📥 Instalar script {s.label}
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-subtle">
              Tampermonkey detectará el <code className="rounded bg-surface-muted px-1">.user.js</code> y te mostrará la pantalla de instalación con los permisos.
            </p>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-text">
              3. Abre cualquier anuncio de Idealista
            </div>
            <p className="text-sm text-text-muted">
              Por ejemplo:{" "}
              <a
                href="https://www.idealista.com/inmueble/111138696/"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                idealista.com/inmueble/111138696/
              </a>
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Verás un botón flotante <strong>“📥 Importar a BuySell”</strong> abajo a la derecha. Púlsalo.
            </p>
            <ul className="mt-2 space-y-1 text-sm text-text-muted">
              <li>✅ <span className="text-text">Inmueble creado</span> — primera importación.</li>
              <li>💶 <span className="text-text">Precio actualizado</span> — ya existía y ha cambiado el precio.</li>
              <li>👌 <span className="text-text">Ya existía, sin cambios</span> — re-importación sin novedad.</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-2 p-6 text-sm text-text-muted">
          <div className="font-medium text-text">Notas técnicas</div>
          <ul className="list-inside list-disc space-y-1">
            <li>El script usa <code className="rounded bg-surface-muted px-1">GM_xmlhttpRequest</code>, que se salta CORS y CSP del sitio.</li>
            <li>Apunta a <code className="rounded bg-surface-muted px-1">http://localhost:4200</code>. Si despliegas la app, edita la constante <code className="rounded bg-surface-muted px-1">API</code> dentro de Tampermonkey.</li>
            <li>Idealista cambia clases CSS periódicamente. Si algún campo deja de extraerse, ajustamos selectores en <code className="rounded bg-surface-muted px-1">public/bookmarklet/buysell-idealista.user.js</code> y vuelves a instalar.</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
