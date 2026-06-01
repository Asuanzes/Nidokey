import { useCallback, useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ShareMenu, { type ShareData } from "react-native-share-menu";
import { router } from "expo-router";

import { RECORD_TYPES, type RecordType } from "@nidokey/shared";
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

const PORTAL_HOSTS = [
  "fotocasa.", "pisos.com", "habitaclia.", "thinkspain.", "indomio.",
  "idealista.", "milanuncios.", "yaencontre.",
];

function isPortalUrl(u: string): boolean {
  try {
    const hostname = new URL(u).hostname.toLowerCase();
    return PORTAL_HOSTS.some((h) => hostname.includes(h));
  } catch {
    return false;
  }
}

function extractUrl(data: ShareData): string | null {
  if (!data?.data) return null;
  const items = Array.isArray(data.data) ? data.data : [data.data];
  for (const item of items) {
    const text = typeof item === "string" ? item : item?.data ?? "";
    const match = text.match(/https?:\/\/[^\s]+/);
    if (match && isPortalUrl(match[0])) return match[0];
  }
  return null;
}

type ImportResult = { created: boolean; priceChanged: boolean; propertyId: string };
type RecordImportResult = { created: boolean; record: { id: string; title: string } | null };
type SearchHit = { symbol: string; name: string | null; exchange: string | null; type: string | null };

type Status = "idle" | "extracting" | "sending" | "ok" | "error";

export default function ImportarScreen() {
  const { th } = useTheme();
  const [type, setType] = useState<RecordType>("property");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const cfg = RECORD_TYPE_CONFIG[type];

  function reset() {
    setStatus("idle");
    setOkMsg(null);
    setErrorMsg(null);
  }

  // Share / deep-link: solo aplica a inmuebles (URL de portal).
  const handleIncomingUrl = useCallback((u: string) => {
    if (isPortalUrl(u)) {
      setType("property");
      setValue(u);
      setStatus("idle");
      setOkMsg(null);
      setErrorMsg(null);
    }
  }, []);

  const handleShare = useCallback(
    (data: ShareData | null) => {
      if (!data) return;
      const u = extractUrl(data);
      if (u) handleIncomingUrl(u);
    },
    [handleIncomingUrl]
  );

  useEffect(() => {
    Linking.getInitialURL().then((u) => { if (u) handleIncomingUrl(u); });
    const linkSub = Linking.addEventListener("url", ({ url: u }) => handleIncomingUrl(u));
    ShareMenu.getInitialShare(handleShare);
    const shareSub = ShareMenu.addNewShareListener(handleShare);
    return () => {
      linkSub.remove();
      shareSub.remove();
    };
  }, [handleIncomingUrl, handleShare]);

  // ── Buscador (mercados): teclear nombre/ticker → resultados con su bolsa ──
  useEffect(() => {
    if (cfg.addMode !== "search") return;
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const res = await api<{ results: SearchHit[] }>(
          `/api/records/search?type=${type}&q=${encodeURIComponent(q)}`
        );
        if (!cancelled) setResults(res.results ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [value, type, cfg.addMode]);

  // ── URL flow (inmuebles, vía WebView) ───────────────────────────────────
  function startUrlImport() {
    if (value.trim().length < 8 || status === "extracting" || status === "sending") return;
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

  const isExtracting = status === "extracting";
  const isSending = status === "sending";
  const isBusy = isExtracting || isSending;

  return (
    <Screen contentStyle={styles.content}>
      {/* Selector de tipo (a qué menú va el registro) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeRow}
      >
        {RECORD_TYPES.map((t) => {
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

      {cfg.addMode !== "soon" && (
        <>
          <TextInput
            value={value}
            onChangeText={(t) => { setValue(t); reset(); }}
            placeholder={cfg.addPlaceholder}
            placeholderTextColor={th.textSubtle}
            keyboardType={cfg.addMode === "url" ? "url" : "default"}
            autoCapitalize={cfg.addMode === "symbol" ? "characters" : "none"}
            autoCorrect={false}
            editable={!isBusy}
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

          {cfg.addMode === "search" && value.trim().length >= 2 && (
            <View style={styles.results}>
              {searching && results.length === 0 && (
                <Text style={[styles.infoSub, { color: th.textSubtle }]}>Buscando…</Text>
              )}
              {!searching && results.length === 0 && (
                <Text style={[styles.infoSub, { color: th.textSubtle }]}>
                  Sin resultados para “{value.trim()}”.
                </Text>
              )}
              {results.map((hit) => (
                <Pressable
                  key={`${hit.symbol}-${hit.exchange ?? ""}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Añadir ${hit.name ?? hit.symbol}`}
                  onPress={() => void importSymbol(hit.symbol)}
                  disabled={isSending}
                  style={[styles.resultRow, { backgroundColor: th.surface, borderColor: th.border }]}
                >
                  <View style={styles.resultInfo}>
                    <Text style={[styles.resultName, { color: th.text }]} numberOfLines={1}>
                      {hit.name ?? hit.symbol}
                    </Text>
                    <Text style={[styles.resultMeta, { color: th.textSubtle }]} numberOfLines={1}>
                      {hit.symbol}
                      {hit.exchange ? ` · ${hit.exchange}` : ""}
                      {hit.type ? ` · ${hit.type}` : ""}
                    </Text>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={th.accent} />
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {isExtracting && (
        <Card>
          <Text style={[styles.infoText, { color: th.textMuted }]}>🌐 Cargando el anuncio en segundo plano…</Text>
          <Text style={[styles.infoSub, { color: th.textSubtle }]}>Si aparece una verificación la verás automáticamente.</Text>
        </Card>
      )}
      {isSending && (
        <Card>
          <Text style={[styles.infoText, { color: th.textMuted }]}>☁️ Guardando…</Text>
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
              onPress={() => router.push(`/?type=${type}` as never)}
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
            Escribe el nombre o el ticker (p. ej. “sxr8”, “apple”, “vaneck space”) y elige el
            correcto de la lista — con su bolsa. Sin sufijos ni colisiones.
          </Text>
        </Card>
      )}

      {isExtracting && (
        <WebViewImporter
          url={value.trim()}
          onExtracted={handleExtracted}
          onError={(reason) => { setErrorMsg(reason || "No se pudo extraer datos del anuncio"); setStatus("error"); }}
          onCancel={reset}
        />
      )}
    </Screen>
  );
}

function errMsg(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.body && typeof e.body === "object") {
    const b = e.body as { error?: string; message?: string };
    return b.error ?? b.message ?? e.message;
  }
  return e instanceof Error ? e.message : fallback;
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  typeRow: { gap: 6, paddingBottom: 4 },
  typeItem: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 16, fontWeight: "700" },
  input: { height: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  infoText: { fontSize: 14, fontWeight: "500" },
  infoSub: { fontSize: 12, lineHeight: 16, marginTop: 6 },
  resultText: { fontSize: 14, fontWeight: "500" },
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
