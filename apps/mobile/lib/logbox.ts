import { LogBox } from "react-native";

/**
 * Algunos módulos nativos crean un `NativeEventEmitter` en el nivel superior del
 * módulo sin los métodos `addListener`/`removeListeners` que la New Architecture
 * espera → disparan un warning benigno al arrancar ("Open debugger to view
 * warnings"). Silenciamos SOLO ese aviso.
 *
 * LogBox es dev-only (en producción no existe, así que la ventanita tampoco
 * aparece allí). Se importa el PRIMERO en `app/_layout.tsx`.
 */
LogBox.ignoreLogs(["new NativeEventEmitter"]);
