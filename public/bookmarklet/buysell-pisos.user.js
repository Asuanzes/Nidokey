// ==UserScript==
// @name         BuySell Asturias - Importador Pisos.com
// @namespace    https://buysell.local/
// @version      0.5.0
// @description  Importa anuncios de Pisos.com a BuySell.
// @match        https://www.pisos.com/*
// @match        https://pisos.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";
  const API = "http://localhost:4200/api/listings/import";
  const PORTAL = "PISOS_COM";

  if (!/\/comprar\/[^/]+\//.test(location.pathname)) return;

  function injectButton() {
    if (document.getElementById("__buysell_btn__")) return;
    const b = document.createElement("button");
    b.id = "__buysell_btn__";
    b.textContent = "📥 Importar a BuySell";
    b.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#3A5F8A;color:#FAFAF7;border:none;cursor:pointer;padding:12px 18px;border-radius:8px;font:14px system-ui,sans-serif;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.25);";
    b.onclick = run;
    document.body.appendChild(b);
  }
  function notify(msg, color) {
    document.getElementById("__buysell_toast__")?.remove();
    const el = document.createElement("div");
    el.id = "__buysell_toast__";
    el.textContent = msg;
    el.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483647;background:" + (color || "#3A5F8A") + ";color:#fff;padding:12px 16px;border-radius:8px;font:14px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:360px;white-space:pre-wrap;";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }
  const text = (s, r) => { const e = (r || document).querySelector(s); return e ? e.textContent.trim().replace(/\s+/g, " ") : null; };
  const intFrom = (s) => { if (s == null) return null; const m = String(s).replace(/[\.\s]/g, "").match(/-?\d+/); return m ? +m[0] : null; };
  const meta = (q) => document.querySelector(q)?.getAttribute("content") || null;
  function readJsonLd() {
    const out = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try { const d = JSON.parse(s.textContent); (Array.isArray(d) ? d : [d]).forEach((x) => out.push(x)); } catch (_) {}
    });
    return out;
  }

  function detectType() {
    const p = location.pathname.toLowerCase();
    if (/\/comprar\/atico/.test(p)) return "ATICO";
    if (/\/comprar\/chalet|\/comprar\/casa/.test(p)) return "CHALET";
    if (/\/comprar\/duplex/.test(p)) return "DUPLEX";
    if (/\/comprar\/estudio/.test(p)) return "ESTUDIO";
    if (/\/comprar\/loft/.test(p)) return "LOFT";
    if (/\/comprar\/local/.test(p)) return "LOCAL";
    if (/\/comprar\/terreno|\/comprar\/parcela/.test(p)) return "TERRENO";
    if (/\/comprar\/piso|\/comprar\/apartamento/.test(p)) return "PISO";
    return "PISO";
  }

  function isPhotoCdn(u) {
    return /imghs\.net|pisos\.com|adevinta|pcdn\.|fotos\./i.test(u);
  }
  function isJunk(u) {
    return /logo|sprite|icon|banner|partnerServices|partner-services|placeholder|avatar/i.test(u);
  }
  function readImages() {
    const all = new Set();
    document.querySelectorAll("img").forEach((img) => {
      const src = img.src || img.getAttribute("data-src") || img.getAttribute("data-lazy") || "";
      if (isPhotoCdn(src) && /\.(jpg|jpeg|png|webp)/i.test(src) && !isJunk(src)) {
        all.add(src.replace(/\?.*$/, ""));
      }
    });
    document.querySelectorAll('meta[property="og:image"]').forEach((m) => {
      const c = m.getAttribute("content");
      if (c && !isJunk(c)) all.add(c);
    });
    for (const d of readJsonLd()) {
      const i = d.image;
      if (Array.isArray(i)) i.forEach((u) => typeof u === "string" && !isJunk(u) && all.add(u));
      else if (typeof i === "string" && !isJunk(i)) all.add(i);
    }
    const re = /https?:(?:\\?\/){2}[a-z0-9.-]+\/[^"'\s<>\\)]+?\.(?:jpg|jpeg|png|webp)/gi;
    let m;
    while ((m = re.exec(document.documentElement.outerHTML)) !== null) {
      const u = m[0];
      if (isPhotoCdn(u) && !isJunk(u)) all.add(u);
    }
    // Agrupar por carpeta padre y quedarse con la mayor (filtra "relacionados")
    const photoUrls = Array.from(all);
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
      if (bestSize >= 3) candidates = byFolder.get(bestFolder);
    }

    const byFile = new Map();
    for (const u of candidates) {
      try {
        const p = new URL(u);
        const k = p.pathname.replace(/\.(jpe?g|png|webp|avif)$/i, "");
        const isJpg = /\.jpe?g$/i.test(p.pathname);
        if (!byFile.has(k) || (isJpg && !byFile.get(k).isJpg)) byFile.set(k, { url: u, isJpg });
      } catch (_) {}
    }
    return Array.from(byFile.values()).map((x) => x.url).slice(0, 80);
  }

  function readFeatures() {
    const out = {}; const all = [];
    document.querySelectorAll(".detail-features li, .features li, [class*='feature'] li, .characteristics li, dl dt, dl dd").forEach((li) => {
      const t = li.textContent.trim().replace(/\s+/g, " ");
      if (!t || t.length > 80) return;
      all.push(t);
      const low = t.toLowerCase();
      const n = intFrom(t);
      const isPricePerSqm = /€\s*\/\s*m|€\/m|€\s*por\s*m/i.test(t);
      if (!isPricePerSqm) {
        if (/m²|\bm2\b|metros/.test(low) && /constru/.test(low) && n) out.builtArea = n;
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
      const yb = low.match(/(?:construido en|año\s*(?:de\s*)?construcci[oó]n)\D*(\d{4})/);
      if (yb) { const y = +yb[1]; if (y > 1700 && y < new Date().getFullYear() + 2) out.yearBuilt = y; }
    });
    return { basics: out, all };
  }

  const SPANISH_PROVINCES = [
    "asturias","madrid","barcelona","valencia","sevilla","zaragoza","málaga","murcia","mallorca","bizkaia","vizcaya",
    "alicante","cádiz","córdoba","valladolid","vigo","gijón","oviedo","granada","santander","cantabria","navarra",
    "guipúzcoa","gipuzkoa","álava","araba","la rioja","huelva","huesca","jaén","león","lugo","ourense","palencia","pontevedra",
    "salamanca","segovia","soria","tarragona","teruel","toledo","zamora","badajoz","cáceres","ávila","burgos","ciudad real",
    "cuenca","guadalajara","castellón","lérida","lleida","girona","gerona","baleares","las palmas","tenerife","ceuta","melilla",
    "albacete","almería"
  ];

  const BAD_CRUMB_RX = /iniciar|sesi[oó]n|registrar|registro|inicio|home|consejos|encontrar|ayuda|contacto|publicar|favoritos|recomend|buscar|men[uú]|comprar|alquilar|alquiler|vender|vivienda|cookies/i;

  function readLocation() {
    const crumbs = Array.from(document.querySelectorAll(".breadcrumb a, [class*='Breadcrumb'] a"))
      .map((a) => a.textContent.trim())
      .filter((t) => t && t.length >= 3 && t.length < 40 && !BAD_CRUMB_RX.test(t));
    let province = null, city = null;
    if (crumbs.length) {
      // Buscar en breadcrumbs una provincia conocida
      for (const c of crumbs) {
        if (SPANISH_PROVINCES.includes(c.toLowerCase())) { province = c; break; }
      }
      // Última miga útil = ciudad
      city = crumbs[crumbs.length - 1] || null;
    }
    // URL: chalet-corvera_de_asturias_corvera-61725005307_100500
    const m = location.pathname.match(/\/[a-z]+-([a-z0-9_]+)-\d+/i);
    if (m) {
      const slug = m[1].toLowerCase();
      if (!city) {
        const parts = slug.split("_");
        city = parts[0].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }
      // Detectar provincia embebida en el slug (_asturias_, _madrid_, etc.)
      if (!province) {
        for (const p of SPANISH_PROVINCES) {
          if (slug.includes("_" + p.replace(/\s/g, "_") + "_")) { province = p.charAt(0).toUpperCase() + p.slice(1); break; }
        }
      }
    }
    if (!province) province = "Asturias"; // default sensato para este proyecto
    return { city, province };
  }

  function run() {
    const ld = readJsonLd();
    const prod = ld.find((d) => d && (d["@type"] === "Product" || d.offers || /Residence/i.test(d["@type"] || "")));
    const title = (prod && prod.name) || text("h1") || document.title;
    const description = (prod && prod.description) || meta('meta[name="description"]') || text(".description, [class*='Description']");
    const { basics, all: features } = readFeatures();
    // Precio: probar varias fuentes y validar mínimo 10k€
    function priceFromFeatures(fs) {
      for (const f of fs) {
        const m = f.replace(/\s/g, "").match(/(\d{1,3}(?:\.\d{3})+|\d{4,})\s*€/);
        if (m) {
          const n = parseInt(m[1].replace(/\./g, ""), 10);
          if (n >= 10000) return n;
        }
      }
      return null;
    }
    let price = priceFromFeatures(features);
    if (!price || price < 10000) {
      const n = intFrom(prod && prod.offers && (prod.offers.price || prod.offers.lowPrice));
      if (n && n >= 10000) price = n;
    }
    if (!price || price < 10000) {
      const n = intFrom(text("[class*='Price'], [class*='price'], .price, [itemprop='price']"));
      if (n && n >= 10000) price = n;
    }
    if (price && price < 10000) price = null;
    const images = readImages();
    const loc = readLocation();
    const ext = location.pathname.match(/-(\d+)_\d+\/?$/);
    const externalId = ext ? ext[1] : null;

    const payload = {
      url: location.href.split("#")[0].split("?")[0],
      portal: PORTAL, externalId,
      title: (title || "Anuncio Pisos.com").slice(0, 200),
      description: description || null,
      price: price || null,
      type: detectType(),
      city: loc.city, province: loc.province,
      rooms: basics.rooms ?? null, bathrooms: basics.bathrooms ?? null,
      builtArea: basics.builtArea ?? null, usableArea: basics.usableArea ?? null,
      floor: basics.floor ?? null, yearBuilt: basics.yearBuilt ?? null,
      hasElevator: basics.hasElevator ?? null, hasGarage: basics.hasGarage ?? null,
      hasStorage: basics.hasStorage ?? null, hasTerrace: basics.hasTerrace ?? null,
      hasFireplace: basics.hasFireplace ?? null, hasGarden: basics.hasGarden ?? null,
      hasPool: basics.hasPool ?? null,
      energyRating: "UNKNOWN", images, features,
    };
    notify("BuySell: enviando…", "#3A5F8A");
    console.log("[BuySell] payload:", payload);
    console.log("[BuySell] payload JSON:\n" + JSON.stringify(payload, null, 2));
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
        console.log("[BuySell] result:", d);
      },
      onerror: () => notify("Error de red.\n¿Está la app en localhost:4200?", "#B91C1C"),
    });
  }
  injectButton();
  new MutationObserver(injectButton).observe(document.body, { childList: true });
})();
