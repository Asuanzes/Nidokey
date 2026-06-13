/**
 * Feature flags del cliente móvil. Constantes en compile-time (no en
 * SecureStore) para que el bundler pueda tree-shakear las ramas apagadas y
 * para mantener trazable la decisión por commit.
 *
 * `adsEnabled` está apagado en todos los entornos por ahora: el rediseño
 * "2100" reserva huecos visuales para ads, pero el cableado real llega más
 * tarde. Activar a `true` cuando exista proveedor + revisión de privacidad.
 */
export const adsEnabled = false;
