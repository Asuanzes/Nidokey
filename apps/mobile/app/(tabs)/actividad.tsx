import { Screen, EmptyState } from "@/components/ui";

export default function ActividadScreen() {
  return (
    <Screen>
      <EmptyState
        icon="pulse-outline"
        title="Próximamente"
        description="El historial de cambios de precio llegará en una próxima actualización."
      />
    </Screen>
  );
}
