/**
 * Validación de ISBN con CHECKSUM (ISO 2108) — compartida entre el backend
 * (resolución de libros) y el móvil (extracción de URLs/texto compartido).
 *
 * Por qué: los extractores cazan "números con pinta de ISBN" en URLs y HTML
 * (p. ej. el ASIN de Amazon en /dp/<asin>, que en libros antiguos ES un
 * ISBN-10). Sin checksum, cualquier número de 10/13 dígitos colaba y producía
 * lookups absurdos; con checksum, un ASIN numérico que no sea ISBN se descarta
 * y el flujo cae a la resolución por título (más lenta pero correcta).
 *
 * Entrada: cadena ya limpia (solo dígitos y X mayúscula). Los normalizadores
 * de cada lado se encargan de quitar guiones/espacios antes de llamar aquí.
 */

/** ¿Checksum ISBN-10 válido? (10 caracteres: 9 dígitos + dígito o X). */
export function isValidIsbn10(s: string): boolean {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const d = s[i] === "X" ? 10 : s.charCodeAt(i) - 48;
    sum += d * (10 - i);
  }
  return sum % 11 === 0;
}

/** ¿Checksum ISBN-13 válido? (EAN-13 con prefijo Bookland 978/979). */
export function isValidIsbn13(s: string): boolean {
  if (!/^97[89]\d{10}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += (s.charCodeAt(i) - 48) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
}

/** ¿ISBN válido (10 o 13) con checksum correcto? */
export function isValidIsbn(s: string): boolean {
  return isValidIsbn13(s) || isValidIsbn10(s);
}

/** Convierte un ISBN-10 válido a su ISBN-13 equivalente (prefijo 978). No
 *  valida la entrada: pásala por isValidIsbn10 antes. */
export function isbn10To13(isbn10: string): string {
  const core = "978" + isbn10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += (core.charCodeAt(i) - 48) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return core + check;
}
