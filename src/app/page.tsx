import { Landing } from "@/components/landing/Landing";

/**
 * Raíz pública: landing de presentación + descarga (web = escaparate de la app
 * móvil). La app auth-gated vive en /dashboard, /properties, etc.; el
 * propietario entra por /login. `/` es público (ver middleware) y se renderiza
 * sin el chrome de la app (AppShell hace bypass para "/").
 */
export default function Home() {
  return <Landing />;
}
