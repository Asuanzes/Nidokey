import { Card, CardBody, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { BRAND_ICONS, IconKey, type BrandIconKey } from "@/components/brand/icons";

const ACCENTS = [
  { name: "Latón envejecido", hex: "#C49A4D", note: "Cálido, ennoblecido (actual)" },
  { name: "Cobre bruñido",    hex: "#A85F2E", note: "Más rojizo, intenso" },
  { name: "Oro viejo",        hex: "#A8893A", note: "Sobrio, casi oliva" },
  { name: "Verdigris",        hex: "#7A9080", note: "Cobre oxidado, inesperado" },
];

export default function BrandPage() {
  const keys = Object.keys(BRAND_ICONS) as BrandIconKey[];

  return (
    <>
      <PageHeader
        title="Iconos de marca"
        description="Propuestas para la identidad de BuySell Asturias. Las llenas heredan el primario; los acentos llevan color propio."
      />

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-subtle">
          Variantes de acento — Llave medieval
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {ACCENTS.map((a) => (
            <div
              key={a.hex}
              style={{ ["--brand-accent" as string]: a.hex }}
              className="rounded-lg border border-border bg-surface p-4 shadow-xs"
            >
              {/* Chip estilo sidebar */}
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-fg">
                  <IconKey size={20} />
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-semibold text-text">BuySell</div>
                  <div className="text-[10px] text-text-subtle">Asturias</div>
                </div>
              </div>

              {/* Escala grande sobre bg para verlo solo */}
              <div className="flex items-center justify-center rounded-md bg-bg py-4 text-primary">
                <IconKey size={48} />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm border border-border" style={{ background: a.hex }} />
                <div className="leading-tight">
                  <div className="text-xs font-medium text-text">{a.name}</div>
                  <div className="text-[10px] text-text-subtle">{a.hex.toUpperCase()} · {a.note}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-subtle">
        Catálogo completo
      </h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {keys.map((k) => {
          const { component: Icon, label, note } = BRAND_ICONS[k];
          return (
            <Card key={k}>
              <CardHeader>
                <div>
                  <CardTitle>{label}</CardTitle>
                  <p className="mt-0.5 text-xs text-text-muted">{note}</p>
                </div>
                <code className="rounded bg-surface-muted px-2 py-0.5 text-[11px] text-text-muted">
                  Icon{label.replace(/[^A-Za-z]/g, "")}
                </code>
              </CardHeader>
              <CardBody className="space-y-6">
                {/* Escalas */}
                <div className="flex items-end justify-between gap-6 rounded-md border border-border bg-bg p-6 text-primary">
                  <div className="flex flex-col items-center gap-2">
                    <Icon size={16} />
                    <span className="text-[10px] text-text-subtle">16</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Icon size={24} />
                    <span className="text-[10px] text-text-subtle">24</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Icon size={36} />
                    <span className="text-[10px] text-text-subtle">36</span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Icon size={56} />
                    <span className="text-[10px] text-text-subtle">56</span>
                  </div>
                </div>

                {/* Variantes de aplicación */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Chip blanco */}
                  <div className="rounded-md border border-border bg-surface p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-fg">
                        <Icon size={15} />
                      </div>
                      <div className="leading-tight">
                        <div className="text-xs font-semibold text-text">BuySell</div>
                        <div className="text-[10px] text-text-subtle">Asturias</div>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-text-subtle">Sidebar (filled)</p>
                  </div>

                  {/* Outline en blanco */}
                  <div className="rounded-md border border-border bg-surface p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-md border border-primary/30 bg-primary-soft text-primary">
                        <Icon size={15} />
                      </div>
                      <div className="leading-tight">
                        <div className="text-xs font-semibold text-text">BuySell</div>
                        <div className="text-[10px] text-text-subtle">Asturias</div>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] text-text-subtle">Sidebar (soft)</p>
                  </div>

                  {/* Sobre fondo primario */}
                  <div className="rounded-md bg-primary p-3 text-primary-fg">
                    <div className="flex items-center gap-2">
                      <Icon size={20} />
                      <div className="leading-tight">
                        <div className="text-xs font-semibold">BuySell</div>
                        <div className="text-[10px] opacity-70">Asturias</div>
                      </div>
                    </div>
                    <p className="mt-2 text-[10px] opacity-70">Sobre primario</p>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <p className="mt-8 text-xs text-text-subtle">
        Cuando elijas uno, lo cableamos en <code>AppShell</code> y generamos el favicon.
      </p>
    </>
  );
}
