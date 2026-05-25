import Link from "next/link";
import { Button, PageHeader } from "@/components/ui";
import { PropertyForm } from "@/features/properties/PropertyForm";

export default function NewPropertyPage() {
  return (
    <>
      <PageHeader
        title="Nuevo inmueble"
        description="Rellena los datos esenciales; podrás añadir fotos y anuncios después."
        actions={
          <Link href="/properties">
            <Button variant="ghost" size="sm">← Volver</Button>
          </Link>
        }
      />
      <PropertyForm mode="create" />
    </>
  );
}
