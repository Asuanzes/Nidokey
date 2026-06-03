import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/**
 * Estado de arranque compartido: permite que el loader del arranque (las bolitas
 * en `_layout`) se mantenga hasta que la PRIMERA pantalla (Inmuebles) haya
 * cargado sus registros. Así tapamos también la precarga de la lista → una sola
 * carga en vez de dos (bolitas + spinner propio de la lista).
 */
type BootCtx = {
  firstScreenReady: boolean;
  markFirstScreenReady: () => void;
};

const BootContext = createContext<BootCtx>({
  firstScreenReady: false,
  markFirstScreenReady: () => {},
});

export function BootProvider({ children }: { children: ReactNode }) {
  const [firstScreenReady, setReady] = useState(false);
  const markFirstScreenReady = useCallback(() => setReady(true), []);
  return (
    <BootContext.Provider value={{ firstScreenReady, markFirstScreenReady }}>
      {children}
    </BootContext.Provider>
  );
}

export const useBoot = () => useContext(BootContext);
