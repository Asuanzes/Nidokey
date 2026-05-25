export type CadastreInfo = {
  ref: string;
  address?: string;
  use?: string;          // "Residencial", "Comercial"...
  builtArea?: number;    // m²
  yearBuilt?: number;
  floor?: string;
  hasFloorplan: boolean;
  floorplanUrl?: string; // PDF/PNG si disponible
  raw?: unknown;
};
