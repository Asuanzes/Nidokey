import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Calendar, LocaleConfig, type DateData } from "react-native-calendars";

import {
  buildHolidayImport,
  formatMoney,
  type TransportLeg,
  type AccommodationChoice,
} from "@nidokey/shared";
import { api, ApiError } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { ResultModal } from "@/components/ui";
import { HotelDetailModal } from "@/components/travel/HotelDetailModal";

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
type FlightOption = {
  offerId: string | null;
  origin: string;
  destination: string;
  priceCents: number;
  currency: string;
  airline: string | null;
  flightNumber: string | null;
  departISO: string | null;
  returnISO: string | null;
  stops: number;
  bookUrl: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Una habitación: adultos + edades de los niños. */
type Room = { adults: number; children: number[] };
/** Tipos de viaje sugeridos (el usuario puede escribir uno propio). */
const TRIP_TYPES = ["Vacaciones", "Negocios", "Trabajo", "Familia", "Pareja", "Grupo", "Amigos"];

/** Paquete del viaje: qué se reserva (decide qué pasos se muestran). */
type Pkg = "flight_hotel" | "hotel" | "flight" | "flight_hotel_transfer";
const PKGS: { id: Pkg; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "flight_hotel", label: "Vuelo + Hotel", icon: "airplane" },
  { id: "hotel", label: "Solo Hotel", icon: "bed" },
  { id: "flight", label: "Solo Vuelo", icon: "airplane-outline" },
  { id: "flight_hotel_transfer", label: "Vuelo + Hotel + Traslado", icon: "car" },
];
/** Traslado aeropuerto↔hotel: estimación mientras no haya proveedor en vivo. */
const TRANSFER_ESTIMATE_CENTS = 4000; // ~40 € ida y vuelta (estimado)

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
  const [pkg, setPkg] = useState<Pkg>("flight_hotel");

  // Qué incluye el paquete (decide los pasos visibles).
  const wantHotel = pkg !== "flight";
  const wantFlight = pkg !== "hotel";
  const wantTransfer = pkg === "flight_hotel_transfer";

  // Paso 1
  const [placeQuery, setPlaceQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [dest, setDest] = useState<Place | null>(null);
  const [origin, setOrigin] = useState("MAD");
  const [startISO, setStartISO] = useState("");
  const [endISO, setEndISO] = useState("");
  const [tripType, setTripType] = useState("Vacaciones");
  const [rooms, setRooms] = useState<Room[]>([{ adults: 2, children: [] }]);

  const totalAdults = rooms.reduce((s, r) => s + r.adults, 0);
  const allChildAges = rooms.flatMap((r) => r.children);
  const occSummary =
    `${rooms.length} hab. · ${totalAdults} adulto${totalAdults !== 1 ? "s" : ""}` +
    (allChildAges.length ? ` · ${allChildAges.length} niño${allChildAges.length !== 1 ? "s" : ""}` : "");

  function setAdults(i: number, delta: number) {
    setRooms((rs) => rs.map((r, j) => (j === i ? { ...r, adults: Math.max(1, Math.min(6, r.adults + delta)) } : r)));
  }
  function setChildrenCount(i: number, delta: number) {
    setRooms((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r;
        const children = [...r.children];
        if (delta > 0 && children.length < 4) children.push(8); // edad por defecto
        else if (delta < 0 && children.length > 0) children.pop();
        return { ...r, children };
      })
    );
  }
  function setChildAge(roomI: number, childI: number, age: number) {
    setRooms((rs) =>
      rs.map((r, j) =>
        j === roomI ? { ...r, children: r.children.map((a, k) => (k === childI ? Math.max(0, Math.min(17, age)) : a)) } : r
      )
    );
  }
  function addRoom() {
    setRooms((rs) => (rs.length < 4 ? [...rs, { adults: 2, children: [] }] : rs));
  }
  function removeRoom(i: number) {
    setRooms((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));
  }

  // Paso 2
  const [hotels, setHotels] = useState<HotelItem[]>([]);
  const [hotelsReason, setHotelsReason] = useState<string | null>(null);
  const [hotel, setHotel] = useState<HotelItem | null>(null);
  const [exploreHotel, setExploreHotel] = useState<HotelItem | null>(null); // hotel abierto en el modal de detalle
  const [roomLabel, setRoomLabel] = useState<string | null>(null); // habitación elegida en el modal

  // Paso 3
  const [flights, setFlights] = useState<FlightOption[]>([]);
  const [flight, setFlight] = useState<FlightOption | null>(null);

  // Resultado de reserva (modal app-styled, sustituye al Alert nativo).
  const [booked, setBooked] = useState<{ id: string | null; hotelRef: string; flightRef: string | null } | null>(null);

  const transferCents = wantTransfer ? TRANSFER_ESTIMATE_CENTS : 0;
  const totalCents = (hotel?.priceCents ?? 0) + (flight?.priceCents ?? 0) + transferCents;

  // Pasos activos según el paquete → para la etiqueta "Paso X de N".
  const activeSteps: number[] = [1, ...(wantHotel ? [2] : []), ...(wantFlight ? [3] : []), 4];
  const stepIndex = Math.max(1, activeSteps.indexOf(step) + 1);

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
      const qs = new URLSearchParams({ checkin: startISO, checkout: endISO });
      qs.set("occupancies", JSON.stringify(rooms.map((r) => ({ adults: r.adults, children: r.children }))));
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
        const fq = new URLSearchParams({
          origin: origin.trim().toUpperCase(),
          destination: dest.iata,
          departDate: startISO,
          returnDate: endISO,
          adults: String(totalAdults),
        });
        if (allChildAges.length) fq.set("children", allChildAges.join(","));
        const { items } = await api<{ items: FlightOption[] }>(`/api/travel/flights?${fq.toString()}`);
        setFlights(items);
        setFlight(items[0] ?? null); // pre-selecciona el más barato; el usuario cambia
      } else {
        setFlights([]);
        setFlight(null);
      }
    } catch {
      setFlights([]);
      setFlight(null); // sin vuelo, no bloquea
    } finally {
      setLoading(false);
      setStep(3);
    }
  }

  // Navegación dependiente del paquete: salta los pasos que no aplican.
  function startFromStep1() {
    if (!dest) {
      setError("Elige un destino de la lista");
      return;
    }
    if (!ISO.test(startISO) || !ISO.test(endISO)) {
      setError("Elige las fechas en el calendario");
      return;
    }
    setError(null);
    if (wantHotel) void loadHotels();
    else if (wantFlight) void loadFlight();
    else setStep(4);
  }
  function afterHotels() {
    if (wantFlight) void loadFlight();
    else setStep(4);
  }
  function backFromStep4() {
    setStep(wantFlight ? 3 : wantHotel ? 2 : 1);
  }

  async function createTrip() {
    if (!dest) {
      setError("Falta el destino");
      return;
    }
    if (wantHotel && !hotel) {
      setError("Falta el alojamiento");
      return;
    }
    if (pkg === "flight" && !flight) {
      setError("Falta el vuelo");
      return;
    }
    setLoading(true);
    setError(null);

    const accommodation: AccommodationChoice | null = hotel
      ? {
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
        }
      : null;
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
    const transfer: TransportLeg | null = wantTransfer
      ? {
          mode: "car",
          provider: "Traslado aeropuerto ↔ hotel",
          from: dest.iata,
          to: hotel?.name ?? null,
          priceCents: TRANSFER_ESTIMATE_CENTS,
          currency: "EUR",
          affiliateUrl: null,
        }
      : null;

    // buildHolidayImport calcula la comisión y la guarda en meta.commission
    // (INTERNA). El payload visible (currentValue) es solo el total.
    const record = buildHolidayImport({
      destination: dest.cityName,
      startISO,
      endISO,
      tripType,
      occupancy: rooms.map((r) => ({ adults: r.adults, children: r.children })),
      transport,
      transfer,
      accommodation,
      imageUrl: hotel?.thumbnail ?? null,
    });

    try {
      // Reserva completa (modo prueba): el backend confirma y persiste BOOKED.
      const { record: saved, booking } = await api<{
        record: { id: string } | null;
        booking: { hotelRef: string | null; flightRef: string | null };
      }>("/api/travel/book", { method: "POST", body: JSON.stringify({ record }) });
      // Confirmación con modal de la app (no Alert nativo).
      setBooked({ id: saved?.id ?? null, hotelRef: booking.hotelRef ?? "", flightRef: booking.flightRef });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo reservar el viaje");
    } finally {
      setLoading(false);
    }
  }

  const sameFlight = (a: FlightOption | null, f: FlightOption) =>
    !!a && a.priceCents === f.priceCents && a.departISO === f.departISO && a.airline === f.airline;

  function hotelCard(h: HotelItem) {
    const sel = hotel?.hotelId === h.hotelId;
    return (
      <View key={h.hotelId} style={{ gap: 2 }}>
        <Pressable
          onPress={() => {
            setHotel(sel ? null : h);
            setRoomLabel(null); // al cambiar de hotel se olvida la habitación elegida
          }}
          style={[styles.hotelRow, { backgroundColor: th.surface, borderColor: sel ? th.accent : th.border, borderWidth: sel ? 2 : 1 }]}
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
            {sel && roomLabel ? <Text style={{ color: th.accent, fontSize: 12 }} numberOfLines={1}>{roomLabel}</Text> : null}
          </View>
          {sel ? <Ionicons name="checkmark-circle" size={18} color={th.accent} /> : null}
          <Text style={{ color: th.accent, fontWeight: "700" }}>{formatMoney(h.priceCents, h.currency)}</Text>
        </Pressable>
        <Pressable onPress={() => setExploreHotel(h)} style={styles.linkRow} hitSlop={4}>
          <Ionicons name="information-circle-outline" size={15} color={th.accent} />
          <Text style={{ color: th.accent, fontSize: 12, fontWeight: "600" }}>Ver habitaciones y detalles</Text>
        </Pressable>
      </View>
    );
  }

  function flightCard(f: FlightOption) {
    const sel = sameFlight(flight, f);
    const stopsLabel = f.stops === 0 ? "Directo" : `${f.stops} escala${f.stops > 1 ? "s" : ""}`;
    const time = f.departISO ? f.departISO.slice(11, 16) : null;
    return (
      <Pressable
        key={f.offerId ?? `${f.airline}|${f.departISO}|${f.priceCents}`}
        onPress={() => setFlight(sel ? null : f)}
        style={[styles.flightRow, { backgroundColor: th.surface, borderColor: sel ? th.accent : th.border, borderWidth: sel ? 2 : 1 }]}
      >
        <Ionicons name="airplane" size={18} color={th.textSubtle} />
        <View style={styles.flex}>
          <Text style={{ color: th.text, fontWeight: "600" }} numberOfLines={1}>{f.airline ?? "Vuelo"}</Text>
          <Text style={{ color: th.textSubtle, fontSize: 12 }}>{[time, stopsLabel].filter(Boolean).join(" · ")}</Text>
        </View>
        <Text style={{ color: th.accent, fontWeight: "700" }}>{formatMoney(f.priceCents, f.currency)}</Text>
      </Pressable>
    );
  }

  const STEP_TITLES = ["Destino y fechas", "Alojamiento", "Desplazamiento", "Resumen"];

  return (
    <>
      <Stack.Screen options={{ title: "Nuevo viaje" }} />
      <ScrollView style={{ backgroundColor: th.bg }} contentContainerStyle={styles.content}>
        <Text style={[styles.stepLabel, { color: th.textSubtle }]}>
          Paso {stepIndex} de {activeSteps.length} · {STEP_TITLES[step - 1]}
        </Text>

        {error && <Text style={[styles.error, { color: th.dangerFg }]}>{error}</Text>}

        {/* ── Paso 1 ── */}
        {step === 1 && (
          <View style={{ gap: 10 }}>
            <Text style={[styles.label, { color: th.textMuted }]}>¿Qué quieres reservar?</Text>
            <View style={styles.chipsWrap}>
              {PKGS.map((p) => {
                const on = pkg === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setPkg(p.id)}
                    style={[styles.pkgChip, { borderColor: on ? th.accent : th.border, backgroundColor: on ? th.accentSoft : th.surface }]}
                  >
                    <Ionicons name={p.icon} size={15} color={on ? th.accent : th.textMuted} />
                    <Text style={{ color: on ? th.accent : th.textMuted, fontSize: 13, fontWeight: "600" }}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: th.textMuted, marginTop: 6 }]}>Destino</Text>
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

            <Text style={[styles.label, { color: th.textMuted, marginTop: 6 }]}>Tipo de viaje</Text>
            <View style={styles.chipsWrap}>
              {TRIP_TYPES.map((t) => {
                const on = tripType === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setTripType(t)}
                    style={[styles.typeChip, { borderColor: on ? th.accent : th.border, backgroundColor: on ? th.accentSoft : th.surface }]}
                  >
                    <Text style={{ color: on ? th.accent : th.textMuted, fontSize: 13, fontWeight: "600" }}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={TRIP_TYPES.includes(tripType) ? "" : tripType}
              onChangeText={setTripType}
              placeholder="…u otro tipo (escríbelo)"
              placeholderTextColor={th.textSubtle}
              autoCapitalize="sentences"
              style={[styles.input, { backgroundColor: th.surface, borderColor: th.border, color: th.text }]}
            />

            {wantFlight && (
              <>
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
              </>
            )}

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

            <Text style={[styles.label, { color: th.textMuted, marginTop: 6 }]}>Viajeros y habitaciones</Text>
            <Text style={{ color: th.textSubtle, fontSize: 12 }}>{occSummary}</Text>
            {rooms.map((r, i) => (
              <View key={i} style={[styles.roomCard, { backgroundColor: th.surface, borderColor: th.border }]}>
                <View style={styles.roomHeader}>
                  <Text style={{ color: th.text, fontWeight: "700" }}>Habitación {i + 1}</Text>
                  {rooms.length > 1 ? (
                    <Pressable onPress={() => removeRoom(i)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={th.dangerFg} />
                    </Pressable>
                  ) : null}
                </View>
                <Stepper label="Adultos" value={r.adults} onMinus={() => setAdults(i, -1)} onPlus={() => setAdults(i, 1)} th={th} />
                <Stepper label="Niños" value={r.children.length} onMinus={() => setChildrenCount(i, -1)} onPlus={() => setChildrenCount(i, 1)} th={th} />
                {r.children.length > 0 ? (
                  <View style={styles.agesRow}>
                    {r.children.map((age, ci) => (
                      <View key={ci} style={[styles.ageBox, { borderColor: th.border, backgroundColor: th.bg }]}>
                        <Text style={{ color: th.textSubtle, fontSize: 10 }}>Edad</Text>
                        <Pressable onPress={() => setChildAge(i, ci, age - 1)} hitSlop={6}>
                          <Ionicons name="remove" size={14} color={th.accent} />
                        </Pressable>
                        <Text style={{ color: th.text, fontWeight: "600", minWidth: 16, textAlign: "center" }}>{age}</Text>
                        <Pressable onPress={() => setChildAge(i, ci, age + 1)} hitSlop={6}>
                          <Ionicons name="add" size={14} color={th.accent} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
            {rooms.length < 4 ? (
              <Pressable onPress={addRoom} style={[styles.addRoomBtn, { borderColor: th.border }]}>
                <Ionicons name="add" size={16} color={th.accent} />
                <Text style={{ color: th.accent, fontWeight: "600" }}>Añadir habitación</Text>
              </Pressable>
            ) : null}

            <PrimaryBtn label="Siguiente" loading={loading} onPress={() => startFromStep1()} th={th} />
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
            ) : hotel ? (
              <>
                {hotelCard(hotel)}
                <Pressable onPress={() => setHotel(null)} style={styles.linkRow}>
                  <Ionicons name="swap-horizontal" size={16} color={th.accent} />
                  <Text style={{ color: th.accent, fontWeight: "600" }}>Ver otros hoteles ({hotels.length})</Text>
                </Pressable>
              </>
            ) : (
              hotels.map((h) => hotelCard(h))
            )}
            <View style={styles.navRow}>
              <GhostBtn label="Atrás" onPress={() => setStep(1)} th={th} />
              <PrimaryBtn label="Siguiente" loading={loading} disabled={!hotel} onPress={() => afterHotels()} th={th} />
            </View>
          </View>
        )}

        {/* ── Paso 3: desplazamiento (lista seleccionable) ── */}
        {step === 3 && (
          <View style={{ gap: 8 }}>
            {flights.length === 0 ? (
              <Text style={{ color: th.textSubtle }}>
                Sin vuelos para esta ruta/fechas. Puedes continuar solo con el alojamiento.
              </Text>
            ) : flight ? (
              <>
                {flightCard(flight)}
                {flights.length > 1 ? (
                  <Pressable onPress={() => setFlight(null)} style={styles.linkRow}>
                    <Ionicons name="swap-horizontal" size={16} color={th.accent} />
                    <Text style={{ color: th.accent, fontWeight: "600" }}>Ver otros vuelos ({flights.length})</Text>
                  </Pressable>
                ) : null}
              </>
            ) : (
              <>
                {flights.map((f) => flightCard(f))}
                <Text style={{ color: th.textSubtle, fontSize: 12 }}>
                  Elige un vuelo, o pulsa Siguiente para continuar sin vuelo.
                </Text>
              </>
            )}
            <View style={styles.navRow}>
              <GhostBtn label="Atrás" onPress={() => setStep(wantHotel ? 2 : 1)} th={th} />
              <PrimaryBtn label="Siguiente" onPress={() => setStep(4)} th={th} />
            </View>
          </View>
        )}

        {/* ── Paso 4: resumen / previsualización de la reserva (SIN comisión) ── */}
        {step === 4 && dest && (hotel || !wantHotel) && (
          <View style={{ gap: 12 }}>
            <Text style={[styles.label, { color: th.textMuted }]}>Revisa tu reserva</Text>

            {/* Datos del viaje */}
            <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
              <Row k="Destino" v={dest.name} th={th} />
              {tripType.trim() ? <Row k="Tipo" v={tripType.trim()} th={th} /> : null}
              <Row k="Fechas" v={`${fmtDay(startISO)} → ${fmtDay(endISO)}`} th={th} />
              <Row k="Viajeros" v={occSummary} th={th} />
            </View>

            {/* Alojamiento (previsualización con foto) */}
            {hotel ? (
              <Pressable
                onPress={() => setExploreHotel(hotel)}
                style={[styles.previewRow, { backgroundColor: th.surface, borderColor: th.border }]}
              >
                {hotel.thumbnail ? (
                  <Image source={{ uri: hotel.thumbnail }} style={styles.hotelThumb} contentFit="cover" transition={150} />
                ) : (
                  <View style={[styles.hotelThumb, styles.center, { backgroundColor: th.imagePlaceholder }]}>
                    <Ionicons name="bed-outline" size={22} color={th.textSubtle} />
                  </View>
                )}
                <View style={styles.flex}>
                  <Text style={{ color: th.textSubtle, fontSize: 11, fontWeight: "600" }}>ALOJAMIENTO</Text>
                  <Text style={{ color: th.text, fontWeight: "600" }} numberOfLines={2}>{hotel.name}</Text>
                  <Text style={{ color: th.textSubtle, fontSize: 12 }}>
                    {[hotel.stars ? "★".repeat(Math.round(hotel.stars)) : null, roomLabel ?? "Ver habitaciones"].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Text style={{ color: th.accent, fontWeight: "700" }}>{formatMoney(hotel.priceCents, hotel.currency)}</Text>
              </Pressable>
            ) : null}

            {/* Vuelo (previsualización) */}
            {flight ? (
              <View style={[styles.previewRow, { backgroundColor: th.surface, borderColor: th.border }]}>
                <View style={[styles.hotelThumb, styles.center, { backgroundColor: th.imagePlaceholder }]}>
                  <Ionicons name="airplane" size={22} color={th.textSubtle} />
                </View>
                <View style={styles.flex}>
                  <Text style={{ color: th.textSubtle, fontSize: 11, fontWeight: "600" }}>VUELO</Text>
                  <Text style={{ color: th.text, fontWeight: "600" }} numberOfLines={1}>{flight.airline ?? "Vuelo"}</Text>
                  <Text style={{ color: th.textSubtle, fontSize: 12 }}>
                    {[
                      `${origin.trim().toUpperCase()} → ${dest.iata ?? ""}`,
                      flight.departISO ? flight.departISO.slice(11, 16) : null,
                      flight.stops === 0 ? "Directo" : `${flight.stops} escala${flight.stops > 1 ? "s" : ""}`,
                    ].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Text style={{ color: th.accent, fontWeight: "700" }}>{formatMoney(flight.priceCents, flight.currency)}</Text>
              </View>
            ) : null}

            {/* Traslado (estimado) */}
            {wantTransfer ? (
              <View style={[styles.previewRow, { backgroundColor: th.surface, borderColor: th.border }]}>
                <View style={[styles.hotelThumb, styles.center, { backgroundColor: th.imagePlaceholder }]}>
                  <Ionicons name="car" size={22} color={th.textSubtle} />
                </View>
                <View style={styles.flex}>
                  <Text style={{ color: th.textSubtle, fontSize: 11, fontWeight: "600" }}>TRASLADO</Text>
                  <Text style={{ color: th.text, fontWeight: "600" }}>Aeropuerto ↔ hotel</Text>
                  <Text style={{ color: th.textSubtle, fontSize: 12 }}>Ida y vuelta · estimado</Text>
                </View>
                <Text style={{ color: th.accent, fontWeight: "700" }}>{formatMoney(TRANSFER_ESTIMATE_CENTS, "EUR")}</Text>
              </View>
            ) : null}

            {/* Total (⚠️ NUNCA comisión aquí) */}
            <View style={[styles.card, { backgroundColor: th.surface, borderColor: th.border }]}>
              <View style={styles.totalRowTop}>
                <Text style={{ color: th.text, fontWeight: "700" }}>Total</Text>
                <Text style={{ color: th.accent, fontWeight: "700", fontSize: 19 }}>{formatMoney(totalCents, "EUR")}</Text>
              </View>
              <Text style={{ color: th.textSubtle, fontSize: 11 }}>
                Reserva de prueba — el cobro real se activará al publicar.
              </Text>
            </View>

            <View style={styles.navRow}>
              <GhostBtn label="Atrás" onPress={() => backFromStep4()} th={th} />
              <PrimaryBtn label="Reservar viaje" loading={loading} onPress={() => void createTrip()} th={th} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Explorar hotel: fotos, servicios y habitaciones (in-app) */}
      <HotelDetailModal
        visible={!!exploreHotel}
        hotelId={exploreHotel?.hotelId ?? null}
        fallbackName={exploreHotel?.name ?? ""}
        fallbackPriceCents={exploreHotel?.priceCents ?? 0}
        checkin={startISO}
        checkout={endISO}
        occupancies={rooms}
        onClose={() => setExploreHotel(null)}
        onChoose={(priceCents, roomName) => {
          if (exploreHotel) {
            setHotel({ ...exploreHotel, priceCents });
            setRoomLabel(roomName);
          }
          setExploreHotel(null);
        }}
      />

      {/* Confirmación de reserva con estilo de la app (no Alert nativo) */}
      <ResultModal
        visible={!!booked}
        tone="success"
        title="¡Reserva realizada!"
        message="Reserva de prueba — el cobro real se activará al publicar."
        detail={
          booked
            ? [
                booked.hotelRef ? `Alojamiento ${booked.hotelRef}` : null,
                booked.flightRef ? `Vuelo ${booked.flightRef}` : null,
              ]
                .filter(Boolean)
                .join("   ·   ") || null
            : null
        }
        actions={[
          {
            label: "Ver viaje",
            onPress: () => {
              const id = booked?.id;
              setBooked(null);
              router.replace((id ? `/holiday/${id}` : "/(tabs)") as never);
            },
          },
        ]}
        onRequestClose={() => {
          const id = booked?.id;
          setBooked(null);
          router.replace((id ? `/holiday/${id}` : "/(tabs)") as never);
        }}
      />
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

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  th,
}: {
  label: string;
  value: number;
  onMinus: () => void;
  onPlus: () => void;
  th: Th;
}) {
  return (
    <View style={styles.stepperRow}>
      <Text style={{ color: th.text, fontSize: 14 }}>{label}</Text>
      <View style={styles.stepperCtrls}>
        <Pressable onPress={onMinus} style={[styles.stepBtn, { borderColor: th.border }]} hitSlop={6}>
          <Ionicons name="remove" size={18} color={th.accent} />
        </Pressable>
        <Text style={{ color: th.text, fontWeight: "700", minWidth: 22, textAlign: "center" }}>{value}</Text>
        <Pressable onPress={onPlus} style={[styles.stepBtn, { borderColor: th.border }]} hitSlop={6}>
          <Ionicons name="add" size={18} color={th.accent} />
        </Pressable>
      </View>
    </View>
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
  flightRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 10, padding: 12 },
  linkRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 6 },
  hotelThumb: { width: 56, height: 56, borderRadius: 8 },
  card: { borderWidth: 1, borderRadius: 10, padding: 14, gap: 4 },
  kvRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 8, marginTop: 4 },
  primaryBtn: { flex: 1, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ghostBtn: { height: 48, paddingHorizontal: 18, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 46, borderRadius: 10, borderWidth: 1 },
  navRow: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 8 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  pkgChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 10, padding: 10 },
  totalRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  roomCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  roomHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stepperRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stepperCtrls: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  agesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ageBox: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  addRoomBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 42, borderRadius: 10, borderWidth: 1, borderStyle: "dashed" },
});
