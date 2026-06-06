import { useTranslation } from "react-i18next";
import { Screen, EmptyState } from "@/components/ui";

export default function DashboardScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <EmptyState
        icon="grid-outline"
        title={t("common.soon")}
        description={t("screens.dashboard_desc")}
      />
    </Screen>
  );
}
