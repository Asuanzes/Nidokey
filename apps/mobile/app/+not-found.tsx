import { Redirect } from "expo-router";

/**
 * Ruta no encontrada. El caso real aquí es una URL EXTERNA compartida (portal de
 * inmuebles o tienda de libros) que expo-router intenta auto-rutear como path al
 * recibir el share/deep-link → antes mostraba la pantalla "Unmatched Route".
 *
 * La redirigimos a Importar, que es justo donde el import pendiente (fijado por el
 * handler de share/deep-link en `_layout.tsx`) se procesa. Ambos destinos coinciden
 * (`/importar`), así que NO altera el flujo de importación: solo evita la pantalla fea.
 */
export default function NotFound() {
  return <Redirect href="/importar" />;
}
