import { router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { api } from "@/lib/api";
import { useQuery } from "@/lib/hooks/useQuery";
import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { Card, EmptyState, Screen } from "@/components/ui";

type Order = { id: string; code: string; status: string; totalCents: number; currency: string; createdAt: string; restaurant?: { name: string } | null };

function money(cents: number, currency = "EUR") {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency });
}

export default function FoodOrdersScreen() {
  const { th } = useTheme();
  const q = useQuery(() => api<{ orders: Order[] }>("/api/food/orders?role=customer"), []);
  return (
    <Screen title="Mis pedidos">
      <ScrollView contentContainerStyle={styles.content}>
        {q.loading && !q.data ? <ActivityIndicator color={th.primary} /> : q.data?.orders.length ? q.data.orders.map((o) => (
          <Pressable key={o.id} onPress={() => router.push(`/food/order/${o.id}`)}>
            <Card>
              <Text style={[styles.title, { color: th.text }]}>{o.restaurant?.name ?? "Pedido"}</Text>
              <Text style={[styles.meta, { color: th.textMuted }]}>{new Date(o.createdAt).toLocaleDateString("es-ES")} · {o.code}</Text>
              <Text style={[styles.total, { color: th.accent }]}>{o.status} · {money(o.totalCents, o.currency)}</Text>
            </Card>
          </Pressable>
        )) : <EmptyState icon="receipt-outline" title="Sin pedidos" description="Tus pedidos aparecerán aquí." />}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  title: { fontSize: 15, fontFamily: fonts.bodyBold },
  meta: { fontSize: 12, marginTop: 3 },
  total: { fontSize: 13, fontFamily: fonts.bodyBold, marginTop: 6 },
});
