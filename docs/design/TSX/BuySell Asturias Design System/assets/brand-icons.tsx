import * as React from "react";

type Props = { size?: number; className?: string; strokeWidth?: number };

/**
 * A. Hórreo — granero típico asturiano sobre pegollos.
 * Distintivo regional, geométrico, lectura clara incluso a 16px.
 */
export function IconHorreo({ size = 24, className, strokeWidth = 1.6 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Tejado */}
      <path d="M3.5 9.5 L12 3 L20.5 9.5" />
      {/* Cuerpo */}
      <path d="M5 9.5 V15 H19 V9.5" />
      {/* Capstone */}
      <path d="M3 16.5 H21" />
      {/* Pegollos */}
      <path d="M6 17 V21" />
      <path d="M10 17 V21" />
      <path d="M14 17 V21" />
      <path d="M18 17 V21" />
    </svg>
  );
}

/**
 * B. Casa con dos vanos — silueta de inmueble residencial,
 * universal, sobria. La más "neutral" del conjunto.
 */
export function IconHouseMark({ size = 24, className, strokeWidth = 1.6 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 11 L12 3.5 L21 11" />
      <path d="M5 10.5 V20 H19 V10.5" />
      <path d="M10.5 20 V14 H13.5 V20" />
      <path d="M7 14 H8.5" />
    </svg>
  );
}

/**
 * C. Picos — tres cumbres (alusión a Picos de Europa) con un
 * pequeño tejado destacado en el centro. Identidad de paisaje + vivienda.
 */
export function IconPicos({ size = 24, className, strokeWidth = 1.6 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Cordillera */}
      <path d="M2 19 L7 11 L10.5 15 L14 8 L18 13 L22 19" />
      {/* Suelo */}
      <path d="M2 19 H22" />
      {/* Pequeño tejado en primer plano */}
      <path d="M9 19 V15.5 L11.5 13.5 L14 15.5 V19" fill="currentColor" fillOpacity="0.12" />
    </svg>
  );
}

/**
 * D. Chevron / monograma — tejado abstracto que insinúa una "B".
 * Lo más minimalista y "logo SaaS"; menos local pero muy escalable.
 */
export function IconChevron({ size = 24, className, strokeWidth = 1.8 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 13 L12 5 L20 13" />
      <path d="M7 11.5 V20 H17 V11.5" />
      <path d="M10 20 V15 H14" />
    </svg>
  );
}

/**
 * E. Etiqueta de precio — clásico inmobiliario / e-commerce.
 * Sobrio, reconocible, fácil de leer a cualquier tamaño.
 */
export function IconTag({ size = 24, className, strokeWidth = 1.6 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12.5 L11.5 4 H20 V12.5 L11.5 21 Z" />
      <circle cx="15.5" cy="8.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

/**
 * F. Llave medieval — anillo con finial superior, núcleo decorativo y
 * paletón escalonado con muesca. Sugerencia a llave de hierro forjado
 * sin caer en lo decorativo recargado.
 */
export function IconKey({ size = 24, className, strokeWidth = 1.5 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* Anillo (bow) hueco */}
      <circle cx="6.5" cy="12" r="3.3" />

      {/* Remache de cobre sobre el anillo */}
      <circle cx="6.5" cy="8" r="0.85" fill="var(--brand-accent)" stroke="none" />

      {/* Espiga (shank) */}
      <path d="M9.8 12 H17" />

      {/* Paletón: interior en cobre bruñido, contorno en acero */}
      <path d="M17 12 H21 V17 H20 V15.5 H18.5 V17 H17 Z" fill="var(--brand-accent)" />
    </svg>
  );
}

/**
 * G. Pin + tejado — ubicación con un pequeño tejado dentro.
 * Une "inmueble" + "mapa" en un solo gesto.
 */
export function IconPin({ size = 24, className, strokeWidth = 1.6 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 21.5 C7 16 4.5 12.5 4.5 9 a7.5 7.5 0 0 1 15 0 C19.5 12.5 17 16 12 21.5 Z" />
      <path d="M8.5 10 L12 7 L15.5 10 V13 H8.5 Z" />
    </svg>
  );
}

/**
 * H. Portfolio — dos casas solapadas, sugiere "cartera de inmuebles".
 * Buen ajuste para una app de gestión multi-propiedad.
 */
export function IconPortfolio({ size = 24, className, strokeWidth = 1.6 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* casa de atrás (más pequeña, esquina superior derecha) */}
      <path d="M11 9 L16 4.5 L21 9 V14 H17" />
      <path d="M16 4.5 V8" opacity="0" />
      {/* casa de delante */}
      <path d="M3 13 L10 7 L17 13 V20 H3 Z" />
      <path d="M8 20 V15 H12 V20" />
    </svg>
  );
}

/**
 * I. Compraventa — dos chevrons opuestos formando un rombo.
 * Abstrae el flujo "buy / sell" sin recurrir a una casa.
 */
export function IconExchange({ size = 24, className, strokeWidth = 1.8 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 10 L12 3 L20 10" />
      <path d="M4 14 L12 21 L20 14" />
    </svg>
  );
}

/**
 * J. Foco — tres rombos concéntricos con un punto central.
 * Identidad: precisión, observación, "encontrar lo correcto".
 * Lectura abstracta: target / diafragma / huella.
 */
export function IconFoco({ size = 24, className, strokeWidth = 1.6 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2 L22 12 L12 22 L2 12 Z" />
      <path d="M12 7 L17 12 L12 17 L7 12 Z" />
      <path d="M12 11 L13 12 L12 13 L11 12 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * K. Ascenso — tres peldaños en diagonal.
 * Identidad: progresión, escalera, "subir de nivel".
 * Pura geometría, sin nada figurativo.
 */
export function IconAscenso({ size = 24, className, strokeWidth = 1.8 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 20 H8 V15 H13 V10 H18 V5 H21" />
      <path d="M3 20 H21" opacity="0.35" />
    </svg>
  );
}

/**
 * L. Pliegue — rombo con un pliegue vertical, mitad sombreada.
 * Identidad: facetas, perspectivas, "dos caras de algo".
 * Origami minimalista; muy memorable a tamaño pequeño.
 */
export function IconPliegue({ size = 24, className, strokeWidth = 1.6 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12 L12 3 L12 21 Z" fill="currentColor" fillOpacity="0.14" stroke="none" />
      <path d="M12 3 L21 12 L12 21 L3 12 Z" />
      <path d="M12 3 V21" />
    </svg>
  );
}

/**
 * M. Pórtico — arco sobre dos columnas.
 * Identidad: umbral, entrada, arquitectura.
 * Sugerencia sutil a "edificación" sin dibujar una casa.
 */
export function IconPortico({ size = 24, className, strokeWidth = 1.7 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 20 H21" />
      <path d="M6 20 V12 a6 6 0 0 1 12 0 V20" />
      <path d="M6 13 H18" opacity="0.45" />
    </svg>
  );
}

/**
 * N. Cruce — cuadrado y rombo (mismo cuadrado a 45º) superpuestos.
 * Identidad: encuentro, dos partes que se cruzan, intercambio.
 * Forma de "estrella ortogonal" muy reconocible y propia.
 */
export function IconCruce({ size = 24, className, strokeWidth = 1.6 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <g transform="rotate(45 12 12)">
        <rect x="6" y="6" width="12" height="12" rx="2" />
      </g>
    </svg>
  );
}

export const BRAND_ICONS = {
  horreo:    { component: IconHorreo,    label: "Hórreo",       note: "Asturiano, distintivo regional" },
  house:     { component: IconHouseMark, label: "Casa",         note: "Universal, neutral inmobiliario" },
  picos:     { component: IconPicos,     label: "Picos",        note: "Paisaje + vivienda" },
  chevron:   { component: IconChevron,   label: "Chevron",      note: "Minimalista SaaS" },
  tag:       { component: IconTag,       label: "Etiqueta",     note: "Clásico inmobiliario / e-commerce" },
  key:       { component: IconKey,       label: "Llave medieval", note: "Forja: finial, anillo decorado, paletón con muesca" },
  pin:       { component: IconPin,       label: "Ubicación",    note: "Pin con tejado dentro" },
  portfolio: { component: IconPortfolio, label: "Cartera",      note: "Dos casas: gestión multi-inmueble" },
  exchange:  { component: IconExchange, label: "Compraventa",   note: "Dos chevrons: flujo buy/sell" },
  foco:      { component: IconFoco,      label: "Foco",          note: "Rombos concéntricos: precisión, observación" },
  ascenso:   { component: IconAscenso,   label: "Ascenso",       note: "Escalera diagonal: progresión, subir de nivel" },
  pliegue:   { component: IconPliegue,   label: "Pliegue",       note: "Origami: dos caras, perspectivas" },
  portico:   { component: IconPortico,   label: "Pórtico",       note: "Arco arquitectónico: umbral, entrada" },
  cruce:     { component: IconCruce,     label: "Cruce",         note: "Cuadrado + rombo: encuentro, intercambio" },
} as const;

export type BrandIconKey = keyof typeof BRAND_ICONS;
