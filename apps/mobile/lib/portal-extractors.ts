/**
 * Scripts de extracción JS que se inyectan en el WebView para cada portal.
 * Cada script extrae datos del anuncio y los envía via window.ReactNativeWebView.postMessage.
 *
 * Tipos de mensaje:
 *   { type: 'extracted', data: ImportPayload }
 *   { type: 'challenge' }               — captcha/DataDome detectado
 *   { type: 'error', reason: string }
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

var __imgs = function(max) {
  var seen = {};
  var result = [];
  // Check meta og:image first
  var og = document.querySelector('meta[property="og:image"]');
  if (og && og.content) { seen[og.content] = 1; result.push(og.content); }
  // DOM images
  var imgs = document.querySelectorAll('img[src], img[data-src], img[data-lazy]');
  for (var i = 0; i < imgs.length && result.length < (max || 60); i++) {
    var src = imgs[i].src || imgs[i].dataset.src || imgs[i].dataset.lazy || '';
    src = src.split('?')[0];
    if (src && /\\.(jpe?g|png|webp)/i.test(src) && src.length > 20 && !seen[src]) {
      seen[src] = 1;
      result.push(src);
    }
  }
  return result;
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
  var imgs = [];
  if (ad.multimedia && ad.multimedia.images) {
    for (var i = 0; i < Math.min(ad.multimedia.images.length, 60); i++) {
      var im = ad.multimedia.images[i];
      if (im && (im.url || im.src)) imgs.push(im.url || im.src);
    }
  }
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
    images: imgs.length ? imgs : __imgs(60)
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
    images: __imgs(60)
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: 'FOTOCASA', title: document.title, images: __imgs(60) }});
`;

const PISOS_SCRIPT = (url: string) => `
var nd = window.__NEXT_DATA__;
var pp = nd && nd.props && nd.props.pageProps;
var pr = pp && (pp.property || pp.ad || pp.listing || pp.detail);
if (pr) {
  var imgs = [];
  var imgSrc = pr.images || pr.photos || pr.multimedia || [];
  for (var i = 0; i < Math.min(imgSrc.length, 60); i++) {
    var im = imgSrc[i];
    imgs.push(typeof im === 'string' ? im : (im.url || im.src || ''));
  }
  imgs = imgs.filter(Boolean);
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'PISOS_COM',
    title: pr.title || pr.name || document.title,
    price: __price(pr.price || (pr.offers && pr.offers.price)),
    rooms: pr.rooms || pr.bedrooms || null,
    bathrooms: pr.bathrooms || null,
    builtArea: pr.area || pr.builtArea || pr.constructedArea || null,
    city: pr.city || (pr.location && pr.location.city) || null,
    province: pr.province || (pr.location && pr.location.province) || null,
    description: (pr.description || '').slice(0, 2000) || null,
    images: imgs.length ? imgs : __imgs(60)
  }});
  return;
}
var ld = __jsonLd('RealEstateListing') || __jsonLd('Apartment');
if (ld) {
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'PISOS_COM',
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price),
    images: __imgs(60)
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: 'PISOS_COM', title: document.title, images: __imgs(60) }});
`;

const HABITACLIA_SCRIPT = (url: string) => `
var nd = window.__NEXT_DATA__;
var pp = nd && nd.props && nd.props.pageProps;
var ad = pp && (pp.ad || pp.property || pp.listing);
if (ad) {
  var imgs = [];
  if (ad.multimedia && ad.multimedia.images) {
    for (var i = 0; i < Math.min(ad.multimedia.images.length, 60); i++) {
      var im = ad.multimedia.images[i];
      if (im) imgs.push(im.url || im.src || '');
    }
    imgs = imgs.filter(Boolean);
  }
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'HABITACLIA',
    title: ad.title || ad.name || document.title,
    price: __price(ad.price || (ad.priceInfo && ad.priceInfo.amount)),
    rooms: ad.rooms || null,
    bathrooms: ad.bathrooms || null,
    builtArea: ad.constructedArea || ad.surface || null,
    city: (ad.ubication && (ad.ubication.municipality || ad.ubication.city)) || null,
    province: (ad.ubication && ad.ubication.province) || null,
    images: imgs.length ? imgs : __imgs(60)
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: 'HABITACLIA', title: document.title, images: __imgs(60) }});
`;

const IDEALISTA_SCRIPT = (url: string) => `
if (__challenge()) { __post({ type: 'challenge' }); return; }
var ld = __jsonLd('RealEstateListing');
if (ld) {
  var imgs = [];
  if (ld.image) {
    var imgArr = Array.isArray(ld.image) ? ld.image : [ld.image];
    for (var i = 0; i < imgArr.length; i++) {
      var im = imgArr[i];
      imgs.push(typeof im === 'string' ? im : (im.url || im.contentUrl || ''));
    }
    imgs = imgs.filter(Boolean);
  }
  if (!imgs.length) imgs = __imgs(60);
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
    images: imgs
  }});
  return;
}
var titleEl = document.querySelector('h1.main-info__title, span.main-info__title-main, h1');
var priceEl = document.querySelector('.info-data-price span, .price-features__primary, [class*="price"]');
__post({ type: 'extracted', data: {
  url: ${JSON.stringify(url)}, portal: 'IDEALISTA',
  title: (titleEl && titleEl.innerText && titleEl.innerText.trim()) || document.title,
  price: priceEl ? __price(priceEl.innerText) : null,
  images: __imgs(60)
}});
`;

const MILANUNCIOS_SCRIPT = (url: string) => `
if (__challenge()) { __post({ type: 'challenge' }); return; }
var ld = __jsonLd('Product') || __jsonLd('RealEstateListing');
if (ld) {
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'MILANUNCIOS',
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price),
    description: (ld.description || '').slice(0, 2000) || null,
    images: __imgs(60)
  }});
  return;
}
var titleEl = document.querySelector('h1, [class*="title"]');
var priceEl = document.querySelector('[class*="price"], [class*="Price"]');
__post({ type: 'extracted', data: {
  url: ${JSON.stringify(url)}, portal: 'MILANUNCIOS',
  title: (titleEl && titleEl.innerText && titleEl.innerText.trim()) || document.title,
  price: priceEl ? __price(priceEl.innerText) : null,
  images: __imgs(60)
}});
`;

const YAENCONTRE_SCRIPT = (url: string) => `
var nd = window.__NEXT_DATA__;
var pp = nd && nd.props && nd.props.pageProps;
var pr = pp && (pp.property || pp.ad || pp.listing || pp.detail);
if (pr) {
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'YAENCONTRE',
    title: pr.title || pr.name || document.title,
    price: __price(pr.price || (pr.offers && pr.offers.price)),
    rooms: pr.rooms || pr.bedrooms || null,
    bathrooms: pr.bathrooms || null,
    builtArea: pr.area || pr.constructedArea || null,
    city: pr.city || (pr.location && pr.location.city) || null,
    images: __imgs(60)
  }});
  return;
}
var ld = __jsonLd('RealEstateListing');
if (ld) {
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: 'YAENCONTRE',
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price),
    images: __imgs(60)
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: 'YAENCONTRE', title: document.title, images: __imgs(60) }});
`;

const GENERIC_SCRIPT = (url: string, portal: string) => `
var ld = __jsonLd('RealEstateListing') || __jsonLd('Apartment') || __jsonLd('House') || __jsonLd('Product');
if (ld) {
  __post({ type: 'extracted', data: {
    url: ${JSON.stringify(url)}, portal: ${JSON.stringify(portal)},
    title: ld.name || document.title,
    price: __price(ld.offers && ld.offers.price),
    rooms: ld.numberOfRooms || null,
    builtArea: (ld.floorSize && ld.floorSize.value) ? Math.round(ld.floorSize.value) : null,
    city: (ld.address && ld.address.addressLocality) || null,
    description: (ld.description || '').slice(0, 2000) || null,
    images: __imgs(60)
  }});
  return;
}
__post({ type: 'extracted', data: { url: ${JSON.stringify(url)}, portal: ${JSON.stringify(portal)}, title: document.title, images: __imgs(60) }});
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
