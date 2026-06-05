import "@/lib/logbox"; // PRIMERO: silencia warnings benignos de NativeEventEmitter
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Appearance, StyleSheet, View } from "react-native";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import * as SplashScreen from "expo-splash-screen";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeContext, T, TD, useTheme, type ThemeMode } from "@/lib/theme";
import { isPortalUrl, extractSharedText } from "@/lib/portal-url";
import { isBookShareText } from "@/lib/book-url";
import { PendingImportProvider, usePendingImport } from "@/lib/pending-import";
import { BrandLoading } from "@/components/BrandLoading";
import { BootProvider, useBoot } from "@/lib/boot-context";
import { CategoryPrefsProvider } from "@/lib/records/category-prefs-context";

// Mantener el splash nativo hasta que la sesión esté resuelta: evita el
// "cuadrado blanco" y el flash blanco entre el splash y el primer render.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Sembrar el tema desde el modo del SO de forma SÍNCRONA en el primer frame:
  // si arrancáramos siempre en claro (false), un usuario en modo oscuro vería
  // unos frames con fondo claro (#FAFAF7) sobre negro — el "cuadrado claro" del
  // arranque (visible en dev Y en release). SecureStore (async) luego respeta la
  // preferencia guardada del usuario si la hay.
  // Tema: "auto" sigue el sistema (default); "light"/"dark" lo fijan. Sembramos el
  // estado del SO de forma SÍNCRONA en el primer frame (evita el "cuadrado claro"
  // al arrancar en oscuro). SecureStore (async) carga luego la preferencia guardada.
  const [themeMode, setThemeModeState] = useState<ThemeMode>("auto");
  const [systemDark, setSystemDark] = useState(() => Appearance.getColorScheme() === "dark");

  useEffect(() => {
    SecureStore.getItemAsync("nidokey.theme")
      .then((v) => {
        if (v === "dark" || v === "light" || v === "auto") setThemeModeState(v);
      })
      .catch(() => {});
  }, []);

  // En modo "auto", seguir en vivo los cambios de tema del sistema.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) =>
      setSystemDark(colorScheme === "dark")
    );
    return () => sub.remove();
  }, []);

  // Red de seguridad: si la sesión tardara demasiado, no dejar el splash colgado.
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 3000);
    return () => clearTimeout(t);
  }, []);

  const setThemeMode = (m: ThemeMode) => {
    setThemeModeState(m);
    SecureStore.setItemAsync("nidokey.theme", m).catch(() => {});
  };
  const dark = themeMode === "auto" ? systemDark : themeMode === "dark";
  const toggleTheme = () => setThemeMode(dark ? "light" : "dark");

  const th = dark ? TD : T;

  return (
    // ShareIntentProvider entrega el contenido compartido al hook (un solo root)
    // en vez de montar una 2ª instancia como react-native-share-menu.
    <ShareIntentProvider options={{ resetOnBackground: true }}>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: th.bg }}>
      <AuthProvider>
        <ThemeContext.Provider value={{ dark, th, themeMode, setThemeMode, toggleTheme }}>
          <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <PendingImportProvider>
              <BootProvider>
                <CategoryPrefsProvider>
                  <AuthGate />
                </CategoryPrefsProvider>
              </BootProvider>
              <StatusBar style="auto" />
            </PendingImportProvider>
          </ThemeProvider>
        </ThemeContext.Provider>
      </AuthProvider>
    </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}

function AuthGate() {
  const { state } = useAuth();
  const { th } = useTheme();
  const segments = useSegments();
  const router = useRouter();
  // Estado del navegador raíz: su `.key` solo existe cuando el Stack está
  // montado. Lo usamos para no navegar antes de tiempo (cold-start desde share).
  const rootNavState = useRootNavigationState();
  const { setUrl, setBookShare } = usePendingImport();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  // El loader (bolitas) se queda hasta que: la sesión está resuelta + (si está
  // logueado) los REGISTROS de la primera pantalla (Inmuebles) ya cargaron + un
  // mínimo de 1 s para que se vean girar. Así las bolitas tapan también la
  // precarga de los registros → UNA sola carga, no dos.
  const { firstScreenReady } = useBoot();
  const authResolved = state.kind !== "loading";

  const [minElapsed, setMinElapsed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 1000);
    return () => clearTimeout(t);
  }, []);

  // Red de seguridad: nunca dejar el loader colgado más de 8 s si los registros
  // tardaran o fallaran sin avisar.
  const [bootTimedOut, setBootTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setBootTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, []);

  const dataReady = state.kind !== "authed" || firstScreenReady || bootTimedOut;
  const showLoader = !(authResolved && dataReady && minElapsed);

  // El redirect se dispara en cuanto la sesión resuelve (el Stack ya está montado
  // debajo del overlay), así la pantalla de registros monta y empieza a cargar.
  useEffect(() => {
    if (!authResolved) return;
    // Mismo guard que el efecto del share: el <Stack> se renderiza condicionalmente
    // (`authResolved ? <Stack> : null`), así que monta tarde y este redirect corre en
    // la MISMA transición que lo revela → sin esperar a que el navegador raíz esté
    // montado, router.replace puede lanzar "navigate before mounting" en frío.
    if (!rootNavState?.key) return;
    const onLogin = segments[0] === "login";
    if (state.kind === "unauthed" && !onLogin) {
      router.replace("/login");
    } else if (state.kind === "authed" && onLogin) {
      router.replace("/(tabs)");
    }
  }, [authResolved, rootNavState?.key, state, segments, router]);

  // Ocultar el splash nativo en cuanto monta el JS, para que SÍ se vea la
  // pantalla de carga (BrandLoading) mientras se resuelve la sesión, en vez de
  // saltar del splash directo a la app. Mismo fondo que el splash → sin saltos.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Deep links (expo-linking): una URL de portal abierta como enlace → Importar.
  useEffect(() => {
    if (state.kind !== "authed") return;
    let alive = true;
    const go = (u: string | null) => {
      if (alive && u && isPortalUrl(u)) {
        setUrl(u);
        router.navigate("/importar");
      }
    };
    Linking.getInitialURL().then((u) => go(u ?? null));
    const linkSub = Linking.addEventListener("url", ({ url }) => go(url));
    return () => {
      alive = false;
      linkSub.remove();
    };
  }, [state.kind, router, setUrl]);

  // Share-to-app (expo-share-intent): la hoja de Compartir entrega el contenido al
  // HOOK (un solo root React — no crea una 2ª instancia como react-native-share-menu,
  // que corrompía TODA la navegación). Clasificamos el texto compartido: URL de
  // portal → inmueble; ISBN/host de libro → libro. Navegamos a Importar (seguro
  // ahora) y allí se auto-importa.
  useEffect(() => {
    if (state.kind !== "authed" || !hasShareIntent) return;
    const text = extractSharedText(shareIntent);
    if (text) {
      const url = text.match(/https?:\/\/[^\s]+/)?.[0] ?? null;
      if (url && isPortalUrl(url)) {
        setUrl(url);
        router.navigate("/importar");
      } else if (isBookShareText(text)) {
        setBookShare(text);
        router.navigate("/importar");
      }
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, state.kind, router, setUrl, setBookShare, resetShareIntent]);

  return (
    <>
      {/* El navegador (<Stack>) se monta SIEMPRE desde el primer render — nunca
          condicionado a authResolved. Es la única forma fiable de evitar el
          "Attempted to navigate before mounting the Root Layout": si el Stack
          falta aunque sea un instante, cualquier navegación (share, ficha,
          botones) revienta. El loader se superpone encima mientras resuelve la
          sesión; las pantallas leen el token de SecureStore en cada llamada, así
          que no fallan por montar antes de que el AuthProvider resuelva. */}
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="property/[id]"
            options={{
              headerShown: true,
              headerBackTitle: "Atrás",
              headerTintColor: "#B87333",
              headerStyle: { backgroundColor: "#fff" },
              title: "",
            }}
          />
          <Stack.Screen
            name="job/[id]"
            options={{
              headerShown: true,
              headerBackTitle: "Atrás",
              headerTintColor: "#B87333",
              headerStyle: { backgroundColor: "#fff" },
              title: "Empleo",
            }}
          />
          <Stack.Screen
            name="book/[id]"
            options={{
              headerShown: true,
              headerBackTitle: "Atrás",
              headerTintColor: th.primary,
              headerStyle: { backgroundColor: th.surface },
              headerTitleStyle: { color: th.text },
              title: "Libro",
            }}
          />
          <Stack.Screen
            name="article"
            options={{
              headerShown: true,
              headerBackTitle: "Atrás",
              headerTintColor: th.primary,
              headerStyle: { backgroundColor: th.surface },
              headerTitleStyle: { color: th.text },
              title: "Noticia",
            }}
          />
          <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
          <Stack.Screen
            name="tools/mortgage"
            options={{
              headerShown: true,
              headerBackTitle: "Atrás",
              headerTintColor: th.primary,
              headerStyle: { backgroundColor: th.surface },
              headerTitleStyle: { color: th.text },
            }}
          />
          <Stack.Screen
            name="tools/[tool]"
            options={{
              headerShown: true,
              headerBackTitle: "Atrás",
              headerTintColor: th.primary,
              headerStyle: { backgroundColor: th.surface },
              headerTitleStyle: { color: th.text },
            }}
          />
          <Stack.Screen
            name="category-settings"
            options={{
              headerShown: true,
              headerBackTitle: "Atrás",
              headerTintColor: th.primary,
              headerStyle: { backgroundColor: th.surface },
              headerTitleStyle: { color: th.text },
              title: "Categorías",
            }}
          />
          <Stack.Screen
            name="scan-book"
            options={{
              presentation: "modal",
              headerShown: true,
              headerBackTitle: "Atrás",
              headerTintColor: th.primary,
              headerStyle: { backgroundColor: th.surface },
              headerTitleStyle: { color: th.text },
              title: "Escanear libro",
            }}
          />
      </Stack>
      {showLoader ? (
        <View style={StyleSheet.absoluteFill}>
          <BrandLoading />
        </View>
      ) : null}
    </>
  );
}
