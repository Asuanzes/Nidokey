import { useLocalSearchParams, router } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { api } from "@/lib/api";
import { useQuery } from "@/lib/hooks/useQuery";
import { useFoodCart } from "@/lib/food-cart-context";
import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { Button, Card, Screen } from "@/components/ui";

type MenuItem = { id: string; name: string; description: string | null; imageUrl: string | null; priceCents: number; available: boolean };
type MenuCategory = { id: string; name: string; items: MenuItem[] };
type Restaurant = { id: string; name: string; description: string | null; imageUrl: string | null; isOpen: boolean; categories: MenuCategory[] };

function money(cents: number) {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { th } = useTheme();
  const cart = useFoodCart();
  const q = useQuery(() => api<{ restaurant: Restaurant }>(`/api/food/restaurants/${id}`), [id], { resetOnDepsChange: true });

  if (q.loading && !q.data) {
    return (
      <Screen>
        <View style={styles.center}><ActivityIndicator color={th.primary} /></View>
      </Screen>
    );
  }
  const restaurant = q.data?.restaurant;
  if (!restaurant) return <Screen title="Restaurante"><Text style={{ color: th.text }}>No encontrado</Text></Screen>;

  function add(item: MenuItem) {
    if (cart.restaurantId && cart.restaurantId !== restaurant!.id) cart.clear();
    cart.addItem(restaurant!.id, restaurant!.name, { menuItemId: item.id, name: item.name, priceCents: item.priceCents });
  }

  return (
    <Screen title={restaurant.name} subtitle={restaurant.isOpen ? restaurant.description ?? "Carta" : "Cerrado"}>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={restaurant.imageUrl ? { uri: restaurant.imageUrl } : undefined} style={[styles.hero, { backgroundColor: th.imagePlaceholder }]} contentFit="cover" />
        {restaurant.categories.map((cat) => (
          <View key={cat.id} style={styles.category}>
            <Text style={[styles.categoryTitle, { color: th.text }]}>{cat.name}</Text>
            {cat.items.map((item) => (
              <Card key={item.id} style={styles.item}>
                <View style={styles.itemInfo}>
                  <Text style={[styles.itemName, { color: th.text }]}>{item.name}</Text>
                  {item.description && <Text style={[styles.desc, { color: th.textMuted }]}>{item.description}</Text>}
                  <Text style={[styles.price, { color: th.accent }]}>{money(item.priceCents)}</Text>
                </View>
                <Pressable disabled={!restaurant.isOpen} onPress={() => add(item)} style={[styles.add, { backgroundColor: th.primary, opacity: restaurant.isOpen ? 1 : 0.4 }]}>
                  <Text style={styles.addText}>+</Text>
                </Pressable>
              </Card>
            ))}
          </View>
        ))}
      </ScrollView>
      {cart.restaurantId === restaurant.id && cart.count > 0 && (
        <View style={[styles.bar, { backgroundColor: th.surface, borderTopColor: th.border }]}>
          <Button label={`Ver carrito · ${cart.count} · ${money(cart.totalCents)}`} onPress={() => router.push("/food/cart")} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 16, paddingBottom: 88 },
  hero: { height: 160, borderRadius: 10 },
  category: { gap: 8 },
  categoryTitle: { fontSize: 18, fontFamily: fonts.heading },
  item: { flexDirection: "row", alignItems: "center", gap: 12 },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 15, fontFamily: fonts.bodyBold },
  desc: { fontSize: 13, lineHeight: 18 },
  price: { fontSize: 14, fontFamily: fonts.bodyBold },
  add: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  addText: { color: "#fff", fontSize: 24, lineHeight: 26 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
