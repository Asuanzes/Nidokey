import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { useQuery } from "@/lib/hooks/useQuery";
import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { Card, EmptyState } from "@/components/ui";
import { categoryColor } from "@/lib/records/config";

type FoodAddress = {
  id: string;
  label: string;
  line: string;
  city: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
};

type Restaurant = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isOpen: boolean;
  deliveryFeeCents: number;
  minOrderCents: number;
  distanceM: number;
  types?: string[];
};

type FoodOrder = { id: string; code: string; status: string; restaurant?: { name: string } | null };

function money(cents: number) {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

const FALLBACK_CHIPS = ["Pizza", "Sushi", "Burger", "Cafe"];
const TYPE_LABELS: Record<string, string> = {
  bakery: "Panaderia",
  bar: "Bar",
  breakfast_restaurant: "Desayunos",
  brunch_restaurant: "Brunch",
  cafe: "Cafe",
  coffee_shop: "Cafe",
  fast_food_restaurant: "Fast food",
  hamburger_restaurant: "Burger",
  ice_cream_shop: "Helados",
  italian_restaurant: "Italiana",
  japanese_restaurant: "Japonesa",
  meal_delivery: "Delivery",
  meal_takeaway: "Para llevar",
  mexican_restaurant: "Mexicana",
  pizza_restaurant: "Pizza",
  seafood_restaurant: "Marisco",
  spanish_restaurant: "Espanola",
  steak_house: "Carne",
  sushi_restaurant: "Sushi",
};
const IGNORED_TYPES = new Set(["establishment", "food", "point_of_interest", "restaurant"]);

function chipFromType(type: string): string | null {
  if (IGNORED_TYPES.has(type)) return null;
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  const label = type
    .replace(/_restaurant$/, "")
    .replace(/_/g, " ")
    .trim();
  if (!label) return null;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function FoodHome() {
  const { th, dark } = useTheme();
  const { t } = useTranslation();
  const foodAccent = categoryColor("food", dark);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const addressesQ = useQuery(() => api<{ addresses: FoodAddress[] }>("/api/food/addresses"), [], { resetOnDepsChange: true });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => {
    const addresses = addressesQ.data?.addresses ?? [];
    return addresses.find((a) => a.id === selectedId) ?? addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
  }, [addressesQ.data, selectedId]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const restaurantsQ = useQuery(
    () => {
      if (!selected) return Promise.resolve({ restaurants: [] as Restaurant[] });
      const qs = new URLSearchParams({
        lat: String(selected.latitude),
        lng: String(selected.longitude),
        ...(debounced.trim() ? { q: debounced.trim() } : {}),
      });
      return api<{ restaurants: Restaurant[] }>(`/api/food/restaurants?${qs.toString()}`);
    },
    [selected?.id, debounced],
    { enabled: !!selected, resetOnDepsChange: true }
  );

  const activeQ = useQuery(
    () => api<{ orders: FoodOrder[] }>("/api/food/orders?role=customer&active=1"),
    [],
    { refreshInterval: 60_000 }
  );

  const cuisineChips = useMemo(() => {
    const seen = new Set<string>();
    const chips: string[] = [];
    for (const restaurant of restaurantsQ.data?.restaurants ?? []) {
      for (const type of restaurant.types ?? []) {
        const chip = chipFromType(type);
        if (!chip || seen.has(chip)) continue;
        seen.add(chip);
        chips.push(chip);
        if (chips.length >= 6) return chips;
      }
    }
    return chips.length ? chips : FALLBACK_CHIPS;
  }, [restaurantsQ.data]);

  if (addressesQ.loading && !addressesQ.data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={th.primary} />
      </View>
    );
  }

  if (!selected) {
    return (
      <EmptyState
        icon="location-outline"
        title="Añade una dirección"
        description="La comida necesita una dirección de entrega para mostrar restaurantes cercanos."
        actionLabel="Añadir dirección"
        onAction={() => router.push("/food/address")}
      />
    );
  }

  const activeOrder = activeQ.data?.orders?.[0] ?? null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          style={[
            styles.addressPanel,
            th.elevation.sm,
            { backgroundColor: th.surfaceRaised, borderColor: th.border },
          ]}
          onPress={() => router.push("/food/address")}
        >
          <View style={[styles.headerIcon, { backgroundColor: th.accentSoft }]}>
            <Ionicons name="location-outline" size={18} color={foodAccent} />
          </View>
          <View style={styles.addressText}>
            <Text style={[styles.addressEyebrow, { color: th.textSubtle }]} numberOfLines={1}>
              {t("food.address")}
            </Text>
            <Text style={[styles.addressLabel, { color: th.text }]} numberOfLines={1}>
              {selected.label || t("food.address")}
            </Text>
            <Text style={[styles.addressLine, { color: th.textSubtle }]} numberOfLines={1}>
              {selected.line}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={th.textSubtle} />
        </Pressable>
        <Pressable
          style={[
            styles.ordersPanel,
            th.elevation.sm,
            { backgroundColor: th.surfaceRaised, borderColor: th.border },
          ]}
          onPress={() => router.push("/food/orders")}
        >
          <Ionicons name="receipt-outline" size={18} color={foodAccent} />
          <Text style={[styles.ordersLabel, { color: th.text }]} numberOfLines={1}>
            {t("food.orders")}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {activeOrder && (
          <Pressable onPress={() => router.push(`/food/order/${activeOrder.id}`)}>
          <Card style={[styles.activeOrder, { borderColor: foodAccent }]}>
              <Text style={[styles.activeTitle, { color: th.text }]}>{activeOrder.restaurant?.name ?? "Pedido en curso"}</Text>
              <Text style={[styles.activeMeta, { color: th.textMuted }]}>{activeOrder.code} · {activeOrder.status}</Text>
            </Card>
          </Pressable>
        )}

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar restaurante o cocina"
          placeholderTextColor={th.textSubtle}
          style={[
            styles.search,
            th.elevation.sm,
            { color: th.text, borderColor: th.border, backgroundColor: th.surface },
          ]}
        />

        <View style={styles.chips}>
          {cuisineChips.map((chip) => (
            <Pressable
              key={chip}
              onPress={() => setQuery(chip)}
              style={[styles.chip, th.elevation.sm, { backgroundColor: th.surface, borderColor: th.border }]}
            >
              <Text style={[styles.chipText, { color: foodAccent }]}>{chip}</Text>
            </Pressable>
          ))}
        </View>

        {restaurantsQ.loading && !restaurantsQ.data ? (
          <ActivityIndicator color={th.primary} />
        ) : restaurantsQ.data?.restaurants.length ? (
          restaurantsQ.data.restaurants.map((restaurant) => (
            <Pressable key={restaurant.id} onPress={() => router.push(`/food/restaurant/${restaurant.id}`)}>
              <Card style={[styles.restaurant, { borderColor: restaurant.isOpen ? th.border : th.dangerSoft }]}>
                <Image source={restaurant.imageUrl ? { uri: restaurant.imageUrl } : undefined} style={[styles.photo, { backgroundColor: th.imagePlaceholder }]} contentFit="cover" />
                <View style={styles.restaurantInfo}>
                  <View style={styles.row}>
                    <Text style={[styles.restaurantName, { color: th.text }]} numberOfLines={1}>{restaurant.name}</Text>
                    {!restaurant.isOpen && (
                      <Text style={[styles.closed, { color: th.dangerFg, backgroundColor: th.dangerSoft }]}>Cerrado</Text>
                    )}
                  </View>
                  <Text style={[styles.desc, { color: th.textMuted }]} numberOfLines={2}>{restaurant.description ?? "Carta disponible"}</Text>
                  <Text style={[styles.meta, { color: th.textSubtle }]}>
                    {(restaurant.distanceM / 1000).toFixed(1)} km · Envío {money(restaurant.deliveryFeeCents)}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))
        ) : (
          <EmptyState icon="restaurant-outline" title="Sin restaurantes cerca" description="Prueba otra búsqueda o dirección." />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "stretch", paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  addressPanel: {
    flex: 1,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  headerIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  addressText: { flex: 1, minWidth: 0 },
  addressEyebrow: { fontSize: 10, lineHeight: 13, fontFamily: fonts.bodySemibold, textTransform: "uppercase" },
  addressLabel: { fontSize: 15, fontFamily: fonts.bodyBold },
  addressLine: { fontSize: 12, marginTop: 1 },
  ordersPanel: {
    width: 104,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 8,
  },
  ordersLabel: { fontSize: 11, lineHeight: 14, fontFamily: fonts.bodySemibold, textAlign: "center" },
  content: { padding: 12, gap: 10, paddingBottom: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  search: { height: 46, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  chipText: { fontSize: 12, fontFamily: fonts.bodySemibold },
  activeOrder: { gap: 2 },
  activeTitle: { fontSize: 15, fontFamily: fonts.bodyBold },
  activeMeta: { fontSize: 12 },
  restaurant: { flexDirection: "row", gap: 12, padding: 10 },
  photo: { width: 74, height: 74, borderRadius: 8 },
  restaurantInfo: { flex: 1, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  restaurantName: { flex: 1, fontSize: 16, fontFamily: fonts.bodyBold },
  closed: { fontSize: 12, fontFamily: fonts.bodyBold },
  desc: { fontSize: 13, lineHeight: 18 },
  meta: { fontSize: 12 },
});
