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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
