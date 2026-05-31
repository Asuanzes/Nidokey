import { Screen, EmptyState } from "@/components/ui";

export default function DashboardScreen() {
  return (
    <Screen>
      <EmptyState
        icon="grid-outline"
        title="Próximamente"
        description="El panel de KPIs llegará en una próxima actualización."
      />
    </Screen>
  );
}
