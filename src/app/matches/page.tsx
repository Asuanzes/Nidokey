import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sparkles } from "lucide-react";
import { MatchesList } from "@/features/matching/MatchesList";
import { requireUserId } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const ownerId = await requireUserId();
  // 1. Cogemos IDs de Properties del usuario
  const myProps = await prisma.property.findMany({
    where: { ownerId },
    select: { id: true },
  });
  const myIdSet = new Set(myProps.map((p) => p.id));
  if (myIdSet.size === 0) {
    return (
      <>
        <PageHeader title="Posibles duplicados" description="0 pares pendientes de revisión" />
        <EmptyState
          icon={<Sparkles size={28} />}
          title="Aún no hay inmuebles"
          description="Importa anuncios desde los portales y aquí aparecerán posibles duplicados."
        />
      </>
    );
  }

  const suggestions = await prisma.matchSuggestion.findMany({
    where: {
      dismissedAt: null,
      score: { gte: 60 },
      sourceId: { in: Array.from(myIdSet) },
    },
    orderBy: { score: "desc" },
    take: 100,
  });

  const ids = Array.from(new Set(suggestions.flatMap((s) => [s.sourceId, s.targetId])));
  const props = ids.length
    ? await prisma.property.findMany({
        where: { id: { in: ids }, ownerId },
        include: {
          media: { take: 1, where: { kind: "PHOTO" }, orderBy: { order: "asc" } },
          listings: { select: { portal: true, url: true } },
        },
      })
    : [];
  const byId = new Map(props.map((p) => [p.id, p]));

  type Item = {
    id: string;
    score: number;
    reasons: string[];
    source: NonNullable<ReturnType<typeof byId.get>>;
    target: NonNullable<ReturnType<typeof byId.get>>;
  };
  const items = suggestions
    .filter((s) => byId.has(s.sourceId) && byId.has(s.targetId))
    .map((s) => ({
      id: s.id,
      score: s.score,
      reasons: s.reasons,
      source: byId.get(s.sourceId)!,
      target: byId.get(s.targetId)!,
    })) as Item[];

  return (
    <>
      <PageHeader
        title="Posibles duplicados"
        description={`${items.length} pares pendientes de revisión`}
      />
      {items.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={28} />}
          title="No hay duplicados pendientes"
          description="Cuando importes nuevos inmuebles que parezcan iguales a otros existentes, aparecerán aquí para fusionar o descartar."
        />
      ) : (
        <MatchesList items={items} />
      )}
    </>
  );
}
