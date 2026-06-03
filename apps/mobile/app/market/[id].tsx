import { Stack } from "expo-router";
import { AssetDetail } from "@/components/AssetDetail";

/** Detalle de un instrumento de mercado (acción/ETF/fondo) — estilo Yahoo. */
export default function MarketDetailScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AssetDetail type="market" />
    </>
  );
}
