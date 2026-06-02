/**
 * Resolutor de logo para registros de MERCADO (acciones, ETF, fondos).
 *
 * Estrategia (sin API key ni backend, todo desde la tarjeta):
 *  - ETF/fondos → logo del EMISOR (iShares, Vanguard, VanEck…). Son pocos y el
 *    título del registro los nombra ("iShares Core S&P 500 UCITS ETF"). Se sirve
 *    desde el CDN de logos de Twelve Data por dominio
 *    (`https://api.twelvedata.com/logo/{dominio}`), que devuelve logos de marca
 *    de calidad sin clave y de forma fiable.
 *  - Acciones (sin emisor reconocible en el título) → logo por ticker de
 *    Financial Modeling Prep, que cubre bien valores US.
 *  - Si la imagen falla al cargar (404, etc.), la tarjeta cae al icono del tipo.
 *
 * El logo NO se persiste: se deriva en el cliente, así los registros ya
 * guardados muestran logo sin reimportar.
 */

/** Logo de marca por dominio vía el CDN de Twelve Data (sin API key). */
function tdLogo(domain: string): string {
  return `https://api.twelvedata.com/logo/${domain}`;
}

/** Logo de acción por ticker (Financial Modeling Prep, sin clave). */
function fmpLogo(symbol: string): string {
  return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol.toUpperCase())}.png`;
}

/**
 * Emisores de ETF/fondos → dominio de marca (verificados contra el CDN de TD).
 * Xtrackers usa dws.com (DWS es su matriz). Ampliable según aparezcan emisores.
 */
const ISSUER_DOMAINS: Array<[RegExp, string]> = [
  [/\bishares\b/i, "ishares.com"],
  [/\bvanguard\b/i, "vanguard.com"],
  [/\bvan\s?eck\b/i, "vaneck.com"],
  [/\bxtrackers\b/i, "dws.com"],
  [/\bamundi\b/i, "amundi.com"],
  [/\binvesco\b/i, "invesco.com"],
  [/\b(spdr|state\s?street)\b/i, "ssga.com"],
  [/\bwisdomtree\b/i, "wisdomtree.com"],
  [/\bubs\b/i, "ubs.com"],
  [/\bdws\b/i, "dws.com"],
  [/\bfidelity\b/i, "fidelity.com"],
  [/\bhsbc\b/i, "hsbc.com"],
  [/\blyxor\b/i, "lyxor.com"],
  [/\bglobal\s?x\b/i, "globalxetfs.com"],
  [/\bfranklin\b/i, "franklintempleton.com"],
];

/** Dominio de marca del emisor si el título lo nombra (ETF/fondos). */
function issuerDomain(title: string): string | null {
  for (const [re, domain] of ISSUER_DOMAINS) {
    if (re.test(title)) return domain;
  }
  return null;
}

/**
 * URL del logo para un registro de mercado. Emisor de ETF si se reconoce; si no,
 * logo por ticker. Devuelve null si no hay nada por lo que buscar.
 */
export function marketLogoUrl(opts: { title?: string | null; symbol?: string | null }): string | null {
  const domain = issuerDomain(opts.title ?? "");
  if (domain) return tdLogo(domain);
  const symbol = opts.symbol?.trim();
  return symbol ? fmpLogo(symbol) : null;
}
