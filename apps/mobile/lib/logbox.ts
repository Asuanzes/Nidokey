import { LogBox } from "react-native";

/**
 * react-native-share-menu (módulo legacy) crea un `NativeEventEmitter` en el
 * nivel superior del módulo, sin los métodos `addListener`/`removeListeners`
 * que la New Architecture espera → dispara un warning benigno al arrancar
 * ("Open debugger to view warnings"). El share-intent funciona igual.
 *
 * Silenciamos SOLO ese aviso. LogBox es dev-only (en producción no existe, así
 * que la ventanita tampoco aparece allí). Este módulo debe importarse el PRIMERO
 * en `app/_layout.tsx` para registrar el filtro ANTES de que share-menu cree el
 * emitter al ser importado.
 */
LogBox.ignoreLogs(["new NativeEventEmitter"]);
