/**
 * Scripts de extracción JS que se inyectan en el WebView para cada portal.
 * Cada script extrae datos del anuncio y los envía via window.ReactNativeWebView.postMessage.
 *
 * Tipos de mensaje:
 *   { type: 'extracted', data: ImportPayload }
 *   { type: 'challenge' }               — captcha/DataDome detectado
 *   { type: 'error', reason: string }
 *
 * Estrategia de robustez (todos los portales):
 *  - IMÁGENES: nunca se prioriza og:image (suele ser una tarjeta con marca de
 *    agua). Se filtran por tamaño real (naturalWidth/Height), ratio y patrón de
 *    URL (logo/icon/watermark/mapa…). Las imágenes estructuradas del JSON del
 *    portal son la fuente primaria; el barrido del DOM es el fallback.
 *  - CAMPOS: además de los que cada portal expone en su JSON, SIEMPRE se manda
 *    `features` (texto de las listas de características). El servidor lo
 *    re-parsea para rellenar m²/hab./baños/año/planta/parcela/eficiencia y
 *    amenidades aunque el JSON del portal no los traiga.
 */

function detectPortal(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("idealista.")) return "IDEALISTA";
  if (u.includes("fotocasa.")) return "FOTOCASA";
  if (u.includes("pisos.com")) return "PISOS_COM";
  if (u.includes("milanuncios.")) return "MILANUNCIOS";
  if (u.includes("habitaclia.")) return "HABITACLIA";
  if (u.includes("yaencontre.")) return "YAENCONTRE";
  if (u.includes("thinkspain.")) return "THINKSPAIN";
  if (u.includes("indomio.")) return "INDOMIO";
  return "OTHER";
}

const SHARED_HELPERS = `
var __post = function(obj) { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); };

var __jsonLd = function(type) {
  var scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (var i = 0; i < scripts.length; i++) {
    try {
      var d = JSON.parse(scripts[i].textContent);
      var items = Array.isArray(d) ? d : [d];
      for (var j = 0; j < items.length; j++) {
        if (items[j]['@type'] === type) return items[j];
        if (items[j]['@graph']) {
          for (var k = 0; k < items[j]['@graph'].length; k++) {
            if (items[j]['@graph'][k]['@type'] === type) return items[j]['@graph'][k];
          }
        }
      }
    } catch(e) {}
  }
  return null;
};

var __price = function(v) {
  if (v == null) return null;
  var n = parseFloat(String(v).replace(/[^\\d.]/g, ''));
  return isNaN(n) ? null : Math.round(n);
};

// Resuelve a URL absoluta. keepQuery=true conserva la query (URLs firmadas de CDN).
var __abs = function(src, keepQuery) {
  if (!src) return '';
  try { var u = new URL(src, location.href).href; return keepQuery ? u : u.split('?')[0]; }
  catch(e) { return keepQuery ? String(src) : String(src).split('?')[0]; }
};

// Patrón de imágenes basura: logos, iconos, marcas de agua, banderas, mapas, sellos…
var __junk = /(logo|sprite|icono?s?|favicon|placeholder|avatar|watermark|marca|blank|pixel|spacer|loading|banner|badge|flag|bandera|sello|googleapis|gstatic|maps\\.|staticmap|facebook|whatsapp|instagram|\\/static\\/|\\/assets\\/|\\/icons?\\/)/i;

var __goodImg = function(path) {
  if (!path || !/^https?:/i.test(path)) return false;
  if (/\\.(svg|gif)(\\?|$)/i.test(path)) return false;
  if (__junk.test(path)) return false;
  return true;
};

// Imágenes REALES del inmueble desde el DOM, filtrando por tamaño, ratio y
// patrón de URL. NO prioriza og:image (solo último recurso).
var __imgs = function(max) {
  var seen = {}; var result = []; var lim = max || 40;
  var imgs = document.querySelectorAll('img');
  for (var i = 0; i < imgs.length && result.length < lim; i++) {
    var el = imgs[i];
    var raw = el.currentSrc || el.src || el.getAttribute('data-src') ||
              el.getAttribute('data-lazy') || el.getAttribute('data-original') ||
              el.getAttribute('data-srcset') || '';
    if (raw && raw.indexOf(' ') > -1) raw = raw.split(' ')[0]; // srcset → primera URL
    var full = __abs(raw, true);
    var path = full.split('?')[0];
    if (!__goodImg(path) || seen[path]) continue;
    var w = el.naturalWidth || el.width || 0;
    var h = el.naturalHeight || el.height || 0;
    if (w && h) {
      if (w < 300 || h < 200) continue;          // icono/miniatura
      var r = w / h;
      if (r > 4 || r < 0.25) continue;           // banner/columna (logo/anuncio)
    }
    seen[path] = 1; result.push(full);
  }
  if (!result.length) {                          // último recurso: og:image
    var og = document.querySelector('meta[property="og:image"]');
    if (og && og.content) { var o = __abs(og.content, true); if (__goodImg(o.split('?')[0])) result.push(o); }
  }
  return result;
};

// Filtra/normaliza una lista de URLs estructuradas (multimedia del JSON),
// conservando la query (URLs firmadas) y descartando basura/duplicados.
var __cleanImgs = function(arr, max) {
  var seen = {}; var out = []; var lim = max || 40;
  for (var i = 0; i < (arr || []).length && out.length < lim; i++) {
    var full = __abs(arr[i], true); if (!full) continue;
    var path = full.split('?')[0];
    if (!__goodImg(path) || seen[path]) continue;
    seen[path] = 1; out.push(full);
  }
  return out;
};

// Texto de las listas de características del anuncio (portal-agnóstico). El
// servidor lo re-parsea para rellenar campos que el JSON del portal no trae.
var __features = function() {
  var out = []; var seen = {};
  var add = function(s) {
    if (!s) return; s = String(s).replace(/\\s+/g, ' ').trim();
    if (s.length < 2 || s.length > 120) return;
    var k = s.toLowerCase(); if (seen[k]) return; seen[k] = 1; out.push(s);
  };
  var sels = ['[class*="detail" i] li','[class*="feature" i] li','[class*="caracteristic" i] li',
    '[class*="characteristic" i] li','[class*="equipment" i] li','[class*="amenit" i] li',
    'ul[class*="info" i] li','[class*="property-features" i] li','.adProps li','[class*="basic" i] li'];
  for (var s = 0; s < sels.length && out.length < 60; s++) {
    var n; try { n = document.querySelectorAll(sels[s]); } catch(e) { continue; }
    for (var i = 0; i < n.length && out.length < 60; i++) add(n[i].innerText || n[i].textContent);
  }
  var dts = document.querySelectorAll('dt');
  for (var d = 0; d < dts.length && out.length < 60; d++) {
    var dd = dts[d].nextElementSibling;
    if (dd) add((dts[d].innerText || '') + ': ' + (dd.innerText || ''));
  }
  var en; try { en = document.querySelectorAll('[class*="energ" i],[class*="certific" i]'); } catch(e) { en = []; }
  for (var e = 0; e < en.length && out.length < 60; e++) add(en[e].innerText || en[e].textContent);
  return out;
};

var __challenge = function() {
  var t = (document.title + ' ' + (document.body ? document.body.innerText.slice(0,500) : '')).toLowerCase();
  return t.includes('captcha') || t.includes('robot') || t.includes('datadome') ||
         t.includes('verify') || t.includes('access denied') ||
         !!document.querySelector('.g-recaptcha, #captcha, [data-sitekey]');
};
`;

// ─── Per-portal extraction code ──────────────────────────────────────────────

const FOTOCASA_SCRIPT = (url: string) => `
var nd = window.__NEXT_DATA__;
var pp = nd && nd.props && nd.props.pageProps;
var ad = pp && (pp.ad || pp.realEstate || pp.listing);
if (ad) {
  var rawImgs = [];
  if (ad.multimedia && ad.multimedia.images) {
    for (var i = 0; i < ad.multimedia.images.length; i++) {
      var im = ad.multimedia.images[i];
      if (im) rawImgs.push(im.url || im.src || '');
    }
  }
  var imgs = __cleanImgs(rawImgs, 40);
  if (!imgs.length) imgs = __imgs(40);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'FOTOCASA',
    title: ad.title || ad.name || '',
    price: __price(ad.price || (ad.priceInfo && ad.priceInfo.amount)),
    rooms: ad.rooms || ad.roomsNumber || null,
    bathrooms: ad.bathrooms || null,
    builtArea: ad.constructedArea || ad.surface || null,
    usableArea: ad.usableArea || null,
    floor: ad.floor || null,
    description: (ad.description || '').slice(0, 2000) || null,
    address: (ad.ubication && ad.ubication.address) || null,
    city: (ad.ubication && (ad.ubication.municipality || ad.ubication.city)) || null,
    province: (ad.ubication && ad.ubication.province) || null,
    postalCode: (ad.ubication && ad.ubication.postalCode) || null,
    latitude: (ad.ubication && ad.ubication.latitude) || null,
    longitude: (ad.ubication && ad.ubication.longitude) || null,
    images: imgs,
    features: __features()
  }});
  return;
}
var ld = __jsonLd('RealEstateListing') || __jsonLd('Apartment') || __jsonLd('House');
if (ld) {
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'FOTOCASA',
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price),
    rooms: ld.numberOfRooms || null,
    description: (ld.description || '').slice(0, 2000) || null,
    images: __imgs(40),
    features: __features()
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: 'FOTOCASA', title: document.title, images: __imgs(40), features: __features() }});
`;

const PISOS_SCRIPT = (url: string) => `
var nd = window.__NEXT_DATA__;
var pp = nd && nd.props && nd.props.pageProps;
var pr = pp && (pp.property || pp.ad || pp.listing || pp.detail);
if (pr) {
  var imgSrc = pr.images || pr.photos || pr.multimedia || [];
  var rawImgs = [];
  for (var i = 0; i < imgSrc.length; i++) {
    var im = imgSrc[i];
    rawImgs.push(typeof im === 'string' ? im : (im.url || im.src || ''));
  }
  var imgs = __cleanImgs(rawImgs, 40);
  if (!imgs.length) imgs = __imgs(40);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'PISOS_COM',
    title: pr.title || pr.name || document.title,
    price: __price(pr.price || (pr.offers && pr.offers.price)),
    rooms: pr.rooms || pr.bedrooms || null,
    bathrooms: pr.bathrooms || null,
    builtArea: pr.area || pr.builtArea || pr.constructedArea || null,
    usableArea: pr.usableArea || null,
    city: pr.city || (pr.location && pr.location.city) || null,
    province: pr.province || (pr.location && pr.location.province) || null,
    description: (pr.description || '').slice(0, 2000) || null,
    images: imgs,
    features: __features()
  }});
  return;
}
var ld = __jsonLd('RealEstateListing') || __jsonLd('Apartment');
if (ld) {
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'PISOS_COM',
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price),
    images: __imgs(40),
    features: __features()
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: 'PISOS_COM', title: document.title, images: __imgs(40), features: __features() }});
`;

const HABITACLIA_SCRIPT = (url: string) => `
var nd = window.__NEXT_DATA__;
var pp = nd && nd.props && nd.props.pageProps;
var ad = pp && (pp.ad || pp.property || pp.listing);
if (ad) {
  var rawImgs = [];
  if (ad.multimedia && ad.multimedia.images) {
    for (var i = 0; i < ad.multimedia.images.length; i++) {
      var im = ad.multimedia.images[i];
      if (im) rawImgs.push(im.url || im.src || '');
    }
  }
  var imgs = __cleanImgs(rawImgs, 40);
  if (!imgs.length) imgs = __imgs(40);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'HABITACLIA',
    title: ad.title || ad.name || document.title,
    price: __price(ad.price || (ad.priceInfo && ad.priceInfo.amount)),
    rooms: ad.rooms || null,
    bathrooms: ad.bathrooms || null,
    builtArea: ad.constructedArea || ad.surface || null,
    usableArea: ad.usableArea || null,
    city: (ad.ubication && (ad.ubication.municipality || ad.ubication.city)) || null,
    province: (ad.ubication && ad.ubication.province) || null,
    description: (ad.description || '').slice(0, 2000) || null,
    images: imgs,
    features: __features()
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: 'HABITACLIA', title: document.title, images: __imgs(40), features: __features() }});
`;

const IDEALISTA_SCRIPT = (url: string) => `
if (__challenge()) { __post({ type: 'challenge' }); return; }
var ld = __jsonLd('RealEstateListing');
if (ld) {
  var imgArr = [];
  if (ld.image) {
    var src = Array.isArray(ld.image) ? ld.image : [ld.image];
    for (var i = 0; i < src.length; i++) {
      var im = src[i];
      imgArr.push(typeof im === 'string' ? im : (im.url || im.contentUrl || ''));
    }
  }
  var imgs = __cleanImgs(imgArr, 40);
  if (!imgs.length) imgs = __imgs(40);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'IDEALISTA',
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price),
    description: (ld.description || '').slice(0, 2000) || null,
    rooms: ld.numberOfRooms || null,
    builtArea: (ld.floorSize && ld.floorSize.value) ? Math.round(ld.floorSize.value) : null,
    address: (ld.address && ld.address.streetAddress) || null,
    city: (ld.address && ld.address.addressLocality) || null,
    province: (ld.address && ld.address.addressRegion) || null,
    postalCode: (ld.address && ld.address.postalCode) || null,
    latitude: (ld.geo && ld.geo.latitude) || null,
    longitude: (ld.geo && ld.geo.longitude) || null,
    images: imgs,
    features: __features()
  }});
  return;
}
var titleEl = document.querySelector('h1.main-info__title, span.main-info__title-main, h1');
var priceEl = document.querySelector('.info-data-price span, .price-features__primary, [class*="price"]');
__post({ type: 'extracted', data: {
  url: ${JSON.stringify(url)}, portal: 'IDEALISTA',
  title: (titleEl && titleEl.innerText && titleEl.innerText.trim()) || document.title,
  price: priceEl ? __price(priceEl.innerText) : null,
  images: __imgs(40),
  features: __features()
}});
`;

const MILANUNCIOS_SCRIPT = (url: string) => `
if (__challenge()) { __post({ type: 'challenge' }); return; }
var ld = __jsonLd('Product') || __jsonLd('RealEstateListing');
if (ld) {
  var imgArr = [];
  if (ld.image) { var src = Array.isArray(ld.image) ? ld.image : [ld.image];
    for (var i = 0; i < src.length; i++) { var im = src[i]; imgArr.push(typeof im === 'string' ? im : (im.url || im.contentUrl || '')); } }
  var imgs = __cleanImgs(imgArr, 40);
  if (!imgs.length) imgs = __imgs(40);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'MILANUNCIOS',
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price),
    description: (ld.description || '').slice(0, 2000) || null,
    images: imgs,
    features: __features()
  }});
  return;
}
var titleEl = document.querySelector('h1, [class*="title"]');
var priceEl = document.querySelector('[class*="price"], [class*="Price"]');
__post({ type: 'extracted', data: {
  url: ${JSON.stringify(url)}, portal: 'MILANUNCIOS',
  title: (titleEl && titleEl.innerText && titleEl.innerText.trim()) || document.title,
  price: priceEl ? __price(priceEl.innerText) : null,
  images: __imgs(40),
  features: __features()
}});
`;

const YAENCONTRE_SCRIPT = (url: string) => `
var nd = window.__NEXT_DATA__;
var pp = nd && nd.props && nd.props.pageProps;
var pr = pp && (pp.property || pp.ad || pp.listing || pp.detail);
if (pr) {
  var imgSrc = pr.images || pr.photos || pr.multimedia || [];
  var rawImgs = [];
  for (var i = 0; i < imgSrc.length; i++) { var im = imgSrc[i]; rawImgs.push(typeof im === 'string' ? im : (im.url || im.src || '')); }
  var imgs = __cleanImgs(rawImgs, 40);
  if (!imgs.length) imgs = __imgs(40);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'YAENCONTRE',
    title: pr.title || pr.name || document.title,
    price: __price(pr.price || (pr.offers && pr.offers.price)),
    rooms: pr.rooms || pr.bedrooms || null,
    bathrooms: pr.bathrooms || null,
    builtArea: pr.area || pr.constructedArea || null,
    city: pr.city || (pr.location && pr.location.city) || null,
    description: (pr.description || '').slice(0, 2000) || null,
    images: imgs,
    features: __features()
  }});
  return;
}
var ld = __jsonLd('RealEstateListing');
if (ld) {
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'YAENCONTRE',
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price),
    images: __imgs(40),
    features: __features()
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: 'YAENCONTRE', title: document.title, images: __imgs(40), features: __features() }});
`;

const GENERIC_SCRIPT = (url: string, portal: string) => `
var ld = __jsonLd('RealEstateListing') || __jsonLd('Apartment') || __jsonLd('House') || __jsonLd('Product');
if (ld) {
  var imgArr = [];
  if (ld.image) { var src = Array.isArray(ld.image) ? ld.image : [ld.image];
    for (var i = 0; i < src.length; i++) { var im = src[i]; imgArr.push(typeof im === 'string' ? im : (im.url || im.contentUrl || '')); } }
  var imgs = __cleanImgs(imgArr, 40);
  if (!imgs.length) imgs = __imgs(40);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: ${JSON.stringify(portal)},
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price),
    rooms: ld.numberOfRooms || null,
    builtArea: (ld.floorSize && ld.floorSize.value) ? Math.round(ld.floorSize.value) : null,
    city: (ld.address && ld.address.addressLocality) || null,
    description: (ld.description || '').slice(0, 2000) || null,
    images: imgs,
    features: __features()
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: ${JSON.stringify(portal)}, title: document.title, images: __imgs(40), features: __features() }});
`;

// ─── Public API ───────────────────────────────────────────────────────────────

export function getExtractorScript(url: string): string {
  const portal = detectPortal(url);

  let portalCode: string;
  switch (portal) {
    case "FOTOCASA":   portalCode = FOTOCASA_SCRIPT(url); break;
    case "PISOS_COM":  portalCode = PISOS_SCRIPT(url); break;
    case "HABITACLIA": portalCode = HABITACLIA_SCRIPT(url); break;
    case "IDEALISTA":  portalCode = IDEALISTA_SCRIPT(url); break;
    case "MILANUNCIOS": portalCode = MILANUNCIOS_SCRIPT(url); break;
    case "YAENCONTRE": portalCode = YAENCONTRE_SCRIPT(url); break;
    default:           portalCode = GENERIC_SCRIPT(url, portal);
  }

  return `(function() {
  try {
    ${SHARED_HELPERS}
    ${portalCode}
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', reason: String(e && e.message || e) }));
  }
})();
true;`;
}
