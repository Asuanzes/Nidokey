import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * URL de inmueble pendiente de importar, compartida entre el layout raíz (que
 * captura el share/deep-link estés en la pantalla que estés) y la pantalla
 * Importar (que la consume: auto-arranca la importación y la limpia).
 *
 * Patrón "consumir": tras importar, la pantalla hace setUrl(null); así un
 * segundo share de la MISMA URL vuelve a dispararse (null → url = cambio).
 */
type Ctx = { url: string | null; setUrl: (u: string | null) => void };

const PendingImportContext = createContext<Ctx | null>(null);

export function PendingImportProvider({ children }: { children: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  return (
    <PendingImportContext.Provider value={{ url, setUrl }}>
      {children}
    </PendingImportContext.Provider>
  );
}

export function usePendingImport(): Ctx {
  const ctx = useContext(PendingImportContext);
  if (!ctx) throw new Error("usePendingImport fuera de PendingImportProvider");
  return ctx;
}
