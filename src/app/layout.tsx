import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const DESCRIPTION =
  "Sigue inmuebles, inversiones, empleos y entrenamientos en un panel, con alertas " +
  "de bajadas de precio y de cambios en las publicaciones, gestión de hipoteca y " +
  "chat cifrado de extremo a extremo. Sin contraseñas. Android e iOS.";

export const metadata: Metadata = {
  metadataBase: new URL("https://nidokey.es"),
  title: {
    default: "Nidokey — Inmuebles, mercados y empleos en un panel",
    template: "%s · Nidokey",
  },
  description: DESCRIPTION,
  applicationName: "Nidokey",
  openGraph: {
    type: "website",
    siteName: "Nidokey",
    locale: "es_ES",
    title: "Nidokey — Inmuebles, mercados y empleos en un panel",
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        {/* Script de Travelpayouts (Drive/Emerald): verifica la propiedad del
            sitio + conversión de enlaces de afiliado + analítica. Necesario para
            aprobar nidokey.es como plataforma y desbloquear programas (Booking).
            El dominio rota (emrldtp/emrld.ltd) a propósito.
            Etiqueta <script async src> CRUDA: React 19 la sube al <head> y la emite
            LITERAL en el HTML del servidor (checker estático) y la ejecuta (checker
            en runtime). Es lo que `next/script` NO hacía (la ocultaba en su loader).
            Solo afecta a la WEB. OJO: requiere DEPLOY (en local no lo ve). */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script async src="https://emrldtp.com/NTM2ODY5.js?t=536869" />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
