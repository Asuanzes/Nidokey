import { getItem, setItem } from "@/lib/secure-store";

/**
 * Flag local "onboarding completado" (primer inicio). Persiste SIN exponer el
 * email: guarda solo "1" bajo una clave fija en SecureStore (no email ni datos del
 * usuario). Funciona como doble seguro junto al flag de servidor
 * `User.onboardingCompletedAt` (que verify devuelve como `needsOnboarding`):
 *  - LECTURA: `app/_layout.tsx` (AuthGate) decide si redirige a `/onboarding`.
 *  - ESCRITURA: al terminar (`app/onboarding.tsx` → finish → markOnboardingComplete)
 *    y en `verifyOtp` si el servidor indica que no hace falta onboarding.
 *  - LIMPIEZA: `logout` (auth-context) borra esta clave para no heredarla entre
 *    cuentas distintas en el mismo dispositivo.
 * Efecto: el onboarding se muestra solo en el PRIMER login; los siguientes van
 * directos al home.
 */
export const ONBOARDING_DONE_KEY = "nidokey.onboarding.done";

export async function getOnboardingDone(): Promise<boolean> {
  return (await getItem(ONBOARDING_DONE_KEY)) === "1";
}

export async function setOnboardingDone(): Promise<void> {
  await setItem(ONBOARDING_DONE_KEY, "1");
}
