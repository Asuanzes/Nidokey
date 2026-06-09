import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { captureRef } from "react-native-view-shot";
import RNShare from "react-native-share";

import { useTheme } from "@/lib/theme";
import { fonts } from "@/lib/fonts";
import { Button } from "@/components/ui";
import { type Article, type ArticleExtract, extractSummaryFromHtml } from "@/lib/article";

type Status = "loading" | "success" | "error";

/**
 * Pantalla de detalle de noticia (genérica). Recibe un `Article` y muestra:
 *  - cabecera (título · fuente · fecha · resumen corto),
 *  - el artículo embebido en un WebView (loading / éxito / error + reintentar),
 *  - acciones: Compartir (share nativo) y Abrir artículo completo (navegador
 *    externo del sistema).
 *
 * El resumen usa `article.summary` si existe; si no, se extrae del HTML cargado
 * (og:description o `extractSummaryFromHtml`) vía JS inyectado en el WebView.
 */

// Inyectado al cargar: devuelve og:description + el HTML principal (capado) para
// poder resumir en cliente. Termina en `true;` para evitar el warning de RN.
const EXTRACT_SCRIPT = `(function(){try{
  var pick=function(s){var e=document.querySelector(s);return e?(e.innerHTML||''):'';};
  var main=pick('article')||pick('main')||(document.body?document.body.innerHTML:'');
  if(main.length>30000)main=main.slice(0,30000);
  var og=document.querySelector('meta[property="og:description"],meta[name="description"]');
  window.ReactNativeWebView.postMessage(JSON.stringify({
    ogDescription:(og&&og.content)?og.content:null, mainHtml:main||null
  }));
}catch(e){window.ReactNativeWebView.postMessage(JSON.stringify({ogDescription:null,mainHtml:null}));}})();true;`;

// ── Bloqueo de anuncios (best-effort, sin librería nativa) ──
// (1) CSS inyectado ANTES de cargar: oculta los contenedores de anuncios más
// comunes y desactiva los pop-ups (window.open). (2) onShouldStartLoadWithRequest
// corta navegaciones/iframes hacia dominios de anuncios/trackers conocidos.
const AD_HIDE_JS = `(function(){try{
  var css='ins.adsbygoogle,.adsbygoogle,[id*="google_ads"],[id*="div-gpt-ad"],[class*="ad-slot"],[class*="adslot"],[class*="advertisement"],[class*="-advert"],[data-ad-slot],[data-ad-client],[class*="taboola"],[id*="taboola"],[class*="outbrain"],[id*="outbrain-"],iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[src*="adservice"],iframe[src*="amazon-adsystem"]{display:none!important;height:0!important;min-height:0!important;}';
  var s=document.createElement('style');s.id='nk-adblock';s.appendChild(document.createTextNode(css));
  (document.head||document.documentElement).appendChild(s);
  window.open=function(){return null;};
}catch(e){}})();true;`;

const AD_HOSTS = [
  "doubleclick.net", "googlesyndication.com", "adservice.google", "googletagservices.com",
  "google-analytics.com", "googletagmanager.com", "amazon-adsystem.com", "adnxs.com",
  "taboola.com", "outbrain.com", "criteo.", "scorecardresearch.com", "moatads.com",
  "pubmatic.com", "rubiconproject.com", "casalemedia.com", "adsafeprotected.com",
  "2mdn.net", "zedo.com", "adcolony.com", "applovin.com",
];

function isAdHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return AD_HOSTS.some((d) => h.includes(d));
  } catch {
    return false;
  }
}

export function ArticleWebViewScreen({ article }: { article: Article }) {
  const { th } = useTheme();
  const insets = useSafeAreaInsets();
  const ref = useRef<WebView>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [reloadKey, setReloadKey] = useState(0); // remount → reintento limpio
  const [extracted, setExtracted] = useState<string | null>(null);
  const shotRef = useRef<View>(null);
  const [capturing, setCapturing] = useState(false);

  // Precedencia: resumen del backend → og:description / extracción del HTML.
  const summary = useMemo(
    () => article.summary?.trim() || extracted || null,
    [article.summary, extracted],
  );
  const meta = useMemo(
    () => [article.source, formatDate(article.publishedAt)].filter(Boolean).join(" · "),
    [article.source, article.publishedAt],
  );

  function onMessage(e: { nativeEvent: { data: string } }) {
    if (article.summary) return; // el resumen del backend manda
    try {
      const p = JSON.parse(e.nativeEvent.data) as ArticleExtract;
      const next =
        p.ogDescription?.trim() || (p.mainHtml ? extractSummaryFromHtml(p.mainHtml) : "");
      if (next) setExtracted(next);
    } catch {
      /* mensaje malformado → ignorar */
    }
  }

  function retry() {
    setStatus("loading");
    setExtracted(null);
    setReloadKey((k) => k + 1);
  }

  // Compartir = captura del bloque del título (con "NIDOKEY")
  // + enlace TOCABLE a la noticia.
  async function onShare() {
    try {
      setCapturing(true);
      await new Promise((r) => setTimeout(r, 60)); // deja renderizar el pie de marca
      let uri: string;
      try {
        uri = await captureRef(shotRef, { format: "png", quality: 1 });
      } finally {
        setCapturing(false);
      }
      const fileUrl = uri.startsWith("file://") ? uri : `file://${uri}`;
      await RNShare.open({
        url: fileUrl,
        type: "image/png",
        message: `${article.title}\n${article.url}\n\nNIDOKEY`,
        failOnCancel: false,
      });
    } catch (err) {
      setCapturing(false);
      console.warn("[share]", err instanceof Error ? err.message : err);
    }
  }

  function openExternal() {
    void Linking.openURL(article.url); // navegador EXTERNO del sistema
  }

  return (
    <View style={[styles.flex, { backgroundColor: th.bg }]}>
      <View
        ref={shotRef}
        collapsable={false}
        style={[styles.header, styles.headerCard, { backgroundColor: th.surface, borderColor: th.border }]}
      >
        <Text style={[styles.title, { color: th.text }]} numberOfLines={3}>
          {article.title}
        </Text>
        {meta ? <Text style={[styles.meta, { color: th.textSubtle }]}>{meta}</Text> : null}
        {summary ? (
          <Text style={[styles.summary, { color: th.textMuted }]} numberOfLines={4}>
            {summary}
          </Text>
        ) : status === "loading" ? (
          <Text style={[styles.summary, { color: th.textSubtle }]}>Cargando resumen…</Text>
        ) : null}
        {capturing ? (
          <Text style={[styles.brandFooter, { color: th.textSubtle }]}>NIDOKEY</Text>
        ) : null}
      </View>

      <View style={styles.webWrap}>
        <WebView
          key={reloadKey}
          ref={ref}
          source={{ uri: article.url }}
          injectedJavaScriptBeforeContentLoaded={AD_HIDE_JS}
          onLoadStart={() => setStatus("loading")}
          onLoad={() => setStatus("success")}
          onLoadEnd={() => ref.current?.injectJavaScript(EXTRACT_SCRIPT)}
          onError={({ nativeEvent }) => {
            // Solo el documento principal; ignora errores de subframes/ads.
            if (!nativeEvent.url || nativeEvent.url === article.url) setStatus("error");
          }}
          onHttpError={({ nativeEvent }) => {
            if (nativeEvent.url === article.url && nativeEvent.statusCode >= 400) {
              setStatus("error");
            }
          }}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={(req) => req.url === article.url || !isAdHost(req.url)}
          javaScriptEnabled
          domStorageEnabled
          applicationNameForUserAgent="Chrome/131.0.0.0 Mobile Safari/537.36"
          style={styles.flex}
        />

        {status === "loading" ? (
          <View style={[styles.overlay, { backgroundColor: th.bg }]} pointerEvents="none">
            <ActivityIndicator color={th.primary} />
          </View>
        ) : null}

        {status === "error" ? (
          <View style={[styles.overlay, { backgroundColor: th.bg }]}>
            <Text style={[styles.errTitle, { color: th.text }]}>
              No se pudo cargar el artículo
            </Text>
            <Text style={[styles.errDesc, { color: th.textMuted }]}>
              Comprueba tu conexión e inténtalo de nuevo.
            </Text>
            <Button
              label="Reintentar"
              icon="refresh"
              variant="secondary"
              fullWidth={false}
              onPress={retry}
              style={styles.retryBtn}
            />
          </View>
        ) : null}
      </View>

      {/* Acciones solo-icono, abajo a la derecha (flotan sobre el WebView). */}
      <View style={[styles.actions, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <Pressable
          onPress={onShare}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Compartir"
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: th.surface, borderColor: th.border, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Ionicons name="share-social-outline" size={22} color={th.primary} />
        </Pressable>
        <Pressable
          onPress={openExternal}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Abrir artículo completo"
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: th.surface, borderColor: th.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="open-outline" size={22} color={th.primary} />
        </Pressable>
      </View>
    </View>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { marginHorizontal: 12, marginTop: 10, marginBottom: 8, gap: 4 },
  headerCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  brandFooter: { fontSize: 11, letterSpacing: 1, textAlign: "center", marginTop: 8, paddingHorizontal: 2 },
  title: { fontSize: 18, fontFamily: fonts.bodyBold, lineHeight: 23 },
  meta: { fontSize: 12 },
  summary: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  webWrap: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 4,
  },
  errTitle: { fontSize: 15, fontFamily: fonts.bodySemibold },
  errDesc: { fontSize: 13, textAlign: "center" },
  retryBtn: { marginTop: 12 },
  actions: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    gap: 12,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
});
