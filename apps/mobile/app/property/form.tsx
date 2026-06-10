import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useRecord } from "@/lib/hooks/useRecord";
import { fetchPropertyDetail, type PropertyDetail } from "@/lib/records/property";
import {
  PropertyForm,
  propertyFormToApiBody,
  EMPTY_PROPERTY_FORM,
  type PropertyFormValues,
} from "@/components/PropertyForm";
import { ResultModal } from "@/components/ui";

/**
 * Crear o editar un inmueble a mano. Sin `id` → crear (POST /api/properties).
 * Con `?id=` → editar (PATCH /api/properties/[id]). Reutiliza PropertyForm.
 */
const centsToEur = (c: number | null): string => (c != null ? String(Math.round(c / 100)) : "");

function detailToForm(p: PropertyDetail): PropertyFormValues {
  const op = (p.operationType as PropertyFormValues["operationType"]) ?? "SALE";
  return {
    ...EMPTY_PROPERTY_FORM,
    title: p.title,
    type: p.type,
    operationType: op,
    status: p.status,
    priceEur: centsToEur(p.currentPrice),
    rentEur: centsToEur(p.monthlyRent),
    city: p.city ?? "",
    province: p.province ?? "",
    address: p.address ?? "",
    neighborhood: p.neighborhood ?? "",
    postalCode: "",
    rooms: p.rooms != null ? String(p.rooms) : "",
    bathrooms: p.bathrooms != null ? String(p.bathrooms) : "",
    builtArea: p.builtArea != null ? String(p.builtArea) : "",
    usableArea: p.usableArea != null ? String(p.usableArea) : "",
    plotArea: p.plotArea != null ? String(p.plotArea) : "",
    floor: p.floor ?? "",
    yearBuilt: p.yearBuilt != null ? String(p.yearBuilt) : "",
    energyRating: p.energyRating ?? "UNKNOWN",
    hasElevator: !!p.hasElevator,
    hasGarage: !!p.hasGarage,
    hasStorage: !!p.hasStorage,
    hasTerrace: !!p.hasTerrace,
    hasFireplace: !!p.hasFireplace,
    hasGarden: !!p.hasGarden,
    hasPool: !!p.hasPool,
    depositEur: centsToEur(p.deposit),
    minStayMonths: p.minStayMonths != null ? String(p.minStayMonths) : "",
    maxStayMonths: p.maxStayMonths != null ? String(p.maxStayMonths) : "",
    furnished: p.furnished ?? "",
    utilitiesIncluded: p.utilitiesIncluded ?? null,
    petsAllowed: p.petsAllowed ?? null,
    contractType: p.contractType ?? "",
    description: p.description ?? "",
    notes: "",
  };
}

export default function PropertyFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { th } = useTheme();
  const { t } = useTranslation();
  const isEdit = !!id;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: detail, error: loadError } = useRecord<PropertyDetail>(
    () => fetchPropertyDetail(id!),
    [id],
    { enabled: isEdit }
  );

  const headerTitle = isEdit ? t("form.edit_title") : t("form.create_title");
  const screenOpts = { title: headerTitle, headerTintColor: th.primary, headerStyle: { backgroundColor: th.surface } };

  async function submit(values: PropertyFormValues) {
    setSaving(true);
    setError(null);
    try {
      const body = propertyFormToApiBody(values);
      if (isEdit) {
        await api(`/api/properties/${id}`, { method: "PATCH", body: JSON.stringify(body) });
        router.replace(`/property/${id}`);
      } else {
        const created = await api<{ id: string }>("/api/properties", {
          method: "POST",
          body: JSON.stringify(body),
        });
        router.replace(`/property/${created.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("form.save_error"));
      setSaving(false);
    }
  }

  // Editar pero el detalle aún no llegó → loader.
  if (isEdit && !detail && !loadError) {
    return (
      <View style={[styles.center, { backgroundColor: th.bg }]}>
        <Stack.Screen options={screenOpts} />
        <ActivityIndicator color={th.primary} />
      </View>
    );
  }

  const initial = isEdit && detail ? detailToForm(detail) : EMPTY_PROPERTY_FORM;

  return (
    <View style={[styles.container, { backgroundColor: th.bg }]}>
      <Stack.Screen options={screenOpts} />
      <PropertyForm
        initial={initial}
        submitting={saving}
        submitLabel={isEdit ? t("form.save") : t("form.create")}
        onSubmit={submit}
      />
      <ResultModal
        visible={!!error}
        tone="error"
        title={t("form.save_error")}
        message={error ?? undefined}
        actions={[{ label: t("common.understood"), onPress: () => setError(null) }]}
        onRequestClose={() => setError(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
