import { Card, CardBody, PageHeader } from "@/components/ui";
import { ImportForm } from "./ImportForm";

export const dynamic = "force-dynamic";

export default function ImportarPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Importar inmueble"
        description="Pega la URL de cualquier anuncio y lo añadimos automáticamente a tu catálogo."
      />

      <Card>
        <CardBody>
          <ImportForm />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="text-sm text-text-muted space-y-3">
          <div>
            <p className="font-medium text-text">Portales compatibles (scraping automático)</p>
            <p className="mt-1">Fotocasa · Pisos.com · Habitaclia · ThinkSPAIN · Indomio</p>
          </div>
          <div>
            <p className="font-medium text-text">No compatibles (anti-bot DataDome)</p>
            <p className="mt-1">
              Idealista · Milanuncios · Yaencontre — añádelos desde{" "}
              <a href="/properties/new" className="text-primary hover:underline">
                Nueva ficha
              </a>
              .
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
