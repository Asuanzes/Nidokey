import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import ShareMenu from "react-native-share-menu";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeContext, T, TD, useTheme } from "@/lib/theme";
import { isPortalUrl, extractSharedUrl } from "@/lib/portal-url";
import { PendingImportProvider, usePendingImport } from "@/lib/pending-import";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync("nidokey.theme")
      .then((v) => { if (v === "dark") setDark(true); })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    SecureStore.setItemAsync("nidokey.theme", next ? "dark" : "light").catch(() => {});
  };

  const th = dark ? TD : T;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ThemeContext.Provider value={{ dark, th, toggleTheme }}>
          <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
            <PendingImportProvider>
              <AuthGate />
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
  const { setUrl } = usePendingImport();

  useEffect(() => {
    if (state.kind === "loading") return;
    const onLogin = segments[0] === "login";
    if (state.kind === "unauthed" && !onLogin) {
      router.replace("/login");
    } else if (state.kind === "authed" && onLogin) {
      router.replace("/(tabs)");
    }
  }, [state, segments, router]);

  // Share intent (react-native-share-menu) + deep links (expo-linking): estés en
  // la pantalla que estés, si llega una URL de portal la guardamos y navegamos a
  // Importar, que la auto-importa mostrando la ventana de carga. Centralizado
  // aquí (siempre montado) porque antes solo lo escuchaba Importar, que no está
  // montada al compartir → el share se perdía y quedabas en la pantalla principal.
  useEffect(() => {
    if (state.kind !== "authed") return;
    let alive = true;
    const go = (u: string | null) => {
      if (alive && u) {
        setUrl(u);
        router.navigate("/importar");
      }
    };
    Linking.getInitialURL().then((u) => go(u && isPortalUrl(u) ? u : null));
    const linkSub = Linking.addEventListener("url", ({ url }) =>
      go(isPortalUrl(url) ? url : null)
    );
    let shareSub: { remove?: () => void } | undefined;
    try {
      ShareMenu.getInitialShare((data) => go(extractSharedUrl(data)));
      shareSub = ShareMenu.addNewShareListener((data) => go(extractSharedUrl(data)));
    } catch {
      // react-native-share-menu no disponible (p. ej. web) → ignorar.
    }
    return () => {
      alive = false;
      linkSub.remove();
      shareSub?.remove?.();
    };
  }, [state.kind, router, setUrl]);

  if (state.kind === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAF7" }}>
        <ActivityIndicator size="large" color="#B87333" />
      </View>
    );
  }

  return (
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
  );
}
