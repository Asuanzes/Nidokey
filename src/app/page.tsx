import { ComingSoon } from "@/components/landing/ComingSoon";
// La landing completa está guardada en `@/components/landing/Landing` y se
// restaura cambiando la línea de abajo por `return <Landing />;` cuando las apps
// estén publicadas en tiendas.
// import { Landing } from "@/components/landing/Landing";

/**
 * Raíz pública. Mientras las apps móviles no estén en tiendas, `/` muestra solo
 * un mensaje "Próximamente". La landing de presentación/descarga queda intacta
 * en el repo (ver import comentado arriba) lista para volver a publicarse.
 * `/` es público (ver middleware) y se renderiza sin el chrome de la app.
 */
export default function Home() {
  return <ComingSoon />;
}
