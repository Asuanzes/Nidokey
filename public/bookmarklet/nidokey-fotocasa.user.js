// ==UserScript==
// @name         Nidokey - Importador Fotocasa
// @namespace    https://nidokey.es/
// @version      0.3.0
// @description  Añade un botón "Importar a Nidokey" en cada anuncio de Fotocasa y envía la ficha a la app local.
// @match        https://www.fotocasa.es/*
// @match        https://fotocasa.es/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const API = "http://localhost:4200/api/listings/import";

  // Solo en páginas de detalle (URL acaba en /<numero>/<algo>)
  if (!/\/comprar\/[^/]+\/[^/]+\/[^/]+\/\d+\//.test(location.pathname)) return;

  // ---------- UI ----------
  function injectButton() {
    if (document.getElementById("__nidokey_btn__")) return;
    const btn = document.createElement("button");
    btn.id = "__nidokey_btn__";
    btn.type = "button";
    btn.textContent = "📥 Importar a Nidokey";
    btn.style.cssText =
      "position:fixed;bottom:24px;right:24px;z-index:2147483647;" +
      "background:#3A5F8A;color:#FAFAF7;border:none;cursor:pointer;" +
      "padding:12px 18px;border-radius:8px;font:14px system-ui,sans-serif;font-weight:500;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.25);transition:background .15s;";
    btn.addEventListener("mouseenter", () => (btn.style.background = "#2E4D70"));
    btn.addEventListener("mouseleave", () => (btn.style.background = "#3A5F8A"));
    btn.addEventListener("click", run);
    document.body.appendChild(btn);
  }

  function notify(msg, color) {
    const id = "__nidokey_toast__";
    document.getElementById(id)?.remove();
    const el = document.createElement("div");
    el.id = id;
    el.textContent = msg;
    el.style.cssText =
      "position:fixed;top:20px;right:20px;z-index:2147483647;" +
      "background:" + (color || "#3A5F8A") + ";color:#fff;" +
      "padding:12px 16px;border-radius:8px;font:14px system-ui,sans-serif;" +
      "box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:360px;white-space:pre-wrap;";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }

  // ---------- Helpers ----------
  function text(sel, root) {
    const el = (root || document).querySelector(sel);
    return el ? el.textContent.trim().replace(/\s+/g, " ") : null;
  }

  function intFrom(str) {
    if (str == null) return null;
    const m = String(str).replace(/[\.\s]/g, "").match(/-?\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  // Busca recursivamente en el JSON de __NEXT_DATA__ el primer objeto que
  // tenga la pinta de un "property detail" (con price + features + photos).
  function findPropertyNode(obj, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 8) return null;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const r = findPropertyNode(item, depth + 1);
        if (r) return r;
      }
      return null;
    }
    // Heurística: nodo que parece la propiedad principal
    const keys = Object.keys(obj);
    const looksLikeProperty =
      (("price" in obj || "transactionPrice" in obj) &&
        ("features" in obj || "rooms" in obj || "surface" in obj) &&
        ("multimedia" in obj || "photos" in obj || "images" in obj)) ||
      ("propertyData" in obj && typeof obj.propertyData === "object");
    if (looksLikeProperty) return obj.propertyData ?? obj;
    for (const k of keys) {
      const r = findPropertyNode(obj[k], depth + 1);
      if (r) return r;
    }
    return null;
  }

  function readNextData() {
    const s =
      document.getElementById("__NEXT_DATA__") ||
      document.querySelector('script[type="application/json"][id*="__"]');
    if (!s) return null;
    try {
      return JSON.parse(s.textContent);
    } catch (_) {
      return null;
    }
  }

  // ---------- Tipo desde URL ----------
  function detectTypeFromUrl() {
    const p = location.pathname.toLowerCase();
    if (/\/atico\//.test(p)) return "ATICO";
    if (/\/chalet\/|\/casa\//.test(p)) return "CHALET";
    if (/\/duplex\//.test(p)) return "DUPLEX";
    if (/\/estudio\//.test(p)) return "ESTUDIO";
    if (/\/loft\//.test(p)) return "LOFT";
    if (/\/piso\//.test(p)) return "PISO";
    if (/\/local\//.test(p)) return "LOCAL";
    if (/\/terreno\/|\/parcela\/|\/solar\//.test(p)) return "TERRENO";
    return "PISO";
  }

  // ---------- Imágenes ----------
  function normalizePhotoUrl(u) {
    return u.replace(/\\u002F/g, "/").replace(/\\\//g, "/").replace(/&amp;/g, "&");
  }

  function readImagesFromNode(node) {
    const out = new Set();
    if (!node) return out;
    const arrays = [];
    if (Array.isArray(node.multimedia)) arrays.push(node.multimedia);
    if (Array.isArray(node.photos)) arrays.push(node.photos);
    if (Array.isArray(node.images)) arrays.push(node.images);
    if (node.multimedia && Array.isArray(node.multimedia.images)) arrays.push(node.multimedia.images);
    for (const arr of arrays) {
      for (const it of arr) {
        if (!it) continue;
        if (typeof it === "string") {
          out.add(normalizePhotoUrl(it));
        } else if (typeof it === "object") {
          const url = it.url || it.src || it.large || it.original || it.path || it.fullsize;
          if (typeof url === "string") out.add(normalizePhotoUrl(url));
        }
      }
    }
    return out;
  }

  function readAllImages(nextData, propNode) {
    const all = new Set();

    // 1. Desde el árbol propiedad del JSON
    for (const u of readImagesFromNode(propNode)) all.add(u);

    // 2. Regex sobre todo el HTML buscando CDN de Fotocasa
    const html = document.documentElement.outerHTML;
    const re = /https?:(?:\\?\/){2}[a-z0-9.-]*?(?:static|img|api)[a-z0-9.-]*?\.fotocasa\.[a-z]+\/[^"'\s<>\\)]+?\.(?:jpg|jpeg|png|webp)/gi;
    let m;
    while ((m = re.exec(html)) !== null) all.add(normalizePhotoUrl(m[0]));

    // 3. Imágenes <img> de la galería ya cargadas
    document.querySelectorAll("img").forEach((img) => {
      const src = img.src || img.getAttribute("data-src") || "";
      if (/fotocasa\./i.test(src) && /\.(jpg|jpeg|png|webp)/i.test(src)) {
        all.add(normalizePhotoUrl(src));
      }
    });

    // 4. og:image
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach((meta) => {
      const c = meta.getAttribute("content");
      if (c && /fotocasa/i.test(c)) all.add(normalizePhotoUrl(c));
    });

    // Filtrar junk (logos, iconos, banners, sprites)
    const JUNK_RX = /logo|sprite|icon|banner|placeholder|favicon|avatar|partnerServices|partner-services/i;
    const photoUrls = Array.from(all).filter((u) => !JUNK_RX.test(u));

    // Agrupar por penúltimo segmento del path (carpeta padre del archivo).
    // Los anuncios relacionados estarán en carpetas distintas con pocas fotos.
    const byFolder = new Map();
    for (const u of photoUrls) {
      try {
        const p = new URL(u);
        const parts = p.pathname.split("/").filter(Boolean);
        const folder = parts.length >= 2 ? parts.slice(0, -1).join("/") : p.pathname;
        if (!byFolder.has(folder)) byFolder.set(folder, []);
        byFolder.get(folder).push(u);
      } catch (_) {}
    }
    let candidates = photoUrls;
    if (byFolder.size > 1) {
      let bestFolder = null, bestSize = 0;
      for (const [folder, list] of byFolder) {
        if (list.length > bestSize) { bestSize = list.length; bestFolder = folder; }
      }
      // Solo aplicar el filtro de carpeta si la "mejor" carpeta tiene una
      // mayoría clara; si no, dejamos todas (algunas listings tienen URLs sueltas).
      if (bestSize >= 3) candidates = byFolder.get(bestFolder);
    }

    // Dedupe por nombre sin extensión (a veces jpg/webp duplicados)
    const byFile = new Map();
    for (const u of candidates) {
      try {
        const parsed = new URL(u);
        const key = parsed.pathname.replace(/\.(jpe?g|png|webp|avif)$/i, "");
        const isJpg = /\.jpe?g$/i.test(parsed.pathname);
        const prev = byFile.get(key);
        if (!prev || (isJpg && !prev.isJpg)) byFile.set(key, { url: u, isJpg });
      } catch (_) {
        if (!byFile.has(u)) byFile.set(u, { url: u, isJpg: false });
      }
    }
    return Array.from(byFile.values()).map((x) => x.url).slice(0, 80);
  }

  // ---------- Features ----------
  function parseFeaturesFromNode(node) {
    const out = {};
    if (!node) return out;

    // Campos directos en JSON
    if (node.rooms != null) out.rooms = intFrom(node.rooms);
    if (node.bathrooms != null) out.bathrooms = intFrom(node.bathrooms);
    if (node.surface != null) out.builtArea = intFrom(node.surface);
    if (node.builtSurface != null) out.builtArea = intFrom(node.builtSurface);
    if (node.usefulSurface != null) out.usableArea = intFrom(node.usefulSurface);
    if (node.floor != null) out.floor = String(node.floor);
    if (node.constructionYear != null) {
      const y = intFrom(node.constructionYear);
      if (y && y > 1700 && y < new Date().getFullYear() + 2) out.yearBuilt = y;
    }
    if (node.energyCertificate && node.energyCertificate.consumption) {
      const e = String(node.energyCertificate.consumption.value || node.energyCertificate.consumption.type || "").trim().toUpperCase();
      if (/^[A-G]$/.test(e)) out.energyRating = e;
    }

    // features = array de objetos {type/name/value}
    if (Array.isArray(node.features)) {
      for (const f of node.features) {
        const key = String(f.type || f.name || f.key || "").toLowerCase();
        const val = f.value;
        if (/lift|ascensor/.test(key)) out.hasElevator = !!val;
        else if (/garage|parking|garaje/.test(key)) out.hasGarage = !!val;
        else if (/storage|trastero/.test(key)) out.hasStorage = !!val;
        else if (/terrace|terraza|balcony|balcon/.test(key)) out.hasTerrace = !!val;
        else if (/fireplace|chimenea/.test(key)) out.hasFireplace = !!val;
        else if (/garden|jardin/.test(key)) out.hasGarden = !!val;
        else if (/pool|piscina/.test(key)) out.hasPool = !!val;
      }
    }

    return out;
  }

  function parseFeaturesFromDom() {
    const out = {};
    const items = document.querySelectorAll(
      ".re-DetailFeaturesList-feature, .re-DetailHeader-features li, [class*='Features'] li, [class*='features'] li"
    );
    const seen = [];
    items.forEach((li) => {
      const t = li.textContent.trim().replace(/\s+/g, " ");
      if (!t || t.length > 80) return;
      seen.push(t);
      const low = t.toLowerCase();
      const n = intFrom(t);
      const isPricePerSqm = /€\s*\/\s*m|€\/m|€\s*por\s*m/i.test(t);
      if (!isPricePerSqm) {
        if (/m²|\bm2\b|metros/.test(low) && /constru|edificad/.test(low) && n) out.builtArea = n;
        else if (/m²|\bm2\b|metros/.test(low) && !out.builtArea && n && n >= 5 && n <= 5000) out.builtArea = n;
        if (/útil|util/.test(low) && /m²|\bm2\b|metros/.test(low) && n && n >= 5 && n <= 5000) out.usableArea = n;
      }
      if (/habitaci[oó]n|dormit|\bhabs?\.?\b/.test(low) && n != null) out.rooms = n;
      if (/baño|aseo|\bbaños?\b/.test(low) && n != null) out.bathrooms = n;
      if (/planta\b/.test(low)) out.floor = t;
      if (/ascensor/.test(low)) out.hasElevator = !/sin ascensor/i.test(low);
      if (/garaje|parking|plaza/.test(low)) out.hasGarage = true;
      if (/trastero/.test(low)) out.hasStorage = true;
      if (/terraza|balc[oó]n/.test(low)) out.hasTerrace = true;
      if (/chimenea/.test(low)) out.hasFireplace = true;
      if (/jard[ií]n/.test(low)) out.hasGarden = true;
      if (/piscina/.test(low)) out.hasPool = true;
      const ybM = low.match(/(?:construido en|año\s*(?:de\s*)?construcci[oó]n)\D*(\d{4})/);
      if (ybM) {
        const y = parseInt(ybM[1], 10);
        if (y > 1700 && y < new Date().getFullYear() + 2) out.yearBuilt = y;
      }
    });
    return { features: out, all: seen };
  }

  function readEnergyFromDom() {
    const all = document.body.textContent;
    const m =
      all.match(/Consumo:\s*([A-G])/i) ||
      all.match(/Calificaci[oó]n energ[eé]tica[:\s]+([A-G])\b/i) ||
      all.match(/Eficiencia energ[eé]tica[:\s]+([A-G])\b/i);
    return m ? m[1].toUpperCase() : "UNKNOWN";
  }

  const BAD_CRUMB_RX = /iniciar|sesi[oó]n|registrar|registro|inicio|home|consejos|encontrar|ayuda|contacto|publicar|favoritos|recomend|buscar|men[uú]|comprar|alquilar|alquiler|vender|vivienda|cookies/i;

  // ---------- Ubicación ----------
  function readLocation(propNode) {
    let address = null,
      city = null,
      province = "Asturias",
      neighborhood = null,
      latitude = null,
      longitude = null,
      postalCode = null;

    if (propNode) {
      const a = propNode.address || propNode.location || {};
      if (a.fullAddress) address = a.fullAddress;
      else if (a.street) address = a.street;
      city = a.locationName || a.cityName || a.town || a.municipality || a.city || null;
      province = a.provinceName || a.province || province;
      neighborhood = a.neighborhoodName || a.neighborhood || a.zone || null;
      postalCode = a.postalCode || a.zipCode || null;
      const c = propNode.coordinates || a.coordinates || {};
      if (c.latitude) latitude = parseFloat(c.latitude);
      if (c.longitude) longitude = parseFloat(c.longitude);
    }

    // Fallback DOM: breadcrumbs (con filtro de basura)
    if (!city) {
      const breadcrumbs = Array.from(document.querySelectorAll("nav a, .re-Breadcrumb-link, [class*='readcrumb'] a"))
        .map((a) => a.textContent.trim())
        .filter((t) => t && t.length >= 3 && t.length < 40 && !BAD_CRUMB_RX.test(t));
      if (breadcrumbs.length) city = breadcrumbs[breadcrumbs.length - 1];
    }
    // Fallback URL: /mieres-(asturias)/
    if (!city) {
      const mm = location.pathname.match(/\/([a-z0-9-]+)-\(([^)]+)\)/i);
      if (mm) {
        city = mm[1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        province = mm[2].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }
    return { address, city, province, neighborhood, latitude, longitude, postalCode };
  }

  // ---------- Run ----------
  function run() {
    const nextData = readNextData();
    const propNode = nextData ? findPropertyNode(nextData) : null;

    console.log("[Nidokey] __NEXT_DATA__ encontrado:", !!nextData, "propNode:", !!propNode);

    const titleFromNode = propNode && (propNode.title || propNode.headline);
    const title =
      titleFromNode ||
      text("h1, .re-DetailHeader-propertyTitle, [class*='DetailTitle']") ||
      document.title;

    const description =
      (propNode && (propNode.description || propNode.text)) ||
      text(".fc-DetailDescription, [class*='Description']") ||
      text('meta[name="description"]');

    let price =
      propNode && intFrom(propNode.price ?? propNode.transactionPrice ?? propNode.priceValue);
    if (!price || price < 10000) {
      const n = intFrom(text("[class*='Price'], .re-DetailHeader-price, [data-test='price']"));
      if (n && n >= 10000) price = n;
    }
    // Sanity check
    if (price && price < 10000) price = null;

    const featuresFromNode = parseFeaturesFromNode(propNode);
    const featuresFromDom = parseFeaturesFromDom();
    const basics = { ...featuresFromDom.features, ...featuresFromNode }; // node wins

    const energy = basics.energyRating || readEnergyFromDom();
    const images = readAllImages(nextData, propNode);
    const loc = readLocation(propNode);

    const externalIdMatch = location.pathname.match(/\/(\d+)\/[^/]*\/?$/);
    const externalId = externalIdMatch ? externalIdMatch[1] : null;

    const payload = {
      url: location.href.split("#")[0].split("?")[0],
      portal: "FOTOCASA",
      externalId,
      title: (title || "Anuncio Fotocasa").slice(0, 200),
      description: description || null,
      price: price || null,
      type: detectTypeFromUrl(),
      address: loc.address,
      city: loc.city,
      province: loc.province,
      postalCode: loc.postalCode,
      neighborhood: loc.neighborhood,
      latitude: loc.latitude,
      longitude: loc.longitude,
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
      energyRating: energy,
      images,
      features: featuresFromDom.all,
    };

    notify("Nidokey: enviando…\n" + (title || "").slice(0, 60), "#3A5F8A");
    console.log("[Nidokey] payload:", payload);
    console.log("[Nidokey] payload JSON:\n" + JSON.stringify(payload, null, 2));

    GM_xmlhttpRequest({
      method: "POST",
      url: API,
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify(payload),
      onload: function (resp) {
        let data = {};
        try { data = JSON.parse(resp.responseText); } catch (_) {}
        if (resp.status >= 400) {
          notify("Error " + resp.status + ":\n" + (data.error || resp.statusText), "#B91C1C");
          console.error("[Nidokey] error:", data);
          return;
        }
        const photos = typeof data.photoCount === "number" ? data.photoCount : payload.images.length;
        const photoTxt = photos ? "\n📸 " + photos + " fotos" : "";
        if (data.created) {
          notify("✅ Inmueble creado\n" + (price ? price.toLocaleString("es-ES") + " €" : "") + photoTxt, "#15803D");
        } else if (data.priceChanged) {
          const prev = data.previousPrice ? (data.previousPrice / 100).toLocaleString("es-ES") : "?";
          const now = data.newPrice ? (data.newPrice / 100).toLocaleString("es-ES") : "?";
          notify("💶 Precio actualizado\n" + prev + " € → " + now + " €" + photoTxt, "#C49A4D");
        } else if (data.mediaRefreshed) {
          notify("🔄 Ficha refrescada" + photoTxt, "#2C7A8A");
        } else {
          notify("👌 Ya existía, sin cambios", "#2C7A8A");
        }
        console.log("[Nidokey] result:", data);
      },
      onerror: function (err) {
        notify("Error de red.\n¿Está la app en localhost:4200?", "#B91C1C");
        console.error("[Nidokey] fetch error:", err);
      },
    });
  }

  injectButton();
  new MutationObserver(injectButton).observe(document.body, { childList: true, subtree: false });
})();
