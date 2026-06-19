import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/lib/theme";

/**
 * Sello "verificado" de la cuenta oficial (NIDOKEY). El @alias del bot está
 * reservado en @nidokey/shared y el nombre visible se valida en PATCH /api/account
 * (isProtectedName) → nadie más puede llamarse así; el badge es la señal visual.
 */
const OFFICIAL_USERNAME = "nidokey";

export function isOfficialUsername(username?: string | null): boolean {
  return username === OFFICIAL_USERNAME;
}

/** ¿La conversación es el DM con la cuenta oficial? (alguno de sus participantes es el bot). */
export function isOfficialConversation(
  c?: { participants?: { user: { username: string | null } }[] } | null,
): boolean {
  return !!c?.participants?.some((p) => isOfficialUsername(p.user.username));
}

export function VerifiedBadge({ size = 15 }: { size?: number }) {
  const { th } = useTheme();
  return <Ionicons name="checkmark-circle" size={size} color={th.accent} accessibilityLabel="Cuenta oficial" />;
}
