/**
 * Scripts de extracción JS que se inyectan en el WebView para cada portal.
 * Cada script extrae datos del anuncio y los envía via window.ReactNativeWebView.postMessage.
 *
 * Tipos de mensaje:
 *   { type: 'extracted', data: ImportPayload }
 *   { type: 'challenge' }               — captcha/DataDome detectado
 *   { type: 'error', reason: string }
 *
 * Robustez (todos los portales):
 *  - PRECIO: __price quita TODO lo no-dígito (en es-ES el '.' es separador de
 *    miles → parseFloat('185.000') daba 185). Fallback __priceDom() por si el
 *    JSON del portal no lo trae.
 *  - IMÁGENES: no se prioriza og:image. Se filtra basura SOLO por segmento de
 *    ruta (no se descartan fotos en /static/ o /assets/), por tamaño/ratio real
 *    (DOM) y, si la galería es lazy y hay pocas, se completa con un barrido del
 *    HTML excluyendo miniaturas (para no colar fotos de anuncios "similares").
 *  - CAMPOS: SIEMPRE se manda `features` (texto de las características) +
 *    descripción por DOM como fallback; el servidor re-parsea el resto.
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
// Operación del anuncio: venta vs alquiler. Idealista/Fotocasa/etc. lo llevan en
// la ruta (/alquiler-…, /comprar-…); fallback a __NEXT_DATA__ y, por último, a
// señales de texto (€/mes). Devuelve 'SALE' | 'RENT'.
var __operation = function() {
  var path = (location.pathname + ' ' + location.search).toLowerCase();
  if (/alquil|lloguer|arrenda|\\brent\\b|\\brental\\b/.test(path)) return 'RENT';
  if (/venta|comprar|vender|obra-?nueva|\\bsale\\b|\\bbuy\\b/.test(path)) return 'SALE';
  try {
    var nd = window.__NEXT_DATA__; var s = nd ? JSON.stringify(nd).toLowerCase() : '';
    if (/"transactiontypeid":\\s*3|"operation":"?rent|"isrental":true|"transactiontype":"?rent|"transaction":"?rent/.test(s)) return 'RENT';
    if (/"transactiontypeid":\\s*1|"operation":"?(sale|buy)|"transactiontype":"?(sale|buy)/.test(s)) return 'SALE';
  } catch(e) {}
  var t = (document.body ? document.body.innerText.slice(0, 4000) : '').toLowerCase();
  if (/€\\s*\\/\\s*mes|\\/mes\\b|al mes\\b|mensuales\\b/.test(t) && !/en venta|precio de venta/.test(t)) return 'RENT';
  return 'SALE';
};

var __post = function(obj) {
  // Inyecta la operación en toda extracción (evita repetirlo en cada portal).
  if (obj && obj.type === 'extracted' && obj.data && obj.data.operationType == null) {
    try { obj.data.operationType = __operation(); } catch(e) { obj.data.operationType = 'SALE'; }
  }
  window.ReactNativeWebView.postMessage(JSON.stringify(obj));
};

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

// Precio de inmueble = euros enteros. Quitamos TODO lo no-dígito porque en
// es-ES el '.' es separador de miles (parseFloat('185.000') = 185 era un bug).
var __price = function(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Math.round(v);
  var s = String(v).replace(/[^\\d]/g, '');
  if (!s) return null;
  var n = parseInt(s, 10);
  return isNaN(n) ? null : n;
};

// Resuelve a URL absoluta. keepQuery=true conserva la query (URLs firmadas de CDN).
var __abs = function(src, keepQuery) {
  if (!src) return '';
  try { var u = new URL(src, location.href).href; return keepQuery ? u : u.split('?')[0]; }
  catch(e) { return keepQuery ? String(src) : String(src).split('?')[0]; }
};

// Basura SOLO como segmento de ruta/fichero (no subcadena) → no descarta fotos
// reales en /static/ o /assets/. + hosts de no-fotos. + miniaturas.
var __junk = /(?:^|[\\/_.\\-])(logos?|sprites?|icons?|icono|favicon|placeholder|avatars?|watermark|marca-?agua|blank|pixel|spacer|loading|banner|badges?|sello|bandera|flags?)(?:[\\/_.\\-]|$)/i;
var __junkHost = /(googleapis|gstatic|staticmap|maps\\.google|fbcdn|facebook|whatsapp|instagram|twitter|gravatar)/i;
var __thumb = /(thumbs?|_thumb|-thumb|\\/mini\\/|_mini|web_listing|gallery-thumb|listing-thumb)/i;

var __goodImg = function(path) {
  if (!path || !/^https?:/i.test(path)) return false;
  if (/\\.(svg|gif)(\\?|$)/i.test(path)) return false;
  if (__junk.test(path) || __junkHost.test(path)) return false;
  return true;
};

// Barrido del HTML por URLs de imágenes (capta galerías lazy aún no en el DOM).
// Excluye miniaturas para no colar fotos de anuncios "similares".
var __htmlImgs = function(max) {
  var html = ''; try { html = document.documentElement.outerHTML || ''; } catch(e) {}
  var re = /https?:\\/\\/[^"'\\s<>()\\\\]+\\.(?:jpe?g|png|webp)(?:\\?[^"'\\s<>()\\\\]*)?/gi;
  var m, seen = {}, out = []; var lim = max || 60;
  while ((m = re.exec(html)) && out.length < lim) {
    var full = m[0]; var path = full.split('?')[0];
    if (!__goodImg(path) || __thumb.test(path) || seen[path]) continue;
    seen[path] = 1; out.push(full);
  }
  return out;
};

// (DOM) imágenes reales filtrando por tamaño, ratio y URL. NO prioriza og:image.
// Si hay pocas (galería lazy), completa con el barrido del HTML.
var __imgs = function(max) {
  var seen = {}; var result = []; var lim = max || 60;
  var imgs = document.querySelectorAll('img');
  for (var i = 0; i < imgs.length && result.length < lim; i++) {
    var el = imgs[i];
    var raw = el.currentSrc || el.src || el.getAttribute('data-src') ||
              el.getAttribute('data-lazy') || el.getAttribute('data-original') ||
              el.getAttribute('data-srcset') || '';
    if (raw && raw.indexOf(' ') > -1) raw = raw.split(' ')[0]; // srcset → primera URL
    var full = __abs(raw, true); var path = full.split('?')[0];
    if (!__goodImg(path) || seen[path]) continue;
    var w = el.naturalWidth || el.width || 0;
    var h = el.naturalHeight || el.height || 0;
    if (w && h) { if (w < 300 || h < 200) continue; var r = w / h; if (r > 4 || r < 0.25) continue; }
    seen[path] = 1; result.push(full);
  }
  if (result.length < 10) {
    var extra = __htmlImgs(lim);
    for (var e = 0; e < extra.length && result.length < lim; e++) {
      var p = extra[e].split('?')[0];
      if (!seen[p]) { seen[p] = 1; result.push(extra[e]); }
    }
  }
  if (!result.length) {
    var og = document.querySelector('meta[property="og:image"]');
    if (og && og.content) { var o = __abs(og.content, true); if (__goodImg(o.split('?')[0])) result.push(o); }
  }
  return result;
};

// Filtra/normaliza una lista de URLs estructuradas (multimedia del JSON).
var __cleanImgs = function(arr, max) {
  var seen = {}; var out = []; var lim = max || 60;
  for (var i = 0; i < (arr || []).length && out.length < lim; i++) {
    var full = __abs(arr[i], true); if (!full) continue;
    var path = full.split('?')[0];
    if (!__goodImg(path) || seen[path]) continue;
    seen[path] = 1; out.push(full);
  }
  return out;
};

// Precio desde el DOM (fallback). Siempre ignora €/m². En VENTA ignora también
// €/mes; en ALQUILER el €/mes es justamente el precio bueno (y el mínimo baja a
// 100 €, una renta puede ser de pocos cientos).
var __priceDom = function() {
  var op = __operation();
  var sels = ['[itemprop="price"]','[class*="price" i]','[class*="Price"]','[data-testid*="price" i]'];
  for (var s = 0; s < sels.length; s++) {
    var els; try { els = document.querySelectorAll(sels[s]); } catch(e) { continue; }
    for (var i = 0; i < els.length; i++) {
      var txt = (els[i].innerText || els[i].textContent || '');
      if (txt.indexOf('€') === -1 && !/eur/i.test(txt)) continue;
      if (/€\\s*\\/\\s*m²|€\\/m2|\\/\\s*m²|\\/m2\\b/i.test(txt)) continue; // €/m² nunca
      if (op !== 'RENT' && /\\/\\s*mes|\\/mes|mensual|al mes/i.test(txt)) continue; // €/mes solo en alquiler
      var p = __price(txt);
      if (p && p >= (op === 'RENT' ? 100 : 1000)) return p;
    }
  }
  return null;
};

// Descripción/resumen desde el DOM (fallback).
var __descDom = function() {
  // CTAs/etiquetas que NO son descripción (pisos.com colaba "ver la casa en 3D").
  var __descBad = /(ver|visita|recorrido|tour)[^.]{0,24}(3d|360|virtual)|tour virtual|v[ií]deo del inmueble/i;
  var sels = ['[itemprop="description"]','[class*="description" i]','[class*="comment" i]','[class*="detail-text" i]','[class*="adText" i]','[class*="texto" i]'];
  var best = '';
  for (var s = 0; s < sels.length; s++) {
    var els; try { els = document.querySelectorAll(sels[s]); } catch(e) { continue; }
    for (var i = 0; i < els.length; i++) {
      var t = (els[i].innerText || els[i].textContent || '').replace(/\\s+/g,' ').trim();
      if (t.length < 80 && __descBad.test(t)) continue; // descarta CTAs cortos de 3D/tour/vídeo
      if (t.length > best.length) best = t;
    }
  }
  return best ? best.slice(0, 2000) : null;
};

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
  // Interstitial de DataDome: el captcha vive en un IFRAME de captcha-delivery
  // (o un script de datadome) y el body apenas tiene texto — las palabras clave
  // solas no lo cazaban. Selectores primero, keywords después.
  if (document.querySelector(
    'iframe[src*="captcha-delivery"],script[src*="captcha-delivery"],' +
    'iframe[src*="datadome"],script[src*="datadome"],' +
    '.g-recaptcha, #captcha, [data-sitekey]'
  )) return true;
  var t = (document.title + ' ' + (document.body ? document.body.innerText.slice(0,500) : '')).toLowerCase();
  return t.includes('captcha') || t.includes('robot') || t.includes('datadome') ||
         t.includes('verify') || t.includes('access denied') ||
         t.includes('has sido bloqueado') || t.includes('you have been blocked');
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
    for (var i = 0; i < ad.multimedia.images.length; i++) { var im = ad.multimedia.images[i]; if (im) rawImgs.push(im.url || im.src || ''); }
  }
  var imgs = __cleanImgs(rawImgs, 60);
  if (imgs.length < 5) imgs = __imgs(60);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'FOTOCASA',
    title: ad.title || ad.name || document.title,
    price: __price(ad.price || (ad.priceInfo && ad.priceInfo.amount)) || __priceDom(),
    rooms: ad.rooms || ad.roomsNumber || null,
    bathrooms: ad.bathrooms || null,
    builtArea: ad.constructedArea || ad.surface || null,
    usableArea: ad.usableArea || null,
    floor: ad.floor || null,
    description: ((ad.description || '').slice(0, 2000)) || __descDom(),
    address: (ad.ubication && ad.ubication.address) || null,
    city: (ad.ubication && (ad.ubication.municipality || ad.ubication.city)) || null,
    province: (ad.ubication && ad.ubication.province) || null,
    postalCode: (ad.ubication && ad.ubication.postalCode) || null,
    latitude: (ad.ubication && ad.ubication.latitude) || null,
    longitude: (ad.ubication && ad.ubication.longitude) || null,
    images: imgs, features: __features()
  }});
  return;
}
var ld = __jsonLd('RealEstateListing') || __jsonLd('Apartment') || __jsonLd('House');
if (ld) {
  var li = []; if (ld.image) { var a = Array.isArray(ld.image) ? ld.image : [ld.image]; for (var i=0;i<a.length;i++){ var im=a[i]; li.push(typeof im==='string'?im:(im.url||im.contentUrl||'')); } }
  var imgs = __cleanImgs(li, 60); if (imgs.length < 5) imgs = __imgs(60);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'FOTOCASA',
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price) || __priceDom(),
    rooms: ld.numberOfRooms || null,
    description: ((ld.description || '').slice(0, 2000)) || __descDom(),
    images: imgs, features: __features()
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: 'FOTOCASA', title: document.title, price: __priceDom(), description: __descDom(), images: __imgs(60), features: __features() }});
`;

const PISOS_SCRIPT = (url: string) => `
var nd = window.__NEXT_DATA__;
var pp = nd && nd.props && nd.props.pageProps;
var pr = pp && (pp.property || pp.ad || pp.listing || pp.detail);
if (pr) {
  var imgSrc = pr.images || pr.photos || pr.multimedia || [];
  var rawImgs = [];
  for (var i = 0; i < imgSrc.length; i++) { var im = imgSrc[i]; rawImgs.push(typeof im === 'string' ? im : (im.url || im.src || '')); }
  var imgs = __cleanImgs(rawImgs, 60); if (imgs.length < 5) imgs = __imgs(60);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'PISOS_COM',
    title: pr.title || pr.name || document.title,
    price: __price(pr.price || (pr.offers && pr.offers.price)) || __priceDom(),
    rooms: pr.rooms || pr.bedrooms || null,
    bathrooms: pr.bathrooms || null,
    builtArea: pr.area || pr.builtArea || pr.constructedArea || null,
    usableArea: pr.usableArea || null,
    city: pr.city || (pr.location && pr.location.city) || null,
    province: pr.province || (pr.location && pr.location.province) || null,
    description: ((pr.description || '').slice(0, 2000)) || __descDom(),
    images: imgs, features: __features()
  }});
  return;
}
var ld = __jsonLd('RealEstateListing') || __jsonLd('Apartment');
if (ld) {
  var li = []; if (ld.image) { var a = Array.isArray(ld.image) ? ld.image : [ld.image]; for (var i=0;i<a.length;i++){ var im=a[i]; li.push(typeof im==='string'?im:(im.url||im.contentUrl||'')); } }
  var imgs = __cleanImgs(li, 60); if (imgs.length < 5) imgs = __imgs(60);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'PISOS_COM',
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price) || __priceDom(),
    description: ((ld.description || '').slice(0, 2000)) || __descDom(),
    images: imgs, features: __features()
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: 'PISOS_COM', title: document.title, price: __priceDom(), description: __descDom(), images: __imgs(60), features: __features() }});
`;

const HABITACLIA_SCRIPT = (url: string) => `
var nd = window.__NEXT_DATA__;
var pp = nd && nd.props && nd.props.pageProps;
var ad = pp && (pp.ad || pp.property || pp.listing);
if (ad) {
  var rawImgs = [];
  if (ad.multimedia && ad.multimedia.images) { for (var i = 0; i < ad.multimedia.images.length; i++) { var im = ad.multimedia.images[i]; if (im) rawImgs.push(im.url || im.src || ''); } }
  var imgs = __cleanImgs(rawImgs, 60); if (imgs.length < 5) imgs = __imgs(60);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'HABITACLIA',
    title: ad.title || ad.name || document.title,
    price: __price(ad.price || (ad.priceInfo && ad.priceInfo.amount)) || __priceDom(),
    rooms: ad.rooms || null,
    bathrooms: ad.bathrooms || null,
    builtArea: ad.constructedArea || ad.surface || null,
    usableArea: ad.usableArea || null,
    city: (ad.ubication && (ad.ubication.municipality || ad.ubication.city)) || null,
    province: (ad.ubication && ad.ubication.province) || null,
    description: ((ad.description || '').slice(0, 2000)) || __descDom(),
    images: imgs, features: __features()
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: 'HABITACLIA', title: document.title, price: __priceDom(), description: __descDom(), images: __imgs(60), features: __features() }});
`;

// Idealista (DataDome): la extracción REINTENTA con espera antes de rendirse.
// El interstitial de DataDome puede montarse tarde (iframe async) y la página
// real puede tardar en hidratar — el patrón anterior "challenge o extrae YA"
// mandaba extracciones vacías (→ guard anti-vacío) sin dar tiempo a ninguna de
// las dos cosas. Ahora: challenge → fuera; datos sustanciales (JSON-LD, h1 o
// precio) → extrae; nada aún → espera 1,5s y reintenta (máx. 3); agotado →
// manda lo que haya (el guard del importador avisará con err_empty_listing).
const IDEALISTA_SCRIPT = (url: string) => `
var __extract = function() {
  var ld = __jsonLd('RealEstateListing');
  if (ld) {
    var imgArr = [];
    if (ld.image) { var src = Array.isArray(ld.image) ? ld.image : [ld.image]; for (var i = 0; i < src.length; i++) { var im = src[i]; imgArr.push(typeof im === 'string' ? im : (im.url || im.contentUrl || '')); } }
    var imgs = __cleanImgs(imgArr, 60); if (imgs.length < 5) imgs = __imgs(60);
    __post({ type: 'extracted', data: {
      url: ${JSON.stringify(url)}, portal: 'IDEALISTA',
      title: ld.name || document.title,
      price: __price(ld.offers && ld.offers.price) || __priceDom(),
      description: ((ld.description || '').slice(0, 2000)) || __descDom(),
      rooms: ld.numberOfRooms || null,
      builtArea: (ld.floorSize && ld.floorSize.value) ? Math.round(ld.floorSize.value) : null,
      address: (ld.address && ld.address.streetAddress) || null,
      city: (ld.address && ld.address.addressLocality) || null,
      province: (ld.address && ld.address.addressRegion) || null,
      postalCode: (ld.address && ld.address.postalCode) || null,
      latitude: (ld.geo && ld.geo.latitude) || null,
      longitude: (ld.geo && ld.geo.longitude) || null,
      images: imgs, features: __features()
    }});
    return true;
  }
  var titleEl = document.querySelector('h1.main-info__title, span.main-info__title-main, h1');
  var hasTitle = titleEl && titleEl.innerText && titleEl.innerText.trim().length > 3;
  if (hasTitle || __priceDom()) {
    __post({ type: 'extracted', data: {
      url: ${JSON.stringify(url)}, portal: 'IDEALISTA',
      title: hasTitle ? titleEl.innerText.trim() : document.title,
      price: __priceDom(),
      description: __descDom(),
      images: __imgs(60), features: __features()
    }});
    return true;
  }
  return false;
};
var __tries = 0;
var __run = function() {
  // Challenge visible: avisa a la app (muestra el WebView) y SIGUE SONDEANDO —
  // si el usuario resuelve el captcha sin que DataDome recargue la página (quita
  // el iframe y continúa), no habría loadEnd que re-inyecte: este timer extrae.
  if (__challenge()) { __post({ type: 'challenge' }); setTimeout(__run, 2000); return; }
  if (__extract()) return;
  if (__tries++ < 3) { setTimeout(__run, 1500); return; }
  // Sin datos tras ~4,5s y sin challenge detectable: manda lo que haya.
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'IDEALISTA',
    title: document.title, price: __priceDom(), description: __descDom(),
    images: __imgs(60), features: __features()
  }});
};
// Evita carreras si el WebView re-inyecta sobre el MISMO documento (cada
// navegación/reload crea documento nuevo → el flag se resetea solo).
if (!window.__nkIdealistaRunning) { window.__nkIdealistaRunning = true; __run(); }
`;

const MILANUNCIOS_SCRIPT = (url: string) => `
if (__challenge()) { __post({ type: 'challenge' }); return; }
var ld = __jsonLd('Product') || __jsonLd('RealEstateListing');
if (ld) {
  var imgArr = []; if (ld.image) { var src = Array.isArray(ld.image) ? ld.image : [ld.image]; for (var i = 0; i < src.length; i++) { var im = src[i]; imgArr.push(typeof im === 'string' ? im : (im.url || im.contentUrl || '')); } }
  var imgs = __cleanImgs(imgArr, 60); if (imgs.length < 5) imgs = __imgs(60);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'MILANUNCIOS',
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price) || __priceDom(),
    description: ((ld.description || '').slice(0, 2000)) || __descDom(),
    images: imgs, features: __features()
  }});
  return;
}
var titleEl = document.querySelector('h1, [class*="title"]');
__post({ type: 'extracted', data: {
  url: ${JSON.stringify(url)}, portal: 'MILANUNCIOS',
  title: (titleEl && titleEl.innerText && titleEl.innerText.trim()) || document.title,
  price: __priceDom(),
  description: __descDom(),
  images: __imgs(60), features: __features()
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
  var imgs = __cleanImgs(rawImgs, 60); if (imgs.length < 5) imgs = __imgs(60);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'YAENCONTRE',
    title: pr.title || pr.name || document.title,
    price: __price(pr.price || (pr.offers && pr.offers.price)) || __priceDom(),
    rooms: pr.rooms || pr.bedrooms || null,
    bathrooms: pr.bathrooms || null,
    builtArea: pr.area || pr.constructedArea || null,
    city: pr.city || (pr.location && pr.location.city) || null,
    description: ((pr.description || '').slice(0, 2000)) || __descDom(),
    images: imgs, features: __features()
  }});
  return;
}
var ld = __jsonLd('RealEstateListing');
if (ld) {
  var li = []; if (ld.image) { var a = Array.isArray(ld.image) ? ld.image : [ld.image]; for (var i=0;i<a.length;i++){ var im=a[i]; li.push(typeof im==='string'?im:(im.url||im.contentUrl||'')); } }
  var imgs = __cleanImgs(li, 60); if (imgs.length < 5) imgs = __imgs(60);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'YAENCONTRE',
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price) || __priceDom(),
    description: ((ld.description || '').slice(0, 2000)) || __descDom(),
    images: imgs, features: __features()
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: 'YAENCONTRE', title: document.title, price: __priceDom(), description: __descDom(), images: __imgs(60), features: __features() }});
`;

const GENERIC_SCRIPT = (url: string, portal: string) => `
var ld = __jsonLd('RealEstateListing') || __jsonLd('Apartment') || __jsonLd('House') || __jsonLd('Product');
if (ld) {
  var li = []; if (ld.image) { var a = Array.isArray(ld.image) ? ld.image : [ld.image]; for (var i=0;i<a.length;i++){ var im=a[i]; li.push(typeof im==='string'?im:(im.url||im.contentUrl||'')); } }
  var imgs = __cleanImgs(li, 60); if (imgs.length < 5) imgs = __imgs(60);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: ${JSON.stringify(portal)},
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price) || __priceDom(),
    rooms: ld.numberOfRooms || null,
    builtArea: (ld.floorSize && ld.floorSize.value) ? Math.round(ld.floorSize.value) : null,
    city: (ld.address && ld.address.addressLocality) || null,
    description: ((ld.description || '').slice(0, 2000)) || __descDom(),
    images: imgs, features: __features()
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: ${JSON.stringify(portal)}, title: document.title, price: __priceDom(), description: __descDom(), images: __imgs(60), features: __features() }});
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
