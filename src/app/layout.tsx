import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
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
            El dominio rota (emrldtp/emrld.ltd) a propósito. `beforeInteractive`
            emite el snippet en el HTML del servidor para que su verificación lo
            detecte (estática o en runtime). Replica EXACTO el snippet que da
            Travelpayouts. Solo afecta a la WEB. OJO: requiere DEPLOY para que se
            verifique (en local no lo ve). */}
        <Script id="travelpayouts-emerald" strategy="beforeInteractive">
          {`(function () {
  var script = document.createElement("script");
  script.async = 1;
  script.src = 'https://emrldtp.com/NTM2ODY5.js?t=536869';
  document.head.appendChild(script);
})();`}
        </Script>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
