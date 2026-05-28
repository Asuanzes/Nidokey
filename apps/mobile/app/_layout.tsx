import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";
import * as SecureStore from "expo-secure-store";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeContext, T, TD } from "@/lib/theme";

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
    <AuthProvider>
      <ThemeContext.Provider value={{ dark, th, toggleTheme }}>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <AuthGate />
          <StatusBar style="auto" />
        </ThemeProvider>
      </ThemeContext.Provider>
    </AuthProvider>
  );
}

function AuthGate() {
  const { state } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (state.kind === "loading") return;
    const onLogin = segments[0] === "login";
    if (state.kind === "unauthed" && !onLogin) {
      router.replace("/login");
    } else if (state.kind === "authed" && onLogin) {
      router.replace("/(tabs)");
    }
  }, [state, segments, router]);

  if (state.kind === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAF7" }}>
        <ActivityIndicator size="large" color="#3A5F8A" />
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
          headerTintColor: "#3A5F8A",
          headerStyle: { backgroundColor: "#fff" },
          title: "",
        }}
      />
      <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
    </Stack>
  );
}
