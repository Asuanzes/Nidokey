import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // CRÍTICO: hay un package-lock.json suelto en C:\Users\suanz que confunde
  // a Next.js sobre cuál es el root del workspace. Eso rompe la resolución de
  // módulos nativos (Playwright, Sharp). Fijamos el root explícitamente al
  // directorio del proyecto.
  outputFileTracingRoot: path.resolve(__dirname),

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.idealista.com" },
      { protocol: "https", hostname: "**.fotocasa.es" },
      { protocol: "https", hostname: "**.pisos.com" },
      { protocol: "https", hostname: "**.milanuncios.com" },
    ],
  },
  // Permite que Next compile el paquete del monorepo (TS sin build paso).
  transpilePackages: ["@nidokey/shared"],
  // sharp tiene binarios nativos. Lo dejamos external por seguridad.
  // (Playwright ya NO se importa desde Next; vive en el sidecar.)
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
