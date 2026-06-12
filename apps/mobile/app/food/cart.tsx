import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFoodCart } from "@/lib/food-cart-context";
import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { Button, Card, EmptyState, Screen } from "@/components/ui";

function money(cents: number) {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export default function FoodCartScreen() {
  const cart = useFoodCart();
  const { th } = useTheme();
  if (!cart.items.length) {
    return (
      <Screen title="Carrito">
        <EmptyState icon="cart-outline" title="Carrito vacío" description="Añade platos desde un restaurante." />
      </Screen>
    );
  }
  return (
    <Screen title="Carrito" subtitle={cart.restaurantName ?? undefined}>
      <ScrollView contentContainerStyle={styles.content}>
        {cart.items.map((item) => (
          <Card key={item.menuItemId} style={styles.line}>
            <View style={styles.lineTop}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: th.text }]}>{item.name}</Text>
                <Text style={[styles.meta, { color: th.accent }]}>{money(item.priceCents)}</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable onPress={() => cart.updateQuantity(item.menuItemId, item.quantity - 1)} style={[styles.step, { borderColor: th.border }]}>
                  <Text style={{ color: th.text }}>−</Text>
                </Pressable>
                <Text style={[styles.qty, { color: th.text }]}>{item.quantity}</Text>
                <Pressable onPress={() => cart.updateQuantity(item.menuItemId, item.quantity + 1)} style={[styles.step, { borderColor: th.border }]}>
                  <Text style={{ color: th.text }}>+</Text>
                </Pressable>
              </View>
            </View>
            <TextInput
              value={item.notes ?? ""}
              onChangeText={(v) => cart.updateNotes(item.menuItemId, v)}
              placeholder="Notas para este plato"
              placeholderTextColor={th.textSubtle}
              style={[styles.notes, { color: th.text, borderColor: th.border }]}
            />
          </Card>
        ))}
        <Card>
          <Text style={[styles.total, { color: th.text }]}>Subtotal {money(cart.totalCents)}</Text>
          <Text style={[styles.meta, { color: th.textMuted }]}>El total final se recalcula en el servidor antes del pago.</Text>
        </Card>
        <Button label="Continuar" onPress={() => router.push("/food/checkout")} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  line: { gap: 10 },
  lineTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 15, fontFamily: fonts.bodyBold },
  meta: { fontSize: 12, marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  step: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  qty: { minWidth: 18, textAlign: "center", fontFamily: fonts.bodyBold },
  notes: { height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12 },
  total: { fontSize: 16, fontFamily: fonts.bodyBold },
});
