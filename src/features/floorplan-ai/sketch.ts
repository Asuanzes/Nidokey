/**
 * Genera un boceto 2D aproximado de la distribución de un inmueble
 * a partir de sus fotos + características (m², habitaciones, baños, etc.).
 *
 * NO produce un plano fiable: es un esquema de cajas/etiquetas para visualización.
 * El resultado se guarda como Media(kind=FLOORPLAN, source=AI_SKETCH).
 *
 * Estrategia:
 * 1. Pasar las fotos + datos a un modelo multimodal (Claude / GPT-4 Vision)
 *    pidiendo un layout en JSON: rectángulos {label, w, h, x, y}.
 * 2. Renderizar el JSON a SVG (o canvas) en una API route.
 * 3. Subir el SVG/PNG a almacenamiento y guardar la URL en Media.
 *
 * TODO: implementar cuando integremos Anthropic SDK.
 */
export type SketchRoom = {
  label: string;        // "salón", "dormitorio 1", "cocina"...
  widthM: number;       // metros
  heightM: number;
  x: number;            // posición relativa
  y: number;
  hasWindow?: boolean;
};

export type SketchPlan = {
  totalAreaM2: number;
  rooms: SketchRoom[];
  notes?: string;
};

export async function generateSketchFromPhotos(_input: {
  photoUrls: string[];
  builtArea?: number | null;
  rooms?: number | null;
  bathrooms?: number | null;
  description?: string | null;
}): Promise<SketchPlan> {
  throw new Error("floorplan-ai.generateSketchFromPhotos: pendiente de implementar");
}
