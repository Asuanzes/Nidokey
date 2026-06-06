import { useTranslation } from "react-i18next";
import { Screen, EmptyState } from "@/components/ui";

export default function ActividadScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <EmptyState
        icon="pulse-outline"
        title={t("common.soon")}
        description={t("screens.activity_desc")}
      />
    </Screen>
  );
}
