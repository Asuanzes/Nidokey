import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";

import { useCategoryPrefs } from "@/lib/records/category-prefs-context";
import { usePendingImport } from "@/lib/pending-import";
import { isPortalUrl } from "@/lib/portal-url";
import { bookShareQuery, firstShareUrl } from "@/lib/book-url";
import { useTheme } from "@/lib/theme";
import { api, ApiError } from "@/lib/api";
import { RECORD_TYPE_CONFIG } from "@/lib/records/config";
import { WebViewImporter, type ExtractedPayload } from "@/components/WebViewImporter";
import { Button, Card, EmptyState, Screen } from "@/components/ui";

/**
 * Añadir registros — type-aware. Eliges el tipo (rail superior) y el input +
 * destino se adaptan:
 *  - URL  (inmuebles): pegar/compartir URL → extracción en WebView → /api/listings/import.
 *  - símbolo (cripto): teclear símbolo → /api/records/import (fetch server-side).
 *  - "soon": "Próximamente".
 * Cada registro se guarda en su tipo y aparece en su menú correspondiente.
 */

type ImportResult = { created: boolean; priceChanged: boolean; propertyId: string };
type RecordImportResult = { created: boolean; record: { id: string; title: string } | null };
type SearchHit = {
  symbol: string;
  name: string | null;
  exchange: string | null;
  type: string | null;
  /** Empleo: el candidato ya trae su registro normalizado → import sin re-llamar. */
  record?: unknown;
};

type Status = "idle" | "extracting" | "sending" | "ok" | "error";

export default function ImportarScreen() {
  const { th } = useTheme();
  // Categoría COMPARTIDA con la lista (contexto): al abrir Importar desde una
  // categoría (p. ej. Criptos) se abre directamente en ella.
  const { category: type, setCategory: setType, orderedVisible } = useCategoryPrefs();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  // Empleo: filtros extra de búsqueda (ciudad/zona + remoto + fuentes).
  const [searchLocation, setSearchLocation] = useState("");
  const [searchRemote, setSearchRemote] = useState(false);
  // Portales a consultar (elige 1–3). InfoJobs (España), LinkedIn, Indeed.
  const [jobSources, setJobSources] = useState({ infojobs: true, linkedin: true, indeed: true });
  // Confirmación por fila al elegir un resultado (check verde estilo WhatsApp).
  const [addedKeys, setAddedKeys] = useState<Set<number>>(new Set());
  const [addingIndex, setAddingIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0); // carga del anuncio (0–1)
  // Alta manual de libro (fallback final del híbrido): cuando ni el share ni la
  // búsqueda encuentran el libro, se mete a mano (título/autor/ISBN).
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualIsbn, setManualIsbn] = useState("");
  const [manualNotes, setManualNotes] = useState(""); // sinopsis/notas propias del usuario
  const [manualSaving, setManualSaving] = useState(false);
  // Sugerencias de PORTADA para el alta manual: el usuario las pide y ELIGE una
  // (o ninguna). El alta sigue siendo literal — esto solo adjunta la imagen.
  const [manualCovers, setManualCovers] = useState<{ url: string; title: string }[]>([]);
  const [manualCover, setManualCover] = useState<string | null>(null);
  const [coverLoading, setCoverLoading] = useState(false);
  const [coverFailed, setCoverFailed] = useState<Set<string>>(new Set());

  const cfg = RECORD_TYPE_CONFIG[type];

  function reset() {
    setStatus("idle");
    setOkMsg(null);
    setErrorMsg(null);
  }

  // Pide SUGERENCIAS de portada (no decide el libro): muestra candidatos para que
  // el usuario elija la imagen que encaja con SU libro. El alta sigue siendo literal.
  const suggestCover = useCallback(async () => {
    const title = manualTitle.trim();
    const isbn = manualIsbn.trim();
    if (title.length < 2 && isbn.replace(/[^0-9Xx]/g, "").length < 10) return;
    setCoverLoading(true);
    setCoverFailed(new Set());
    try {
      const qs = new URLSearchParams({ title, author: manualAuthor.trim(), isbn }).toString();
      const r = await api<{ covers: { url: string; title: string }[] }>(`/api/books/cover?${qs}`);
      setManualCovers(r.covers ?? []);
    } catch {
      setManualCovers([]);
    } finally {
      setCoverLoading(false);
    }
  }, [manualTitle, manualAuthor, manualIsbn]);

  // Auto-sugerir portadas: en cuanto el usuario ha puesto TÍTULO y AUTOR, intentamos
  // la búsqueda (con debounce de 700 ms). El botón sigue valiendo para re-buscar o
  // cuando solo hay ISBN.
  useEffect(() => {
    if (!manualOpen || type !== "book") return;
    if (manualTitle.trim().length < 2 || manualAuthor.trim().length < 2) return;
    const t = setTimeout(() => void suggestCover(), 700);
    return () => clearTimeout(t);
  }, [manualOpen, type, manualTitle, manualAuthor, suggestCover]);

  // Guarda un libro a mano de forma LITERAL: lo que escribes es lo que se añade.
  // No hay búsqueda que pueda traer otro libro; solo se adjunta la portada elegida.
  async function submitManual() {
    const title = manualTitle.trim();
    if (title.length < 2) return;
    setManualSaving(true);
    setOkMsg(null);
    setErrorMsg(null);
    try {
      const r = await api<{ record: { title: string } | null }>("/api/books/manual", {
        method: "POST",
        body: JSON.stringify({
          title,
          author: manualAuthor.trim(),
          isbn: manualIsbn.trim(),
          description: manualNotes.trim(),
          imageUrl: manualCover,
        }),
      });
      setOkMsg(`✅ ${r.record?.title ?? title} añadido en Libros`);
      setStatus("ok");
      setManualOpen(false);
      setManualTitle("");
      setManualAuthor("");
      setManualIsbn("");
      setManualNotes("");
      setManualCovers([]);
      setManualCover(null);
    } catch (e) {
      setErrorMsg(errMsg(e, "No se pudo añadir el libro"));
      setStatus("error");
    } finally {
      setManualSaving(false);
    }
  }

  // Share de un enlace de LIBRO: detecta el libro, busca (por ISBN o título) y,
  // si es un ISBN (match fiable), lo añade solo; si no, deja los resultados para
  // que elijas. Reutiliza la búsqueda + el import existentes.
  const importBookShare = useCallback(
    async (sharedText: string) => {
      setType("book");
      setOkMsg(null);
      setErrorMsg(null);
      setStatus("idle");
      setResults([]);
      setAddedKeys(new Set());
      setHasSearched(false);

      const parsed = bookShareQuery(sharedText);
      const url = firstShareUrl(sharedText);
      setValue(parsed?.query ?? "");
      setSearching(true);

      // Solo AUTO-añadimos con un match FIABLE (ISBN exacto, o el pipeline del
      // servidor que ya vetó por ISBN/score). Con un título ambiguo NO adivinamos:
      // dejamos la lista para que elijas (se acabó "añade el que le da la gana").
      let hits: SearchHit[] = [];
      let reliable = false;
      try {
        // 1) ISBN en la cadena/URL → match exacto.
        if (parsed?.isbn) {
          const res = await api<{ results: SearchHit[] }>(
            `/api/records/search?type=book&q=${encodeURIComponent(`isbn:${parsed.query}`)}`
          );
          hits = res.results ?? [];
          reliable = hits.length > 0;
        }
        // 2) Hay URL → pipeline del servidor (lee schema.org de la página y resuelve
        //    por ISBN/score). Si devuelve libro, es fiable.
        if (!reliable && url) {
          const res = await api<{ results: SearchHit[] }>("/api/books/resolve", {
            method: "POST",
            body: JSON.stringify({ url }),
          });
          const rhits = res.results ?? [];
          if (rhits.length > 0) {
            hits = rhits;
            reliable = true;
          }
        }
        // 3) Solo título → buscar; fiable solo si el primero casa FUERTE (título
        //    largo y distintivo). Si es corto/ambiguo, se muestra la lista.
        if (!reliable && parsed?.query) {
          const res = await api<{ results: SearchHit[] }>(
            `/api/records/search?type=book&q=${encodeURIComponent(parsed.query)}`
          );
          hits = res.results ?? [];
          reliable = hits.length > 0 && strongTitleMatch(parsed.query, hits[0].name);
        }
      } catch {
        /* red caída → hits vacío → cae a alta manual */
      } finally {
        setSearching(false);
        setHasSearched(true);
      }
      setResults(hits);
      // Guard anti-ficha-vacía: aunque sea "fiable", no auto-añadimos un resultado
      // sin TÍTULO real (un share pobre de una app nativa podía colar una ficha en
      // blanco). Si el top no tiene título usable, cae a lista/manual en vez de crear basura.
      const topTitle = (hits[0]?.name ?? "").trim();
      // Match fiable + con título → lo añadimos solo. Ambiguo (hay resultados pero sin
      // match claro) → status idle: la lista queda visible para que elijas. Nada → manual.
      if (reliable && hits[0]?.record && topTitle.length >= 2) {
        setStatus("sending");
        try {
          const r = await api<RecordImportResult>("/api/records/import", {
            method: "POST",
            body: JSON.stringify({ type: "book", input: { kind: "record", record: hits[0].record } }),
          });
          setOkMsg(`✅ ${r.record?.title ?? hits[0].name ?? "Libro"} añadido. ¿No es ese? elige abajo.`);
          setStatus("ok");
          setAddedKeys(new Set([0]));
        } catch (e) {
          setErrorMsg(errMsg(e, "No se pudo añadir el libro"));
          setStatus("error");
        }
      } else if (hits.length === 0) {
        setErrorMsg("No pude identificar el libro. Búscalo abajo por título/autor/ISBN o añádelo a mano.");
        setStatus("error");
      }
    },
    [setType]
  );

  // Share/deep-link de INMUEBLE: una URL de portal → flujo property (WebView).
  const handleIncomingUrl = useCallback((u: string) => {
    if (isPortalUrl(u)) {
      setType("property");
      setValue(u);
      setOkMsg(null);
      setErrorMsg(null);
      setProgress(0);
      setStatus("extracting");
    }
  }, []);

  // El layout raíz captura el share/deep-link (estés donde estés) y deja aquí la
  // URL de inmueble O el TEXTO compartido de un libro; consumimos cada canal y lo
  // limpiamos (patrón consumidor → un segundo share igual vuelve a dispararse).
  const {
    url: pendingUrl,
    setUrl: setPendingUrl,
    bookShare: pendingBookShare,
    setBookShare: setPendingBookShare,
  } = usePendingImport();
  useEffect(() => {
    if (pendingUrl) {
      handleIncomingUrl(pendingUrl);
      setPendingUrl(null);
    }
  }, [pendingUrl, handleIncomingUrl, setPendingUrl]);
  useEffect(() => {
    if (pendingBookShare) {
      void importBookShare(pendingBookShare);
      setPendingBookShare(null);
    }
  }, [pendingBookShare, importBookShare, setPendingBookShare]);

  // ── Buscador (mercados / empleo): nombre/ticker/keywords → candidatos ──────
  // Guard de respuesta obsoleta por id de ejecución (evita pisar con una vieja).
  const searchRunId = useRef(0);
  const runSearch = useCallback(
    async (raw: string) => {
      let q = raw.trim();
      // Libros: si pegas un ENLACE de libro (Casa del Libro, Amazon, Google
      // Books, una tienda…), extrae el ISBN/título de la URL y busca por eso,
      // no por la URL cruda (que no devuelve nada).
      if (type === "book") {
        const parsed = bookShareQuery(q);
        if (parsed) q = parsed.query;
      }
      // Empleo: se puede buscar solo por zona (puesto vacío).
      const zoneOnly = type === "job" && searchLocation.trim().length > 0;
      if (q.length < 2 && !zoneOnly) {
        setResults([]);
        setHasSearched(false);
        return;
      }
      setAddedKeys(new Set());
      setAddingIndex(null);
      const myId = ++searchRunId.current;
      setSearching(true);
      try {
        let url = `/api/records/search?type=${type}&q=${encodeURIComponent(q)}`;
        if (type === "job") {
          if (searchLocation.trim()) url += `&location=${encodeURIComponent(searchLocation.trim())}`;
          if (searchRemote) url += `&remote=1`;
          const sel = (["infojobs", "linkedin", "indeed"] as const).filter((k) => jobSources[k]);
          if (sel.length > 0) url += `&sources=${sel.join(",")}`;
        }
        const res = await api<{ results: SearchHit[] }>(url);
        if (myId === searchRunId.current) setResults(res.results ?? []);
      } catch {
        if (myId === searchRunId.current) setResults([]);
      } finally {
        if (myId === searchRunId.current) {
          setSearching(false);
          setHasSearched(true);
        }
      }
    },
    [type, searchLocation, searchRemote, jobSources]
  );

  // Mercados (Yahoo, gratis): búsqueda EN VIVO con debounce. Empleo (Apify, de
  // pago) usa searchOnSubmit → no busca al teclear (ver botón "Buscar").
  useEffect(() => {
    if (cfg.addMode !== "search" || cfg.searchOnSubmit) return;
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    const handle = setTimeout(() => void runSearch(q), 350);
    return () => clearTimeout(handle);
  }, [value, cfg.addMode, cfg.searchOnSubmit, runSearch]);

  // ── URL flow (inmuebles, vía WebView) ───────────────────────────────────
  function startUrlImport() {
    if (value.trim().length < 8 || status === "extracting" || status === "sending") return;
    setProgress(0);
    setStatus("extracting");
    setOkMsg(null);
    setErrorMsg(null);
  }

  async function handleExtracted(data: ExtractedPayload) {
    setStatus("sending");
    try {
      const res = await api<ImportResult>("/api/listings/import", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setOkMsg(res.created ? "✅ Inmueble creado" : res.priceChanged ? "💶 Precio actualizado" : "👌 Ya estaba en tu catálogo");
      setStatus("ok");
      setTimeout(() => router.push(`/property/${res.propertyId}`), 800);
    } catch (e) {
      setErrorMsg(errMsg(e, "Error al guardar el inmueble"));
      setStatus("error");
    }
  }

  // ── Symbol flow (cripto: símbolo directo / mercados: elegido del buscador) ─
  async function importSymbol(rawSymbol: string) {
    const symbol = rawSymbol.trim().toUpperCase();
    if (!symbol || status === "sending") return;
    setStatus("sending");
    setOkMsg(null);
    setErrorMsg(null);
    try {
      const res = await api<RecordImportResult>("/api/records/import", {
        method: "POST",
        body: JSON.stringify({ type, input: { kind: "symbol", symbol, quote: "EUR" } }),
      });
      setOkMsg(`✅ ${res.record?.title ?? symbol} ${res.created ? "añadido" : "actualizado"} en ${cfg.label}`);
      setStatus("ok");
    } catch (e) {
      setErrorMsg(errMsg(e, `No se pudo añadir ${symbol}`));
      setStatus("error");
    }
  }

  function addSymbol() {
    void importSymbol(value);
  }

  // Elegir un candidato del buscador. Empleo: el hit trae su `record` → se
  // guarda tal cual (kind:"record", sin re-llamar a la fuente de pago).
  // Mercados: import por símbolo (fetch server-side, gratis).
  async function importHit(hit: SearchHit, i: number) {
    if (addingIndex !== null || addedKeys.has(i)) return;
    setAddingIndex(i);
    setOkMsg(null);
    setErrorMsg(null);
    try {
      const input = hit.record
        ? { kind: "record", record: hit.record }
        : { kind: "symbol", symbol: hit.symbol.trim().toUpperCase(), quote: "EUR" };
      await api<RecordImportResult>("/api/records/import", {
        method: "POST",
        body: JSON.stringify({ type, input }),
      });
      // Confirmación visual en la propia fila (check verde), sin tarjeta grande.
      setAddedKeys((prev) => {
        const n = new Set(prev);
        n.add(i);
        return n;
      });
    } catch (e) {
      setErrorMsg(errMsg(e, `No se pudo añadir ${hit.name ?? hit.symbol ?? ""}`));
      setStatus("error");
    } finally {
      setAddingIndex(null);
    }
  }

  const isExtracting = status === "extracting";
  const isSending = status === "sending";
  const isBusy = isExtracting || isSending;
  // % de la barra: carga del anuncio durante la extracción; 100% al guardar.
  const progressPct = isSending ? 100 : Math.max(8, Math.round((progress || 0) * 100));

  return (
    <Screen contentStyle={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      {/* Selector de tipo (a qué menú va el registro) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeRow}
      >
        {orderedVisible
          .filter((t) => t !== "chat") // "Chat" no es un tipo de registro que se añada aquí.
          .map((t) => {
          const c = RECORD_TYPE_CONFIG[t];
          const active = type === t;
          return (
            <Pressable
              key={t}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              accessibilityState={{ selected: active }}
              onPress={() => {
                setType(t);
                setValue("");
                setResults([]);
                setHasSearched(false);
                setSearchLocation("");
                setSearchRemote(false);
                setJobSources({ infojobs: true, linkedin: true, indeed: true });
                setAddedKeys(new Set());
                setAddingIndex(null);
                reset();
              }}
              style={[styles.typeItem, active && { backgroundColor: th.accentSoft }]}
            >
              <Ionicons name={c.icon} size={24} color={active ? th.accent : th.textMuted} />
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.heading, { color: th.text }]}>Añadir {cfg.singular.toLowerCase()}</Text>

      {cfg.addMode === "soon" && (
        <EmptyState
          icon="time-outline"
          title="Próximamente"
          description={`Pronto podrás registrar ${cfg.label.toLowerCase()} en Nidokey.`}
        />
      )}

      {cfg.addMode === "wizard" && (
        <Card style={{ gap: 12 }}>
          <Text style={[styles.hintText, { color: th.textMuted }]}>
            Elige destino y fechas; verás alojamiento y desplazamiento con sus precios
            para montar tu viaje.
          </Text>
          <Button
            label="Crear viaje"
            icon="airplane-outline"
            onPress={() => router.push("/viajes/nuevo" as never)}
          />
        </Card>
      )}

      {cfg.addMode !== "soon" && cfg.addMode !== "wizard" && (
        <>
          <TextInput
            value={value}
            onChangeText={(t) => {
              setValue(t);
              reset();
              if (cfg.searchOnSubmit) setHasSearched(false);
            }}
            placeholder={cfg.addPlaceholder}
            placeholderTextColor={th.textSubtle}
            keyboardType={cfg.addMode === "url" ? "url" : "default"}
            autoCapitalize={cfg.addMode === "symbol" ? "characters" : "none"}
            autoCorrect={false}
            editable={!isBusy}
            returnKeyType={cfg.addMode === "search" ? "search" : "default"}
            onSubmitEditing={() => {
              if (cfg.addMode === "search" && cfg.searchOnSubmit) void runSearch(value);
            }}
            style={[styles.input, { backgroundColor: th.surface, borderColor: th.border, color: th.text }]}
          />

          {cfg.addMode !== "search" && (
            <Button
              label={cfg.addMode === "url" ? "Importar" : `Añadir ${cfg.singular.toLowerCase()}`}
              icon={cfg.addMode === "url" ? "arrow-down-circle-outline" : "add-circle-outline"}
              onPress={cfg.addMode === "url" ? startUrlImport : addSymbol}
              loading={isBusy}
              disabled={value.trim().length < (cfg.addMode === "url" ? 8 : 1)}
            />
          )}

          {type === "job" && (
            <>
              <View style={styles.sourcesRow}>
                {(
                  [
                    ["infojobs", "InfoJobs"],
                    ["linkedin", "LinkedIn"],
                    ["indeed", "Indeed"],
                  ] as const
                ).map(([k, label]) => {
                  const on = jobSources[k];
                  return (
                    <Pressable
                      key={k}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={label}
                      onPress={() => {
                        setJobSources((s) => {
                          const n = { ...s, [k]: !s[k] };
                          // Al menos una fuente activa.
                          if (!n.infojobs && !n.linkedin && !n.indeed) return s;
                          return n;
                        });
                        if (cfg.searchOnSubmit) setHasSearched(false);
                      }}
                      style={[
                        styles.sourceChip,
                        {
                          borderColor: on ? th.accent : th.border,
                          backgroundColor: on ? th.accentSoft : th.surface,
                        },
                      ]}
                    >
                      <Ionicons
                        name={on ? "checkmark-circle" : "ellipse-outline"}
                        size={16}
                        color={on ? th.accent : th.textSubtle}
                      />
                      <Text style={[styles.sourceChipText, { color: on ? th.accent : th.textMuted }]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={searchLocation}
                onChangeText={(t) => {
                  setSearchLocation(t);
                  if (cfg.searchOnSubmit) setHasSearched(false);
                }}
                placeholder="Ciudad o zona (opcional)"
                placeholderTextColor={th.textSubtle}
                autoCapitalize="words"
                autoCorrect={false}
                editable={!isBusy}
                returnKeyType="search"
                onSubmitEditing={() => void runSearch(value)}
                style={[styles.input, { backgroundColor: th.surface, borderColor: th.border, color: th.text }]}
              />
              <Pressable
                onPress={() => setSearchRemote((r) => !r)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: searchRemote }}
                style={styles.remoteToggle}
              >
                <Ionicons
                  name={searchRemote ? "checkbox" : "square-outline"}
                  size={20}
                  color={searchRemote ? th.accent : th.textSubtle}
                />
                <Text style={[styles.remoteLabel, { color: th.textMuted }]}>Solo remoto</Text>
              </Pressable>
            </>
          )}

          {cfg.addMode === "search" && cfg.searchOnSubmit && (
            <Button
              label="Buscar"
              icon="search-outline"
              onPress={() => void runSearch(value)}
              loading={searching}
              disabled={
                isSending ||
                (value.trim().length < 2 &&
                  !(type === "job" && searchLocation.trim().length > 0))
              }
            />
          )}

          {cfg.addMode === "search" && (searching || results.length > 0 || hasSearched) && (
            <View style={styles.results}>
              {searching && results.length === 0 && (
                <Text style={[styles.infoSub, { color: th.textSubtle }]}>Buscando…</Text>
              )}
              {!searching && hasSearched && results.length === 0 && (
                <Text style={[styles.infoSub, { color: th.textSubtle }]}>
                  Sin resultados para “{value.trim()}”.
                </Text>
              )}
              {results.map((hit, i) => {
                const jm = type === "job" ? jobMetaOf(hit) : null;
                const meta = [hit.symbol, hit.exchange, hit.type].filter(Boolean).join(" · ");
                const added = addedKeys.has(i);
                const adding = addingIndex === i;
                return (
                  <Pressable
                    key={`${hit.symbol}|${hit.name ?? ""}|${i}`}
                    accessibilityRole="button"
                    accessibilityLabel={added ? `${hit.name ?? hit.symbol} añadido` : `Añadir ${hit.name ?? hit.symbol}`}
                    onPress={() => void importHit(hit, i)}
                    disabled={added || addingIndex !== null}
                    style={[
                      styles.resultRow,
                      { backgroundColor: th.surface, borderColor: added ? "#15803D" : th.border },
                    ]}
                  >
                    <View style={styles.resultInfo}>
                      <Text style={[styles.resultName, { color: th.text }]} numberOfLines={2}>
                        {hit.name ?? hit.symbol}
                      </Text>
                      {jm ? (
                        <>
                          {jm.line2 && (
                            <Text style={[styles.resultMeta, { color: th.textSubtle }]} numberOfLines={1}>
                              {jm.line2}
                            </Text>
                          )}
                          {(jm.contract || jm.salary || jm.platform) && (
                            <Text style={[styles.resultMeta, { color: th.textMuted }]} numberOfLines={1}>
                              {jm.contract ?? ""}
                              {jm.salary ? (
                                <Text style={{ color: th.accent, fontWeight: "700" }}>
                                  {jm.contract ? " · " : ""}
                                  {jm.salary}
                                </Text>
                              ) : null}
                              {jm.platform ? `${jm.contract || jm.salary ? " · " : ""}${jm.platform}` : ""}
                            </Text>
                          )}
                        </>
                      ) : (
                        meta.length > 0 && (
                          <Text style={[styles.resultMeta, { color: th.textSubtle }]} numberOfLines={1}>
                            {meta}
                          </Text>
                        )
                      )}
                    </View>
                    {added ? (
                      <Ionicons name="checkmark-circle" size={24} color="#15803D" />
                    ) : adding ? (
                      <ActivityIndicator size="small" color={th.accent} />
                    ) : (
                      <Ionicons name="add-circle-outline" size={22} color={th.accent} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}

      {isBusy && (
        <Card>
          <View style={styles.loadingRow}>
            <ActivityIndicator color={th.primary} />
            <Text style={[styles.loadingText, { color: th.text }]}>
              {isSending
                ? `Guardando ${cfg.singular.toLowerCase()}…`
                : progress < 1
                ? "Cargando el anuncio…"
                : "Leyendo datos del inmueble…"}
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: th.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: th.primary, width: `${progressPct}%` as `${number}%` },
              ]}
            />
          </View>
          <Text style={[styles.infoSub, { color: th.textSubtle }]}>
            {isExtracting
              ? "Si aparece una verificación, la verás automáticamente."
              : "Casi listo…"}
          </Text>
        </Card>
      )}

      {status === "ok" && okMsg && (
        <Card>
          <Text style={[styles.resultText, { color: th.text }]}>{okMsg}</Text>
          {(cfg.addMode === "symbol" || cfg.addMode === "search") && (
            <Button
              label={`Ver ${cfg.label}`}
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => router.push("/" as never)}
              style={styles.retry}
            />
          )}
        </Card>
      )}

      {status === "error" && errorMsg && (
        <Card>
          <Text style={[styles.errorText, { color: th.dangerFg }]}>{errorMsg}</Text>
          <Button label="Intentar de nuevo" variant="ghost" size="sm" fullWidth={false} onPress={reset} style={styles.retry} />
        </Card>
      )}

      {cfg.addMode === "url" && (
        <Card style={styles.hintBox}>
          <Text style={[styles.hintTitle, { color: th.textMuted }]}>Cómo añadir inmuebles</Text>
          <Text style={[styles.hintText, { color: th.textSubtle }]}>
            1. Abre un anuncio en Chrome{"\n"}2. Pulsa Compartir → Nidokey{"\n"}3. La URL aparecerá aquí automáticamente
          </Text>
        </Card>
      )}
      {cfg.addMode === "symbol" && (
        <Card style={styles.hintBox}>
          <Text style={[styles.hintTitle, { color: th.textMuted }]}>Cómo añadir {cfg.label.toLowerCase()}</Text>
          <Text style={[styles.hintText, { color: th.textSubtle }]}>
            Escribe el símbolo (p. ej. BTC) y pulsa Añadir. Nidokey buscará su precio y seguirá su evolución.
          </Text>
        </Card>
      )}
      {cfg.addMode === "search" && (
        <Card style={styles.hintBox}>
          <Text style={[styles.hintTitle, { color: th.textMuted }]}>Cómo añadir {cfg.label.toLowerCase()}</Text>
          <Text style={[styles.hintText, { color: th.textSubtle }]}>
            {type === "job"
              ? "Elige las fuentes (InfoJobs, LinkedIn, Indeed) y escribe el puesto y/o la ciudad o zona. Puedes dejar el puesto vacío y buscar todo lo que haya en esa zona. Pulsa Buscar y elige una oferta para guardarla en tus Empleos."
              : type === "book"
              ? "Busca por título, autor, ISBN o palabra clave (p. ej. “sapiens”, “Yuval Harari”, “9780099590088”), pulsa Buscar y elige el libro de la lista para guardarlo en tus Libros.\n\nOjo: no todas las apps comparten bien con Nidokey (la app de Amazon, por ejemplo, abre una ventana nueva y no añade el libro). Si te pasa, copia el enlace o el título y búscalo aquí."
              : "Escribe el nombre o el ticker (p. ej. “sxr8”, “apple”, “vaneck space”) y elige el correcto de la lista — con su bolsa. Sin sufijos ni colisiones."}
          </Text>
        </Card>
      )}

      {type === "book" && (
        <Card>
          {!manualOpen ? (
            <View style={{ gap: 4 }}>
              <Pressable onPress={() => router.push("/scan-book")} style={styles.manualToggle}>
                <Ionicons name="barcode-outline" size={18} color={th.primary} />
                <Text style={[styles.manualToggleText, { color: th.primary }]}>
                  Escanear código de barras
                </Text>
              </Pressable>
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: th.border }} />
              <Pressable onPress={() => setManualOpen(true)} style={styles.manualToggle}>
                <Ionicons name="create-outline" size={16} color={th.primary} />
                <Text style={[styles.manualToggleText, { color: th.primary }]}>
                  ¿No aparece? Añádelo a mano
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.manualForm}>
              <Text style={[styles.hintTitle, { color: th.textMuted }]}>Añadir libro a mano</Text>
              <TextInput
                placeholder="Título *"
                placeholderTextColor={th.textSubtle}
                value={manualTitle}
                onChangeText={setManualTitle}
                style={[styles.input, { color: th.text, borderColor: th.border, backgroundColor: th.bg }]}
              />
              <TextInput
                placeholder="Autor"
                placeholderTextColor={th.textSubtle}
                value={manualAuthor}
                onChangeText={setManualAuthor}
                style={[styles.input, { color: th.text, borderColor: th.border, backgroundColor: th.bg }]}
              />
              <TextInput
                placeholder="Sinopsis / notas (opcional)"
                placeholderTextColor={th.textSubtle}
                value={manualNotes}
                onChangeText={setManualNotes}
                multiline
                style={[
                  styles.input,
                  styles.inputMultiline,
                  { color: th.text, borderColor: th.border, backgroundColor: th.bg },
                ]}
              />
              <TextInput
                placeholder="ISBN (opcional)"
                placeholderTextColor={th.textSubtle}
                value={manualIsbn}
                onChangeText={setManualIsbn}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                style={[styles.input, { color: th.text, borderColor: th.border, backgroundColor: th.bg }]}
              />

              {/* Portada (opcional): se SUGIERE de internet y el usuario elige; el
                  alta es literal, esto solo adjunta la imagen seleccionada. */}
              <Pressable
                onPress={suggestCover}
                disabled={
                  coverLoading ||
                  (manualTitle.trim().length < 2 &&
                    manualIsbn.replace(/[^0-9Xx]/g, "").length < 10)
                }
                style={styles.manualToggle}
              >
                <Ionicons name="image-outline" size={16} color={th.primary} />
                <Text style={[styles.manualToggleText, { color: th.primary }]}>
                  {coverLoading ? "Buscando portadas…" : "Sugerir portada (opcional)"}
                </Text>
              </Pressable>
              {manualCovers.filter((c) => !coverFailed.has(c.url)).length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                >
                  {manualCovers
                    .filter((c) => !coverFailed.has(c.url))
                    .map((c) => {
                      const sel = c.url === manualCover;
                      return (
                        <Pressable key={c.url} onPress={() => setManualCover(sel ? null : c.url)}>
                          <Image
                            source={{ uri: c.url }}
                            style={[
                              styles.coverThumb,
                              {
                                borderColor: sel ? th.primary : th.border,
                                borderWidth: sel ? 2 : 1,
                              },
                            ]}
                            contentFit="cover"
                            onError={() =>
                              setCoverFailed((s) => {
                                const n = new Set(s);
                                n.add(c.url);
                                return n;
                              })
                            }
                          />
                          {sel ? (
                            <View style={styles.coverCheck}>
                              <Ionicons name="checkmark-circle" size={18} color={th.primary} />
                            </View>
                          ) : null}
                        </Pressable>
                      );
                    })}
                </ScrollView>
              ) : manualCovers.length > 0 ? (
                <Text style={[styles.hintText, { color: th.textSubtle }]}>
                  No encontré portadas; puedes guardarlo sin imagen.
                </Text>
              ) : null}

              <Button
                label={manualSaving ? "Guardando…" : "Guardar libro"}
                onPress={submitManual}
                disabled={manualTitle.trim().length < 2 || manualSaving}
              />
            </View>
          )}
        </Card>
      )}

      </ScrollView>

      {isExtracting && (
        <WebViewImporter
          url={value.trim()}
          onExtracted={handleExtracted}
          onError={(reason) => { setErrorMsg(reason || "No se pudo extraer datos del anuncio"); setStatus("error"); }}
          onCancel={reset}
          onProgress={setProgress}
        />
      )}
    </Screen>
  );
}

/** Datos de empleo embebidos en el candidato (para mostrar sueldo/contrato). */
function jobMetaOf(
  hit: SearchHit
): { line2?: string; contract?: string; salary?: string; platform?: string } | null {
  const rec = hit.record as { meta?: Record<string, unknown> } | undefined;
  const m = rec?.meta;
  if (!m) return null;
  const s = (k: string) => (typeof m[k] === "string" && m[k] ? (m[k] as string) : undefined);
  const platform = s("platform");
  return {
    line2: [s("company"), s("location")].filter(Boolean).join(" · ") || undefined,
    contract: s("contractType"),
    salary: s("salaryLabel"),
    platform:
      platform === "linkedin"
        ? "LinkedIn"
        : platform === "infojobs"
        ? "InfoJobs"
        : platform === "indeed"
        ? "Indeed"
        : undefined,
  };
}

/** ¿El primer resultado casa FUERTE con el título compartido? Solo entonces
 *  auto-añadimos por título (evita meter el libro equivocado). Títulos cortos o
 *  de 1–2 palabras se consideran ambiguos → mejor elegir a mano. */
function strongTitleMatch(shared: string, hitName: string | null): boolean {
  if (!hitName) return false;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const a = norm(shared);
  const b = norm(hitName);
  if (a.length < 12 || a.split(" ").length < 3) return false;
  return b.includes(a) || a.includes(b);
}

function errMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.body && typeof e.body === "object") {
    const b = e.body as { error?: string; message?: string };
    return b.error ?? b.message ?? e.message;
  }
  return e instanceof Error ? e.message : fallback;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  typeRow: { gap: 6, paddingBottom: 4 },
  typeItem: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 16, fontWeight: "700" },
  input: { height: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  inputMultiline: { height: undefined, minHeight: 80, paddingVertical: 10, textAlignVertical: "top" },
  infoText: { fontSize: 14, fontWeight: "500" },
  infoSub: { fontSize: 12, lineHeight: 16, marginTop: 6 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { fontSize: 14, fontWeight: "600" },
  progressTrack: { height: 6, borderRadius: 999, overflow: "hidden", marginTop: 12 },
  progressFill: { height: 6, borderRadius: 999, minWidth: 6 },
  resultText: { fontSize: 14, fontWeight: "500" },
  manualToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 2 },
  manualToggleText: { fontSize: 14, fontWeight: "600" },
  manualForm: { gap: 10 },
  coverThumb: { width: 56, height: 84, borderRadius: 6, backgroundColor: "#00000010" },
  coverCheck: { position: "absolute", top: 2, right: 2, borderRadius: 999, backgroundColor: "#fff" },
  remoteToggle: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  remoteLabel: { fontSize: 13, fontWeight: "500" },
  sourcesRow: { flexDirection: "row", gap: 8 },
  sourceChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
  },
  sourceChipText: { fontSize: 13, fontWeight: "600" },
  results: { gap: 8 },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resultInfo: { flex: 1 },
  resultName: { fontSize: 14, fontWeight: "600" },
  resultMeta: { fontSize: 12, marginTop: 2 },
  errorText: { fontSize: 13 },
  retry: { marginTop: 6 },
  hintBox: { marginTop: "auto" },
  hintTitle: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  hintText: { fontSize: 12, lineHeight: 18 },
});
