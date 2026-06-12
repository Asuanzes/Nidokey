import { useMemo, useState } from "react";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { api } from "@/lib/api";
import { useQuery } from "@/lib/hooks/useQuery";
import { API_URL } from "@/lib/api";
import { useFoodCart } from "@/lib/food-cart-context";
import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { Button, Card, EmptyState, Screen } from "@/components/ui";

type FoodAddress = { id: string; label: string; line: string; city: string };

function money(cents: number) {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export default function FoodCheckoutScreen() {
  const cart = useFoodCart();
  const { th } = useTheme();
  const addressesQ = useQuery(() => api<{ addresses: FoodAddress[] }>("/api/food/addresses"), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(() => addressesQ.data?.addresses.find((a) => a.id === selectedId) ?? addressesQ.data?.addresses[0] ?? null, [addressesQ.data, selectedId]);

  async function pay() {
    if (!cart.restaurantId || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const created = await api<{ order: { id: string } }>("/api/food/orders", {
        method: "POST",
        body: JSON.stringify({
          restaurantId: cart.restaurantId,
          clientId: `m_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          addressId: selected.id,
          items: cart.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, notes: i.notes })),
        }),
      });
      const paid = await api<{ checkoutUrl: string }>(`/api/food/orders/${created.order.id}/pay`, { method: "POST" });
      await WebBrowser.openAuthSessionAsync(paid.checkoutUrl, `${API_URL}/food/pay/return?orderId=${created.order.id}`);
      cart.clear();
      router.replace(`/food/order/${created.order.id}?from=payment`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar el pago");
    } finally {
      setBusy(false);
    }
  }

  if (!cart.items.length) {
    return (
      <Screen title="Checkout">
        <EmptyState icon="cart-outline" title="Carrito vacío" description="Añade platos antes de pagar." />
      </Screen>
    );
  }

  return (
    <Screen title="Checkout">
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={[styles.title, { color: th.text }]}>Entrega</Text>
          {addressesQ.loading && !addressesQ.data ? <ActivityIndicator color={th.primary} /> : addressesQ.data?.addresses.map((a) => {
            const selectedAddress = selected?.id === a.id;
            return (
              <Pressable key={a.id} onPress={() => setSelectedId(a.id)} style={[styles.address, { borderColor: selectedAddress ? th.accent : th.border }]}>
                <Text style={[styles.name, { color: th.text }]}>{a.label}</Text>
                <Text style={[styles.meta, { color: th.textMuted }]}>{a.line}</Text>
              </Pressable>
            );
          })}
          <Button label="Añadir dirección" variant="ghost" onPress={() => router.push("/food/address")} />
        </Card>
        <Card>
          <Text style={[styles.title, { color: th.text }]}>{cart.restaurantName}</Text>
          {cart.items.map((i) => (
            <Text key={i.menuItemId} style={[styles.meta, { color: th.textMuted }]}>
              {i.quantity} x {i.name} · {money(i.priceCents * i.quantity)}
            </Text>
          ))}
          <Text style={[styles.total, { color: th.text }]}>Subtotal {money(cart.totalCents)}</Text>
        </Card>
        {error && <Text style={[styles.error, { color: th.dangerFg }]}>{error}</Text>}
        <Button label="Pagar" loading={busy} disabled={!selected || busy} onPress={pay} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  title: { fontSize: 16, fontFamily: fonts.bodyBold, marginBottom: 8 },
  address: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 8 },
  name: { fontSize: 14, fontFamily: fonts.bodyBold },
  meta: { fontSize: 13, marginTop: 3 },
  total: { marginTop: 10, fontSize: 16, fontFamily: fonts.bodyBold },
  error: { fontSize: 13 },
});
