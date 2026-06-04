import "@/lib/logbox"; // PRIMERO: silencia el warning de share-menu antes de importarlo
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
import ShareMenu from "react-native-share-menu";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeContext, T, TD, useTheme } from "@/lib/theme";
import { isPortalUrl, extractSharedText } from "@/lib/portal-url";
import { isBookShareText } from "@/lib/book-url";
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

  // Share intent (react-native-share-menu) + deep links (expo-linking): estés en
  // la pantalla que estés, si llega una URL de portal la guardamos y navegamos a
  // Importar, que la auto-importa mostrando la ventana de carga. Centralizado
  // aquí (siempre montado) porque antes solo lo escuchaba Importar, que no está
  // montada al compartir → el share se perdía y quedabas en la pantalla principal.
  useEffect(() => {
    if (state.kind !== "authed") return;
    // No navegar hasta que el navegador raíz esté montado; si no, expo-router lanza
    // "Attempted to navigate before mounting the Root Layout" (al abrir desde un
    // share en arranque en frío). El share inicial no se pierde: getInitialShare
    // lo conserva y se lee en cuanto el navegador está listo.
    if (!rootNavState?.key) return;
    let alive = true;
    // Inmueble: una URL de PORTAL (compartida o abierta como app-link) → flujo property.
    const goProperty = (u: string | null) => {
      if (alive && u && isPortalUrl(u)) {
        setUrl(u);
        router.navigate("/importar");
      }
    };
    // Compartir TEXTO: Amazon/tiendas mandan "Título … <enlace>" (a veces enlace
    // corto sin ISBN). Si el texto trae una URL de portal → inmueble; si parece un
    // libro (ISBN o host de libros) → libro, que se resuelve por ISBN o por título.
    const goShared = (text: string | null) => {
      if (!alive || !text) return;
      const url = text.match(/https?:\/\/[^\s]+/)?.[0] ?? null;
      if (url && isPortalUrl(url)) {
        setUrl(url);
        router.navigate("/importar");
        return;
      }
      if (isBookShareText(text)) {
        setBookShare(text);
        router.navigate("/importar");
      }
    };
    Linking.getInitialURL().then((u) => goProperty(u ?? null));
    const linkSub = Linking.addEventListener("url", ({ url }) => goProperty(url));
    let shareSub: { remove?: () => void } | undefined;
    try {
      ShareMenu.getInitialShare((data) => goShared(extractSharedText(data)));
      shareSub = ShareMenu.addNewShareListener((data) => goShared(extractSharedText(data)));
    } catch {
      // react-native-share-menu no disponible (p. ej. web) → ignorar.
    }
    return () => {
      alive = false;
      linkSub.remove();
      shareSub?.remove?.();
    };
  }, [state.kind, router, setUrl, setBookShare]);

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
