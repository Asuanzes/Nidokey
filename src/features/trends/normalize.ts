function splitCamelCase(value: string): string {
  return value
    .replace(/([a-záéíóúüñ])([A-ZÁÉÍÓÚÜÑ])/g, "$1 $2")
    .replace(/([A-ZÁÉÍÓÚÜÑ]+)([A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ])/g, "$1 $2");
}

export function trendToQuery(name: string): string {
  return name
    .replace(/^#+/, "")
    .split(/\s+/)
    .map((part) => splitCamelCase(part.replace(/^#+/, "")))
    .join(" ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

