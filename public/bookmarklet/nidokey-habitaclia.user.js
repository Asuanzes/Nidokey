// ==UserScript==
// @name         Nidokey - Importador Habitaclia
// @namespace    https://nidokey.es/
// @version      0.3.0
// @description  Importa anuncios de Habitaclia a Nidokey.
// @match        https://www.habitaclia.com/*
// @match        https://habitaclia.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";
  const API = "http://localhost:4200/api/listings/import";
  const PORTAL = "HABITACLIA";

  if (!/-i\d+\.htm/.test(location.pathname)) return; // solo páginas de ficha

  // ---------- UI ----------
  function injectButton() {
    if (document.getElementById("__nidokey_btn__")) return;
    const b = document.createElement("button");
    b.id = "__nidokey_btn__";
    b.textContent = "📥 Importar a Nidokey";
    b.style.cssText =
      "position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#3A5F8A;color:#FAFAF7;border:none;cursor:pointer;padding:12px 18px;border-radius:8px;font:14px system-ui,sans-serif;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.25);";
    b.onclick = run;
    document.body.appendChild(b);
  }
  function notify(msg, color) {
    const id = "__nidokey_toast__";
    document.getElementById(id)?.remove();
    const el = document.createElement("div");
    el.id = id;
    el.textContent = msg;
    el.style.cssText =
      "position:fixed;top:20px;right:20px;z-index:2147483647;background:" + (color || "#3A5F8A") + ";color:#fff;padding:12px 16px;border-radius:8px;font:14px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:360px;white-space:pre-wrap;";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }

  // ---------- Helpers ----------
  const text = (sel, root) => {
    const el = (root || document).querySelector(sel);
    return el ? el.textContent.trim().replace(/\s+/g, " ") : null;
  };
  const intFrom = (s) => {
    if (s == null) return null;
    const m = String(s).replace(/[\.\s]/g, "").match(/-?\d+/);
    return m ? parseInt(m[0], 10) : null;
  };
  const meta = (q) => document.querySelector(q)?.getAttribute("content") || null;
  function readJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const out = [];
    for (const s of scripts) {
      try {
        const d = JSON.parse(s.textContent);
        (Array.isArray(d) ? d : [d]).forEach((x) => out.push(x));
      } catch (_) {}
    }
    return out;
  }

  function detectType() {
    const p = location.pathname.toLowerCase();
    if (/comprar-atico/.test(p)) return "ATICO";
    if (/comprar-chalet|comprar-casa/.test(p)) return "CHALET";
    if (/comprar-duplex/.test(p)) return "DUPLEX";
    if (/comprar-estudio/.test(p)) return "ESTUDIO";
    if (/comprar-loft/.test(p)) return "LOFT";
    if (/comprar-local/.test(p)) return "LOCAL";
    if (/comprar-terreno|comprar-parcela/.test(p)) return "TERRENO";
    if (/comprar-piso|comprar-apartamento/.test(p)) return "PISO";
    return "PISO";
  }

  // Patrón de URL de foto real de un anuncio Habitaclia:
  //   https://images.habimg.com/imgh/<AGENCIA>-<PROP>/<slug>_<UUID><SIZE>.jpg
  // SIZE = letra(s) al final: P, M, G, L, XL, XXL, S, etc.
  // Otras URLs (dotnet/content/, hab_inmuebles/img/, /boletines/, /foto.htm) son
  // assets de la UI, NO fotos del anuncio → las descartamos.
  const PHOTO_RX = /^https?:\/\/images\.habimg\.com\/imgh\/(\d+-\d+)\/[^?#]+?_[a-f0-9-]+([A-Z]{1,3})?\.(jpe?g|png|webp)$/i;

  function upgradeSize(u) {
    // Sube el sufijo de tamaño a XL si la URL termina en letra(s) antes de .ext
    return u.replace(/(_[a-f0-9-]+)([A-Z]{1,3})?(\.(?:jpe?g|png|webp))$/i, "$1XL$3");
  }

  function readImages() {
    const all = new Set();

    document.querySelectorAll("img").forEach((img) => {
      const src = img.src || img.getAttribute("data-src") || img.getAttribute("data-original") || "";
      if (PHOTO_RX.test(src)) all.add(src.replace(/\?.*$/, ""));
    });
    document.querySelectorAll('meta[property="og:image"]').forEach((m) => {
      const c = m.getAttribute("content");
      if (c && PHOTO_RX.test(c)) all.add(c);
    });
    for (const d of readJsonLd()) {
      const imgs = d.image;
      if (Array.isArray(imgs)) imgs.forEach((u) => typeof u === "string" && PHOTO_RX.test(u) && all.add(u));
      else if (typeof imgs === "string" && PHOTO_RX.test(imgs)) all.add(imgs);
    }
    // Regex sobre todo el HTML
    const reAll = /https?:(?:\\?\/){2}images\.habimg\.com\/imgh\/\d+-\d+\/[^"'\s<>\\)]+?\.(?:jpe?g|png|webp)/gi;
    let m;
    while ((m = reAll.exec(document.documentElement.outerHTML)) !== null) {
      if (PHOTO_RX.test(m[0])) all.add(m[0]);
    }

    // Agrupar por carpeta <AGENCIA>-<PROP> y quedarnos con el grupo más grande
    // (las URLs de "anuncios relacionados" estarán en carpetas distintas con 1-2 fotos cada una).
    const byFolder = new Map();
    for (const u of all) {
      const match = u.match(PHOTO_RX);
      if (!match) continue;
      const folder = match[1];
      if (!byFolder.has(folder)) byFolder.set(folder, []);
      byFolder.get(folder).push(u);
    }
    if (byFolder.size === 0) return [];

    let bestFolder = null, bestSize = 0;
    for (const [folder, list] of byFolder) {
      if (list.length > bestSize) { bestSize = list.length; bestFolder = folder; }
    }
    const main = byFolder.get(bestFolder);

    // Forzar tamaño XL y deduplicar por UUID
    const byUuid = new Map();
    for (const u of main) {
      const upgraded = upgradeSize(u);
      // El UUID es la parte hex tras el último "_"
      const uuidMatch = upgraded.match(/_([a-f0-9-]{8,})(?:[A-Z]{1,3})?\.(?:jpe?g|png|webp)$/i);
      const key = uuidMatch ? uuidMatch[1] : upgraded;
      if (!byUuid.has(key)) byUuid.set(key, upgraded);
    }
    return Array.from(byUuid.values()).slice(0, 80);
  }

  function readFeatures() {
    const out = {};
    const all = [];
    document
      .querySelectorAll(
        ".feature-container li, .feature-list li, ul.feature li, .features li, [class*='feature'] li"
      )
      .forEach((li) => {
        const t = li.textContent.trim().replace(/\s+/g, " ");
        if (!t || t.length > 80) return;
        all.push(t);
        const low = t.toLowerCase();
        const n = intFrom(t);
        // CRÍTICO: descartar "€/m²" (es precio unitario, no superficie)
        const isPricePerSqm = /€\s*\/\s*m|€\/m|€\s*por\s*m/i.test(t);
        if (!isPricePerSqm) {
          if (/m²|\bm2\b|metros/.test(low) && /constru|edificad/.test(low) && n) out.builtArea = n;
          else if (/m²|\bm2\b|metros/.test(low) && !out.builtArea && n && n >= 5 && n <= 5000) out.builtArea = n;
          if (/útil|util/.test(low) && /m²|\bm2\b|metros/.test(low) && n && n >= 5 && n <= 5000) out.usableArea = n;
          if (/parcela|terreno|plot/.test(low) && /m²|\bm2\b|metros/.test(low) && n) out.plotArea = n;
        }
        if (/habitaci[oó]n|dormit|\bhabs?\.?\b/.test(low) && n != null) out.rooms = n;
        if (/baño|aseo|\bbaños?\b/.test(low) && n != null) out.bathrooms = n;
        if (/planta\b/.test(low)) out.floor = t;
        if (/ascensor/.test(low)) out.hasElevator = !/sin ascensor/i.test(low);
        if (/parking|garaje|plaza/.test(low)) out.hasGarage = true;
        if (/trastero/.test(low)) out.hasStorage = true;
        if (/terraza|balc[oó]n/.test(low)) out.hasTerrace = true;
        if (/chimenea/.test(low)) out.hasFireplace = true;
        if (/jard[ií]n/.test(low)) out.hasGarden = true;
        if (/piscina/.test(low)) out.hasPool = true;
        const yb = low.match(/(?:construido en|año\s*(?:de\s*)?construcci[oó]n)\D*(\d{4})/);
        if (yb) {
          const y = +yb[1];
          if (y > 1700 && y < new Date().getFullYear() + 2) out.yearBuilt = y;
        }
      });
    return { basics: out, all };
  }

  // Palabras que NUNCA pueden ser provincia/ciudad/barrio (vienen de menús,
  // login, recomendaciones, etc.). Filtramos crumbs por esto.
  const BAD_CRUMB_RX = /iniciar|sesi[oó]n|registrar|registro|inicio|home|consejos|encontrar|ayuda|contacto|publicar|guardar|favoritos|recomend|buscar|men[uú]|comprar|alquilar|alquiler|vender/i;

  function readLocation() {
    // Breadcrumb específico de Habitaclia (no nav genérico que recoge basura)
    const crumbs = Array.from(
      document.querySelectorAll(".breadcrumb a, .bread-crumb a, [class*='breadcrumb'] a, [class*='Breadcrumb'] a")
    )
      .map((a) => a.textContent.trim())
      .filter((t) => t && t.length >= 3 && t.length < 50 && !BAD_CRUMB_RX.test(t));

    let province = "Asturias",
      city = null,
      neighborhood = null;

    // Habitaclia breadcrumb típico: Inicio > Comprar > Asturias > Gijón > Somió
    if (crumbs.length >= 1) {
      // Provincia = primera miga que sea provincia conocida
      for (const c of crumbs) {
        if (/^(asturias|madrid|barcelona|valencia|sevilla|m[aá]laga|murcia|c[aá]diz)$/i.test(c)) {
          province = c;
          break;
        }
      }
      city = crumbs[crumbs.length - 1];
    }
    // URL fallback: -<municipio>-iNNNN
    const um = location.pathname.match(/-([a-z0-9_]+)-i\d+\.htm/i);
    if ((!city || BAD_CRUMB_RX.test(city)) && um) {
      city = um[1].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    }
    // Si la "city" es realmente un barrio (penúltima miga), promueve y barrio
    if (crumbs.length >= 2 && /asturias|madrid|barcelona|valencia/i.test(crumbs[crumbs.length - 2])) {
      // Solo 1 nivel debajo de provincia → city, no neighborhood
    } else if (crumbs.length >= 3) {
      const candidate = crumbs[crumbs.length - 2];
      if (candidate && !BAD_CRUMB_RX.test(candidate)) {
        neighborhood = city;
        city = candidate;
      }
    }
    return { city, province, neighborhood };
  }

  // Extrae precio de una lista de "features" como ['695.000 €', '186 m2', ...]
  function priceFromFeatures(features) {
    for (const f of features) {
      const m = f.replace(/\s/g, "").match(/(\d{1,3}(?:\.\d{3})+|\d{4,})\s*€/);
      if (m) {
        const n = parseInt(m[1].replace(/\./g, ""), 10);
        if (n >= 10000) return n; // sanity: nada vale menos de 10k €
      }
    }
    return null;
  }

  function run() {
    const ld = readJsonLd();
    const product = ld.find((d) => d && (d["@type"] === "Product" || d.offers || d["@type"] === "SingleFamilyResidence"));

    const title = (product && product.name) || text("h1") || document.title;
    const description = (product && product.description) || meta('meta[name="description"]') || text(".description, [class*='Description']");

    const { basics, all: features } = readFeatures();

    // Precio: probamos varias fuentes, priorizamos lo que tenga sentido (>10k€)
    // El JSON-LD a veces tiene "lowPrice" con valor extraño (hipoteca?), por
    // eso preferimos el de features (suele ser correcto).
    let price = priceFromFeatures(features);
    if (!price || price < 10000) {
      const ldPrice = product && product.offers && (product.offers.price || product.offers.lowPrice);
      const n = intFrom(ldPrice);
      if (n && n >= 10000) price = n;
    }
    if (!price || price < 10000) {
      const n = intFrom(text("[class*='price'], .price, [itemprop='price']"));
      if (n && n >= 10000) price = n;
    }
    const images = readImages();
    const loc = readLocation();

    const ext = location.pathname.match(/-i(\d+)\.htm/);
    const externalId = ext ? ext[1] : null;

    const payload = {
      url: location.href.split("#")[0].split("?")[0],
      portal: PORTAL,
      externalId,
      title: (title || "Anuncio Habitaclia").slice(0, 200),
      description: description || null,
      price: price || null,
      type: detectType(),
      city: loc.city,
      province: loc.province,
      neighborhood: loc.neighborhood,
      rooms: basics.rooms ?? null,
      bathrooms: basics.bathrooms ?? null,
      builtArea: basics.builtArea ?? null,
      usableArea: basics.usableArea ?? null,
      floor: basics.floor ?? null,
      yearBuilt: basics.yearBuilt ?? null,
      hasElevator: basics.hasElevator ?? null,
      hasGarage: basics.hasGarage ?? null,
      hasStorage: basics.hasStorage ?? null,
      hasTerrace: basics.hasTerrace ?? null,
      hasFireplace: basics.hasFireplace ?? null,
      hasGarden: basics.hasGarden ?? null,
      hasPool: basics.hasPool ?? null,
      energyRating: "UNKNOWN",
      images,
      features,
    };
    notify("Nidokey: enviando…", "#3A5F8A");
    console.log("[Nidokey] payload:", payload);
    console.log("[Nidokey] payload JSON:\n" + JSON.stringify(payload, null, 2));
    GM_xmlhttpRequest({
      method: "POST", url: API, headers: { "Content-Type": "application/json" },
      data: JSON.stringify(payload),
      onload: (r) => {
        let d = {}; try { d = JSON.parse(r.responseText); } catch (_) {}
        if (r.status >= 400) return notify("Error " + r.status + ":\n" + (d.error || r.statusText), "#B91C1C");
        const photos = typeof d.photoCount === "number" ? d.photoCount : payload.images.length;
        const pt = photos ? "\n📸 " + photos + " fotos" : "";
        if (d.created) notify("✅ Inmueble creado\n" + (price ? price.toLocaleString("es-ES") + " €" : "") + pt, "#15803D");
        else if (d.priceChanged) notify("💶 Precio actualizado" + pt, "#C49A4D");
        else if (d.mediaRefreshed) notify("🔄 Ficha refrescada" + pt, "#2C7A8A");
        else notify("👌 Ya existía, sin cambios", "#2C7A8A");
        console.log("[Nidokey] result:", d);
      },
      onerror: () => notify("Error de red.\n¿Está la app en localhost:4200?", "#B91C1C"),
    });
  }

  injectButton();
  new MutationObserver(injectButton).observe(document.body, { childList: true });
})();
