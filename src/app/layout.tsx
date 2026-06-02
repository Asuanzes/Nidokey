import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const DESCRIPTION =
  "Guarda y sigue inmuebles, criptos, mercados y empleos en un solo panel: " +
  "histórico de precios, deduplicación y datos oficiales del Catastro. App para Android e iOS.";

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
