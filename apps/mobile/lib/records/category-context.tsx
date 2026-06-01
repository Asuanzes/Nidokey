import { createContext, useContext, useState, type ReactNode } from "react";
import type { RecordType } from "@nidokey/shared";

/**
 * Categoría de registro activa, COMPARTIDA entre la lista (index) y la pantalla
 * Importar. Resuelve dos cosas:
 *  - Abrir Importar desde una categoría (p. ej. Criptos) la abre directamente en
 *    ella, no en Inmuebles por defecto.
 *  - "Ver {categoría}" tras añadir vuelve a la lista ya filtrada en esa categoría.
 *
 * Vive en el layout de tabs → persiste mientras navegas entre pestañas.
 */
type Ctx = { category: RecordType; setCategory: (t: RecordType) => void };

const RecordCategoryContext = createContext<Ctx | null>(null);

export function RecordCategoryProvider({ children }: { children: ReactNode }) {
  const [category, setCategory] = useState<RecordType>("property");
  return (
    <RecordCategoryContext.Provider value={{ category, setCategory }}>
      {children}
    </RecordCategoryContext.Provider>
  );
}

export function useRecordCategory(): Ctx {
  const ctx = useContext(RecordCategoryContext);
  if (!ctx) throw new Error("useRecordCategory fuera de RecordCategoryProvider");
  return ctx;
}
