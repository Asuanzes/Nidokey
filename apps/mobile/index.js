// Entry personalizado de la app.
//
// Por defecto Expo usa `expo-router/entry`, que hace `renderRootComponent(App)`
// donde `App` es la raíz de expo-router (monta el NavigationContainer).
//
// PROBLEMA: cuando una app NATIVA comparte con FLAG_ACTIVITY_NEW_TASK (la app de
// Amazon, p. ej.), Android monta una 2ª instancia del root React en el MISMO
// proceso JS. Eso crea un 2º NavigationContainer de expo-router → "configured
// linking in multiple places" + "Attempted to navigate before mounting" → la
// navegación de la app real se corrompe (crash efectivo). No es evitable a nivel
// nativo (los flags del que comparte mandan sobre launchMode=singleTask).
//
// SOLUCIÓN: envolvemos `App` aquí, POR ENCIMA de expo-router. Solo la PRIMERA
// surface monta la app completa; cualquier surface posterior renderiza un aviso
// plano (sin expo-router → sin 2º NavigationContainer → sin crash). La detección
// usa un contador de surfaces a nivel de módulo (ver ./lib/primary-surface).
import "@expo/metro-runtime";

import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";
import React, { useEffect, useRef } from "react";

import { DuplicateRootNotice } from "./components/DuplicateRootNotice";
import { acquireSurface, isPrimaryFree } from "./lib/primary-surface";

function Root(props) {
  // Latcheamos la decisión UNA vez (lectura pura). La mutación del contador va en
  // el effect/cleanup — nunca en render — para no corromperlo con renders
  // descartados (React 19 / React Compiler / render concurrente).
  const amPrimaryRef = useRef(null);
  if (amPrimaryRef.current === null) {
    amPrimaryRef.current = isPrimaryFree();
    // Una línea por surface montada: confirma qué surface es la app real y cuál
    // es una duplicada (p. ej. share desde una app nativa). Diagnóstico barato.
    console.log("[nidokey-entry] nueva surface, amPrimary =", amPrimaryRef.current);
  }
  const amPrimary = amPrimaryRef.current;

  useEffect(() => {
    if (!amPrimary) return;
    return acquireSurface();
  }, [amPrimary]);

  return amPrimary
    ? React.createElement(App, props)
    : React.createElement(DuplicateRootNotice);
}

renderRootComponent(Root);
