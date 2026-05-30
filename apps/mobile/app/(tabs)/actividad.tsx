import { Screen, EmptyState } from "@/components/ui";

export default function ActividadScreen() {
  return (
    <Screen title="Actividad">
      <EmptyState
        icon="pulse-outline"
        title="Próximamente"
        description="El historial de cambios de precio llegará en una próxima actualización."
      />
    </Screen>
  );
}
