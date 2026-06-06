import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { Calendar, LocaleConfig, type DateData } from "react-native-calendars";

import {
  buildHolidayImport,
  formatMoney,
  type TransportLeg,
  type AccommodationChoice,
} from "@nidokey/shared";
import { api, ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme";

/**
 * Asistente de VIAJES (record interno `holiday`). 4 pasos:
 *  1. Destino + fechas (autocomplete Travelpayouts).
 *  2. Alojamiento (LiteAPI, precios reales).
 *  3. Desplazamiento (vuelo, precio Travelpayouts; best-effort).
 *  4. Resumen con TOTAL + botones reservar (in-app browser) + crear viaje.
 *
 * ⚠️ La COMISIÓN nunca se muestra. El resumen enseña precios retail + Total.
 */

type Place = {
  id: string;
  name: string;
  iata: string | null;
  countryCode: string | null;
  cityName: string;
  lat: number | null;
  lng: number | null;
};
type HotelItem = {
  hotelId: string;
  name: string;
  stars: number | null;
  thumbnail: string | null;
  priceCents: number;
  currency: string;
  bookUrl: string;
  lat: number | null;
  lng: number | null;
};
type FlightItem = {
  origin: string;
  destination: string;
  priceCents: number;
  currency: string;
  airline: string | null;
  flightNumber: string | null;
  departISO: string | null;
  returnISO: string | null;
  bookUrl: string;
} | null;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Calendario en español (react-native-calendars, JS puro).
LocaleConfig.locales.es = {
  monthNames: ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"],
  monthNamesShort: ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"],
  dayNames: ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"],
  dayNamesShort: ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"],
  today: "Hoy",
};
LocaleConfig.defaultLocale = "es";

const MONTHS_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

/** "YYYY-MM-DD" de HOY en hora local (minDate del calendario). */
function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "2026-07-15" → "15 jul". TZ-safe (no usa new Date sobre el ISO). */
function fmtDay(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[(m ?? 1) - 1]}`;
}

type DayMark = { startingDay?: boolean; endingDay?: boolean; color: string; textColor: string };

/** Marca el rango entrada→salida (estilo Booking, markingType="period"). */
function rangeMarks(start: string, end: string, color: string, textColor: string): Record<string, DayMark> {
  if (!start) return {};
  if (!end) return { [start]: { startingDay: true, endingDay: true, color, textColor } };
  const marks: Record<string, DayMark> = {};
  const cur = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cur <= last) {
    const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    marks[iso] = { color, textColor, startingDay: iso === start, endingDay: iso === end };
    cur.setDate(cur.getDate() + 1);
  }
  return marks;
}

export default function NewTrip() {
  const { th } = useTheme();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paso 1
  const [placeQuery, setPlaceQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [dest, setDest] = useState<Place | null>(null);
  const [origin, setOrigin] = useState("MAD");
  const [startISO, setStartISO] = useState("");
  const [endISO, setEndISO] = useState("");

  // Paso 2
  const [hotels, setHotels] = useState<HotelItem[]>([]);
  const [hotelsReason, setHotelsReason] = useState<string | null>(null);
  const [hotel, setHotel] = useState<HotelItem | null>(null);

  // Paso 3
  const [flight, setFlight] = useState<FlightItem>(null);

  const totalCents = (hotel?.priceCents ?? 0) + (flight?.priceCents ?? 0);

  async function searchPlaces() {
    const q = placeQuery.trim();
    if (q.length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const { items } = await api<{ items: Place[] }>(`/api/travel/places?q=${encodeURIComponent(q)}`);
      setPlaces(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error buscando destino");
    } finally {
      setSearching(false);
    }
  }

  // Selección de rango tipo Booking: 1ª pulsación = entrada; 2ª = salida.
  // Pulsar una fecha anterior a la entrada (o re-empezar) reinicia el rango.
  function onPickDay(day: DateData) {
    const d = day.dateString;
    if (!startISO || (startISO && endISO) || d <= startISO) {
      setStartISO(d);
      setEndISO("");
    } else {
      setEndISO(d);
    }
  }

  async function loadHotels() {
    if (!dest) {
      setError("Elige un destino de la lista");
      return;
    }
    if (!ISO.test(startISO) || !ISO.test(endISO)) {
      setError("Elige las fechas en el calendario");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Coordenadas preferente (independiente del idioma del nombre).
      const qs = new URLSearchParams({ checkin: startISO, checkout: endISO, adults: "2" });
      if (dest.lat != null && dest.lng != null) {
        qs.set("lat", String(dest.lat));
        qs.set("lng", String(dest.lng));
      }
      if (dest.countryCode) qs.set("countryCode", dest.countryCode);
      if (dest.cityName) qs.set("cityName", dest.cityName);
      const { items, reason } = await api<{ items: HotelItem[]; reason?: string }>(
        `/api/travel/hotels?${qs.toString()}`
      );
      setHotels(items);
      setHotelsReason(reason ?? null);
      setHotel(null);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando hoteles");
    } finally {
      setLoading(false);
    }
  }

  async function loadFlight() {
    setLoading(true);
    setError(null);
    try {
      if (origin.trim().length === 3 && dest?.iata) {
        const { item } = await api<{ item: FlightItem }>(
          `/api/travel/flights?origin=${origin.trim().toUpperCase()}&destination=${dest.iata}&departDate=${startISO}&returnDate=${endISO}`
        );
        setFlight(item);
      } else {
        setFlight(null);
      }
    } catch {
      setFlight(null); // sin vuelo, no bloquea
    } finally {
      setLoading(false);
      setStep(3);
    }
  }

  async function createTrip() {
    if (!dest || !hotel) {
      setError("Falta el alojamiento");
      return;
    }
    setLoading(true);
    setError(null);

    const accommodation: AccommodationChoice = {
      kind: "hotel",
      name: hotel.name,
      city: dest.cityName,
      country: dest.countryCode,
      geoCode: hotel.lat != null && hotel.lng != null ? { lat: hotel.lat, lng: hotel.lng } : null,
      checkInISO: startISO,
      checkOutISO: endISO,
      priceCents: hotel.priceCents,
      currency: hotel.currency,
      imageUrls: { thumbnail: hotel.thumbnail },
      affiliateUrl: hotel.bookUrl,
    };
    const transport: TransportLeg | null = flight
      ? {
          mode: "flight",
          provider: flight.airline,
          number: flight.flightNumber,
          from: origin.trim().toUpperCase(),
          to: dest.iata,
          departISO: flight.departISO,
          arriveISO: null,
          priceCents: flight.priceCents,
          currency: flight.currency,
          affiliateUrl: flight.bookUrl,
        }
      : null;

    // buildHolidayImport calcula la comisión y la guarda en meta.commission
    // (INTERNA). El payload visible (currentValue) es solo el total.
    const record = buildHolidayImport({
      destination: dest.cityName,
      startISO,
      endISO,
      transport,
      accommodation,
      imageUrl: hotel.thumbnail,
    });

    try {
      const { record: saved } = await api<{ created: boolean; record: { id: string } | null }>(
        "/api/records/import",
        { method: "POST", body: JSON.stringify({ type: "holiday", input: { kind: "record", record } }) }
      );
      if (saved?.id) router.replace(`/holiday/${saved.id}` as never);
      else router.replace("/(tabs)" as never);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo crear el viaje");
    } finally {
      setLoading(false);
    }
  }

  const STEP_TITLES = ["Destino y fechas", "Alojamiento", "Desplazamiento", "Resumen"];

  return (
    <>
      <Stack.Screen options={{ title: "Nuevo viaje" }} />
      <ScrollView style={{ backgroundColor: th.bg }} contentContainerStyle={styles.content}>
        <Text style={[styles.stepLabel, { color: th.textSubtle }]}>
          Paso {step} de 4 · {STEP_TITLES[step - 1]}
        </Text>

        {error && <Text style={[styles.error, { color: th.dangerFg }]}>{error}</Text>}

        {/* ── Paso 1 ── */}
        {step === 1 && (
          <View style={{ gap: 10 }}>
            <Text style={[styles.label, { color: th.textMuted }]}>Destino</Text>
            {dest ? (
              <Pressable
                onPress={() => setDest(null)}
                style={[styles.chip, { backgroundColor: th.accentSoft, borderColor: th.accent }]}
              >
                <Ionicons name="location" size={16} color={th.accent} />
                <Text style={{ color: th.accent, fontWeight: "600" }}>
                  {dest.name}
                  {dest.iata ? ` (${dest.iata})` : ""}
                </Text>
                <Ionicons name="close" size={16} color={th.accent} />
              </Pressable>
            ) : (
              <>
                <View style={styles.searchRow}>
                  <TextInput
                    value={placeQuery}
                    onChangeText={setPlaceQuery}
                    placeholder="Ciudad de destino…"
                    placeholderTextColor={th.textSubtle}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="search"
                    onSubmitEditing={() => void searchPlaces()}
                    style={[styles.input, styles.flex, { backgroundColor: th.surface, borderColor: th.border, color: th.text }]}
                  />
                  <Pressable
                    onPress={() => void searchPlaces()}
                    style={[styles.searchBtn, { backgroundColor: th.accent }]}
                  >
                    {searching ? (
                      <ActivityIndicator size="small" color={th.primaryFg} />
                    ) : (
                      <Ionicons name="search" size={18} color={th.primaryFg} />
                    )}
                  </Pressable>
                </View>
                {places.map((p) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setDest(p);
                      setPlaces([]);
                    }}
                    style={[styles.row, { backgroundColor: th.surface, borderColor: th.border }]}
                  >
                    <Text style={{ color: th.text, fontWeight: "600" }}>{p.name}</Text>
                    <Text style={{ color: th.textSubtle, fontSize: 12 }}>
                      {[p.iata, p.countryCode].filter(Boolean).join(" · ")}
                    </Text>
                  </Pressable>
                ))}
              </>
            )}

            <Text style={[styles.label, { color: th.textMuted, marginTop: 6 }]}>Origen (IATA)</Text>
            <TextInput
              value={origin}
              onChangeText={(t) => setOrigin(t.toUpperCase().slice(0, 3))}
              placeholder="MAD"
              placeholderTextColor={th.textSubtle}
              autoCapitalize="characters"
              autoCorrect={false}
              style={[styles.input, { backgroundColor: th.surface, borderColor: th.border, color: th.text }]}
            />

            <Text style={[styles.label, { color: th.textMuted, marginTop: 6 }]}>Fechas</Text>
            <Text style={{ color: startISO ? th.text : th.textSubtle, fontSize: 13, fontWeight: "500" }}>
              {startISO && endISO
                ? `${fmtDay(startISO)} → ${fmtDay(endISO)}`
                : startISO
                ? `Entrada ${fmtDay(startISO)} · elige la salida`
                : "Elige la fecha de entrada"}
            </Text>
            <View style={[styles.calendarWrap, { borderColor: th.border, backgroundColor: th.surface }]}>
              <Calendar
                minDate={todayISO()}
                firstDay={1}
                markingType="period"
                markedDates={rangeMarks(startISO, endISO, th.accent, th.primaryFg)}
                onDayPress={onPickDay}
                theme={{
                  calendarBackground: th.surface,
                  monthTextColor: th.text,
                  dayTextColor: th.text,
                  textDisabledColor: th.textSubtle,
                  textSectionTitleColor: th.textMuted,
                  arrowColor: th.accent,
                  todayTextColor: th.accent,
                }}
              />
            </View>

            <PrimaryBtn label="Siguiente" loading={loading} onPress={() => void loadHotels()} th={th} />
          </View>
        )}

        {/* ── Paso 2: alojamiento ── */}
        {step === 2 && (
          <View style={{ gap: 8 }}>
            {hotels.length === 0 ? (
              <Text style={{ color: th.textSubtle }}>
                {hotelsReason === "no_city"
                  ? `Sin hoteles para «${dest?.name ?? "ese destino"}» (en pruebas la cobertura es limitada; prueba una ciudad grande).`
                  : "No hay disponibilidad para esas fechas. Prueba otras fechas."}
              </Text>
            ) : (
              hotels.map((h) => {
                const sel = hotel?.hotelId === h.hotelId;
                return (
                  <Pressable
                    key={h.hotelId}
                    onPress={() => setHotel(h)}
                    style={[
                      styles.hotelRow,
                      { backgroundColor: th.surface, borderColor: sel ? th.accent : th.border, borderWidth: sel ? 2 : 1 },
                    ]}
                  >
                    {h.thumbnail ? (
                      <Image source={{ uri: h.thumbnail }} style={styles.hotelThumb} contentFit="cover" transition={150} />
                    ) : (
                      <View style={[styles.hotelThumb, styles.center, { backgroundColor: th.imagePlaceholder }]}>
                        <Ionicons name="bed-outline" size={22} color={th.textSubtle} />
                      </View>
                    )}
                    <View style={styles.flex}>
                      <Text style={{ color: th.text, fontWeight: "600" }} numberOfLines={2}>{h.name}</Text>
                      {h.stars ? <Text style={{ color: th.textSubtle, fontSize: 12 }}>{"★".repeat(Math.round(h.stars))}</Text> : null}
                    </View>
                    <Text style={{ color: th.accent, fontWeight: "700" }}>{formatMoney(h.priceCents, h.currency)}</Text>
                  </Pressable>
                );
              })
            )}
            <View style={styles.navRow}>
              <GhostBtn label="Atrás" onPress={() => setStep(1)} th={th} />
              <PrimaryBtn label="Siguiente" loading={loading} disabled={!hotel} onPress={() => void loadFlight()} th={th} />
            </View>
          </View>
        )}

        {/* ── Paso 3: desplazamiento ── */}
        {step === 3 && (
          <View style={{ gap: 10 }}>
            {flight ? (
              <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
                <Row k="Trayecto" v={`${flight.origin} → ${flight.destination}`} th={th} />
                {flight.airline ? <Row k="Aerolínea" v={flight.airline} th={th} /> : null}
                <Row k="Precio" v={formatMoney(flight.priceCents, flight.currency)} th={th} accent />
              </View>
            ) : (
              <Text style={{ color: th.textSubtle }}>
                Sin precio de vuelo para esta ruta/fechas. Puedes continuar solo con el alojamiento.
              </Text>
            )}
            <View style={styles.navRow}>
              <GhostBtn label="Atrás" onPress={() => setStep(2)} th={th} />
              <PrimaryBtn label="Siguiente" onPress={() => setStep(4)} th={th} />
            </View>
          </View>
        )}

        {/* ── Paso 4: resumen (SIN comisión) ── */}
        {step === 4 && dest && hotel && (
          <View style={{ gap: 12 }}>
            <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
              <Row k="Destino" v={dest.name} th={th} />
              <Row k="Fechas" v={`${startISO} – ${endISO}`} th={th} />
              <Row k="Alojamiento" v={`${hotel.name} · ${formatMoney(hotel.priceCents, hotel.currency)}`} th={th} />
              {flight ? (
                <Row k="Vuelo" v={`${flight.airline ?? "Vuelo"} · ${formatMoney(flight.priceCents, flight.currency)}`} th={th} />
              ) : null}
              {/* ⚠️ NO renderizar comisión/margen aquí. Solo el Total. */}
              <View style={[styles.totalRow, { borderTopColor: th.border }]}>
                <Text style={{ color: th.text, fontWeight: "700" }}>Total</Text>
                <Text style={{ color: th.accent, fontWeight: "700", fontSize: 17 }}>{formatMoney(totalCents, "EUR")}</Text>
              </View>
            </View>

            <Pressable
              onPress={() => void WebBrowser.openBrowserAsync(hotel.bookUrl)}
              style={[styles.outlineBtn, { borderColor: th.border }]}
            >
              <Ionicons name="bed-outline" size={18} color={th.accent} />
              <Text style={{ color: th.accent, fontWeight: "600" }}>Reservar alojamiento</Text>
            </Pressable>
            {flight ? (
              <Pressable
                onPress={() => void WebBrowser.openBrowserAsync(flight.bookUrl)}
                style={[styles.outlineBtn, { borderColor: th.border }]}
              >
                <Ionicons name="airplane-outline" size={18} color={th.accent} />
                <Text style={{ color: th.accent, fontWeight: "600" }}>Ver vuelo</Text>
              </Pressable>
            ) : null}

            <View style={styles.navRow}>
              <GhostBtn label="Atrás" onPress={() => setStep(3)} th={th} />
              <PrimaryBtn label="Crear viaje" loading={loading} onPress={() => void createTrip()} th={th} />
            </View>
          </View>
        )}
      </ScrollView>
    </>
  );
}

type Th = ReturnType<typeof useTheme>["th"];

function Row({ k, v, th, accent }: { k: string; v: string; th: Th; accent?: boolean }) {
  return (
    <View style={styles.kvRow}>
      <Text style={{ color: th.textSubtle, fontSize: 13 }}>{k}</Text>
      <Text style={{ color: accent ? th.accent : th.text, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" }}>
        {v}
      </Text>
    </View>
  );
}

function PrimaryBtn({
  label,
  onPress,
  loading,
  disabled,
  th,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  th: Th;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={[styles.primaryBtn, { backgroundColor: th.accent, opacity: loading || disabled ? 0.5 : 1 }]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={th.primaryFg} />
      ) : (
        <Text style={{ color: th.primaryFg, fontWeight: "700" }}>{label}</Text>
      )}
    </Pressable>
  );
}

function GhostBtn({ label, onPress, th }: { label: string; onPress: () => void; th: Th }) {
  return (
    <Pressable onPress={onPress} style={styles.ghostBtn}>
      <Text style={{ color: th.textMuted, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  stepLabel: { fontSize: 12, fontWeight: "600" },
  label: { fontSize: 13, fontWeight: "600" },
  error: { fontSize: 13 },
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  input: { height: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  searchRow: { flexDirection: "row", gap: 8 },
  calendarWrap: { borderWidth: 1, borderRadius: 10, overflow: "hidden", paddingBottom: 4 },
  searchBtn: { width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  row: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  hotelRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, padding: 8 },
  hotelThumb: { width: 56, height: 56, borderRadius: 8 },
  card: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 4 },
  kvRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
  primaryBtn: { flex: 1, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ghostBtn: { height: 48, paddingHorizontal: 18, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: 10, borderWidth: 1 },
  navRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 8 },
});
