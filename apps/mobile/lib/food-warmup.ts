import { useEffect } from "react";
import { api } from "@/lib/api";

/**
 * Calentamiento de menús al arrancar la app.
 *
 * Una vez por arranque (cold start), si estás logueado, dispara en silencio el
 * descubrimiento de restaurantes en tu dirección por defecto. El servidor, al
 * responder, pre-calienta en background los menús de las cocinas que más se piden
 * a domicilio (pizza/burger/sushi/mexicano…) → al entrar en Comida ya están casi
 * listos. Fire-and-forget: no bloquea el arranque y, si falla, el pre-warm normal
 * al abrir Comida sigue valiendo.
 */
let warmed = false; // módulo-level: una sola vez por proceso (no re-dispara en re-renders/tabs)

type FoodAddress = { latitude: number; longitude: number; isDefault: boolean };

export function useFoodWarmup(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || warmed) return;
    warmed = true;
    void (async () => {
      try {
        const { addresses } = await api<{ addresses: FoodAddress[] }>("/api/food/addresses");
        const addr = addresses.find((a) => a.isDefault) ?? addresses[0];
        if (!addr) return;
        const qs = new URLSearchParams({ lat: String(addr.latitude), lng: String(addr.longitude) });
        await api(`/api/food/restaurants?${qs.toString()}`); // el server dispara el prewarm
      } catch {
        // best-effort
      }
    })();
  }, [enabled]);
}
