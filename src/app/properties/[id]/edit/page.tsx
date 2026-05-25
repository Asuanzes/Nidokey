import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Button, PageHeader } from "@/components/ui";
import { PropertyForm } from "@/features/properties/PropertyForm";
import { requireUserId } from "@/lib/auth-helpers";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ownerId = await requireUserId();
  const property = await prisma.property.findFirst({ where: { id, ownerId } });
  if (!property) notFound();

  return (
    <>
      <PageHeader
        title="Editar inmueble"
        description={property.title}
        actions={
          <Link href={`/properties/${id}`}>
            <Button variant="ghost" size="sm">← Volver al detalle</Button>
          </Link>
        }
      />
      <PropertyForm mode="edit" id={id} initial={property as unknown as Record<string, unknown>} />
    </>
  );
}
