import "@/lib/logbox"; // PRIMERO: silencia warnings de NativeEventEmitter de modulos nativos
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
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
import { ThemeContext, T, TD, useTheme } from "@/lib/theme";
import { isPortalUrl, extractSharedUrl } from "@/lib/portal-url";
import { PendingImportProvider, usePendingImport } from "@/lib/pending-import";
import { BrandLoading } from "@/components/BrandLoading";
import { BootProvider, useBoot } from "@/lib/boot-context";

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
  const [dark, setDark] = useState(() => Appearance.getColorScheme() === "dark");

  useEffect(() => {
    SecureStore.getItemAsync("nidokey.theme")
      .then((v) => {
        // La preferencia guardada manda; el seed del SO (arriba) solo gobierna el
        // primer frame y el caso "sin preferencia guardada".
        if (v === "dark") setDark(true);
        else if (v === "light") setDark(false);
      })
      .catch(() => {});
  }, []);

  // Red de seguridad: si la sesión tardara demasiado, no dejar el splash colgado.
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), 3000);
    return () => clearTimeout(t);
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    SecureStore.setItemAsync("nidokey.theme", next ? "dark" : "light").catch(() => {});
  };

  const th = dark ? TD : T;

  return (
    <ShareIntentProvider options={{ resetOnBackground: true }}>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: th.bg }}>
      <AuthProvider>
        <ThemeContext.Provider value={{ dark, th, toggleTheme }}>
          <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <PendingImportProvider>
              <BootProvider>
                <AuthGate />
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
  const { setUrl } = usePendingImport();
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
    const onLogin = segments[0] === "login";
    if (state.kind === "unauthed" && !onLogin) {
      router.replace("/login");
    } else if (state.kind === "authed" && onLogin) {
      router.replace("/(tabs)");
    }
  }, [authResolved, state, segments, router]);

  // Ocultar el splash nativo en cuanto monta el JS, para que SÍ se vea la
  // pantalla de carga (BrandLoading) mientras se resuelve la sesión, en vez de
  // saltar del splash directo a la app. Mismo fondo que el splash → sin saltos.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Deep links (expo-linking): estés en la pantalla que estés, si llega una URL de
  // portal por enlace la guardamos y navegamos a Importar (que la auto-importa).
  useEffect(() => {
    if (state.kind !== "authed") return;
    let alive = true;
    const go = (u: string | null) => {
      if (alive && u && isPortalUrl(u)) {
        setUrl(u);
        router.navigate("/importar");
      }
    };
    Linking.getInitialURL().then((u) => go(u));
    const linkSub = Linking.addEventListener("url", ({ url }) => go(url));
    return () => {
      alive = false;
      linkSub.remove();
    };
  }, [state.kind, router, setUrl]);

  // Share-to-app (expo-share-intent): cuando llega un share con una URL de portal
  // (hoja de Compartir de iOS / Android), navegamos a Importar y la auto-importamos.
  // Centralizado aquí (siempre montado) para no perder el share si Importar no está
  // montada. La Share Extension de iOS la genera el config plugin en el prebuild.
  useEffect(() => {
    if (state.kind !== "authed" || !hasShareIntent) return;
    const url = extractSharedUrl(shareIntent);
    if (url) {
      setUrl(url);
      router.navigate("/importar");
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, state.kind, router, setUrl, resetShareIntent]);

  return (
    <>
      {authResolved ? (
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
        </Stack>
      ) : null}
      {showLoader ? (
        <View style={StyleSheet.absoluteFill}>
          <BrandLoading />
        </View>
      ) : null}
    </>
  );
}
