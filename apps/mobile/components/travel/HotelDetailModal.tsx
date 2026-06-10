import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { formatMoney } from "@nidokey/shared";
import { api } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { Button } from "@/components/ui";

/**
 * "Explorar hotel" del asistente de Viajes: galería de fotos, estrellas,
 * descripción, servicios y la lista de HABITACIONES con su precio real
 * (GET /api/travel/hotel). El usuario revisa y elige una habitación (o el hotel
 * con su precio actual). Se queda DENTRO del asistente (modal), no navega fuera.
 */

type Room = { name: string; board: string | null; priceCents: number; currency: string };
type HotelInfo = {
  id: string;
  name: string;
  stars: number | null;
  description: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  images: string[];
  amenities: string[];
};

type Props = {
  visible: boolean;
  hotelId: string | null;
  /** Datos que ya tenemos de la lista (fallback mientras carga el detalle). */
  fallbackName: string;
  fallbackPriceCents: number;
  checkin: string;
  checkout: string;
  occupancies: { adults: number; children: number[] }[];
  onClose: () => void;
  /** Elegir: precio (céntimos) y etiqueta de habitación (o null = precio actual). */
  onChoose: (priceCents: number, roomName: string | null) => void;
};

export function HotelDetailModal({
  visible,
  hotelId,
  fallbackName,
  fallbackPriceCents,
  checkin,
  checkout,
  occupancies,
  onClose,
  onChoose,
}: Props) {
  const { th } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [hotel, setHotel] = useState<HotelInfo | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !hotelId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    setHotel(null);
    setRooms([]);
    (async () => {
      try {
        const qs = new URLSearchParams({ hotelId, checkin, checkout });
        qs.set("occupancies", JSON.stringify(occupancies.map((r) => ({ adults: r.adults, children: r.children }))));
        const r = await api<{ hotel: HotelInfo; rooms: Room[] }>(`/api/travel/hotel?${qs.toString()}`);
        if (!alive) return;
        setHotel(r.hotel);
        setRooms(r.rooms ?? []);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : t("travel.load_error"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, hotelId, checkin, checkout, occupancies]);

  const name = hotel?.name ?? fallbackName;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[styles.root, { backgroundColor: th.bg }]}>
        {/* Cabecera */}
        <View style={[styles.header, { borderBottomColor: th.border, backgroundColor: th.surface }]}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={th.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: th.text }]} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={th.primary} />
            </View>
          ) : null}

          {error ? <Text style={{ color: th.dangerFg }}>{error}</Text> : null}

          {/* Galería horizontal */}
          {hotel?.images && hotel.images.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
              {hotel.images.map((u) => (
                <Image key={u} source={{ uri: u }} style={styles.photo} contentFit="cover" transition={150} />
              ))}
            </ScrollView>
          ) : null}

          {/* Estrellas + ubicación */}
          <View style={{ gap: 4 }}>
            <Text style={[styles.name, { color: th.text }]}>{name}</Text>
            {hotel?.stars ? (
              <Text style={{ color: th.accent, fontSize: 14 }}>{"★".repeat(Math.round(hotel.stars))}</Text>
            ) : null}
            {hotel?.address || hotel?.city ? (
              <Text style={{ color: th.textMuted, fontSize: 13 }}>
                {[hotel?.address, hotel?.city, hotel?.country].filter(Boolean).join(", ")}
              </Text>
            ) : null}
          </View>

          {/* Descripción */}
          {hotel?.description ? (
            <Text style={[styles.desc, { color: th.textMuted }]}>{stripHtml(hotel.description)}</Text>
          ) : null}

          {/* Servicios */}
          {hotel?.amenities && hotel.amenities.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Text style={[styles.sectionTitle, { color: th.text }]}>{t("travel.services")}</Text>
              <View style={styles.chipsWrap}>
                {hotel.amenities.map((a) => (
                  <View key={a} style={[styles.amenityChip, { backgroundColor: th.surface, borderColor: th.border }]}>
                    <Text style={{ color: th.textMuted, fontSize: 12 }}>{a}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Habitaciones */}
          <View style={{ gap: 8 }}>
            <Text style={[styles.sectionTitle, { color: th.text }]}>{t("travel.rooms")}</Text>
            {rooms.length === 0 && !loading ? (
              <Text style={{ color: th.textSubtle, fontSize: 13 }}>
                {t("travel.no_rooms")}
              </Text>
            ) : null}
            {rooms.map((room, i) => (
              <Pressable
                key={`${room.name}|${room.priceCents}|${i}`}
                onPress={() => onChoose(room.priceCents, room.name)}
                style={[styles.roomRow, { backgroundColor: th.surface, borderColor: th.border }]}
              >
                <View style={styles.flex}>
                  <Text style={{ color: th.text, fontFamily: fonts.bodySemibold }} numberOfLines={2}>
                    {room.name}
                  </Text>
                  {room.board ? <Text style={{ color: th.textSubtle, fontSize: 12 }}>{room.board}</Text> : null}
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: th.accent, fontFamily: fonts.bodyBold }}>
                    {formatMoney(room.priceCents, room.currency)}
                  </Text>
                  <Text style={{ color: th.accent, fontSize: 12, fontFamily: fonts.bodySemibold }}>{t("travel.choose")}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Pie: elegir hotel con el precio actual (sin desglose) */}
        <View style={[styles.footer, { borderTopColor: th.border, backgroundColor: th.surface }]}>
          <Button
            label={t("travel.choose_hotel_price", {
              price: formatMoney(
                rooms.length ? Math.min(...rooms.map((r) => r.priceCents)) : fallbackPriceCents,
                "EUR"
              ),
            })}
            onPress={() => {
              const best = rooms.length ? Math.min(...rooms.map((r) => r.priceCents)) : fallbackPriceCents;
              onChoose(best, null);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

/** Quita etiquetas HTML básicas de la descripción de LiteAPI. */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerBtn: { width: 32, alignItems: "center" },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: fonts.bodyBold, textAlign: "center" },
  content: { padding: 16, gap: 14, paddingBottom: 28 },
  center: { paddingVertical: 24, alignItems: "center" },
  flex: { flex: 1 },
  gallery: { gap: 8 },
  photo: { width: 260, height: 170, borderRadius: 12, backgroundColor: "#00000010" },
  name: { fontSize: 18, fontFamily: fonts.bodyBold },
  desc: { fontSize: 13, lineHeight: 20 },
  sectionTitle: { fontSize: 15, fontFamily: fonts.bodyBold },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  amenityChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  roomRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, padding: 12 },
  footer: { padding: 14, borderTopWidth: 1 },
});
