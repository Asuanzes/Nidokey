import { Stack } from "expo-router";
import { AssetDetail } from "@/components/AssetDetail";

/** Detalle de una cripto — estilo Yahoo. */
export default function CryptoDetailScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AssetDetail type="crypto" />
    </>
  );
}
