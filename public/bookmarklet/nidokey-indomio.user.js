// ==UserScript==
// @name         Nidokey - Importador Indomio
// @namespace    https://nidokey.es/
// @version      0.3.0
// @description  Importa anuncios de Indomio a Nidokey.
// @match        https://www.indomio.es/*
// @match        https://indomio.es/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";
  const API = "http://localhost:4200/api/listings/import";
  const PORTAL = "INDOMIO";

  if (!/\/anuncios\/\d+/.test(location.pathname)) return;

  function injectButton() {
    if (document.getElementById("__nidokey_btn__")) return;
    const b = document.createElement("button");
    b.id = "__nidokey_btn__"; b.textContent = "📥 Importar a Nidokey";
    b.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#3A5F8A;color:#FAFAF7;border:none;cursor:pointer;padding:12px 18px;border-radius:8px;font:14px system-ui,sans-serif;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.25);";
    b.onclick = run; document.body.appendChild(b);
  }
  function notify(msg, color) {
    document.getElementById("__nidokey_toast__")?.remove();
    const el = document.createElement("div"); el.id = "__nidokey_toast__"; el.textContent = msg;
    el.style.cssText = "position:fixed;top:20px;right:20px;z-index:2147483647;background:" + (color || "#3A5F8A") + ";color:#fff;padding:12px 16px;border-radius:8px;font:14px system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2);max-width:360px;white-space:pre-wrap;";
    document.body.appendChild(el); setTimeout(() => el.remove(), 6000);
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
  function readNext() {
    const s = document.getElementById("__NEXT_DATA__");
    if (!s) return null;
    try { return JSON.parse(s.textContent); } catch (_) { return null; }
  }
  function findPropertyNode(obj, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 8) return null;
    if (Array.isArray(obj)) {
      for (const x of obj) { const r = findPropertyNode(x, depth + 1); if (r) return r; }
      return null;
    }
    const k = Object.keys(obj);
    if ((("price" in obj || "priceValue" in obj) && ("rooms" in obj || "surface" in obj || "features" in obj))) return obj;
    for (const key of k) { const r = findPropertyNode(obj[key], depth + 1); if (r) return r; }
    return null;
  }

  function detectType() {
    const all = document.body.textContent.toLowerCase().slice(0, 5000);
    if (/áti?co/.test(all)) return "ATICO";
    if (/chalet|villa|casa independiente|adosado/.test(all)) return "CHALET";
    if (/d[úu]plex/.test(all)) return "DUPLEX";
    if (/estudio/.test(all)) return "ESTUDIO";
    if (/loft/.test(all)) return "LOFT";
    if (/piso|apartamento/.test(all)) return "PISO";
    return "PISO";
  }

  function readImages() {
    const all = new Set();
    document.querySelectorAll("img").forEach((img) => {
      const src = img.src || img.getAttribute("data-src") || "";
      if (/indomio|immobiliare|akamaized/i.test(src) && /\.(jpg|jpeg|png|webp)/i.test(src)) all.add(src.replace(/\?.*$/, ""));
    });
    document.querySelectorAll('meta[property="og:image"]').forEach((m) => { const c = m.getAttribute("content"); if (c) all.add(c); });
    for (const d of readJsonLd()) {
      const i = d.image;
      if (Array.isArray(i)) i.forEach((u) => typeof u === "string" && all.add(u));
      else if (typeof i === "string") all.add(i);
    }
    const re = /https?:(?:\\?\/){2}[a-z0-9.-]+\/[^"'\s<>\\)]+?\.(?:jpg|jpeg|png|webp)/gi;
    let m; while ((m = re.exec(document.documentElement.outerHTML)) !== null) {
      const u = m[0];
      if (/indomio|immobiliare|akamai/i.test(u)) all.add(u);
    }
    const JUNK_RX = /logo|sprite|icon|banner|placeholder|favicon|avatar/i;
    const photoUrls = Array.from(all).filter((u) => !JUNK_RX.test(u));
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

  const BAD_CRUMB_RX = /iniciar|sesi[oó]n|registrar|registro|inicio|home|consejos|encontrar|ayuda|contacto|publicar|favoritos|recomend|buscar|men[uú]|comprar|alquilar|alquiler|vender|vivienda|cookies/i;

  function readFeatures() {
    const out = {}; const all = [];
    document.querySelectorAll("[class*='feature'] li, [class*='Feature'] li, [class*='detail'] li, dl dt, dl dd, table tr").forEach((li) => {
      const t = li.textContent.trim().replace(/\s+/g, " ");
      if (!t || t.length > 80) return;
      all.push(t);
      const low = t.toLowerCase(); const n = intFrom(t);
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

  function readLocation(node) {
    let city = null, province = "Asturias", neighborhood = null;
    if (node && node.address) {
      city = node.address.locality || node.address.city || null;
      province = node.address.region || node.address.province || province;
      neighborhood = node.address.neighborhood || null;
    }
    if (!city) {
      const crumbs = Array.from(document.querySelectorAll(".breadcrumb a, [class*='readcrumb'] a, nav a"))
        .map((a) => a.textContent.trim())
        .filter((t) => t && t.length >= 3 && t.length < 40 && !BAD_CRUMB_RX.test(t));
      if (crumbs.length) city = crumbs[crumbs.length - 1];
    }
    return { city, province, neighborhood };
  }

  function run() {
    const nextData = readNext();
    const node = nextData ? findPropertyNode(nextData) : null;
    console.log("[Nidokey] __NEXT_DATA__:", !!nextData, "node:", !!node);

    const ld = readJsonLd();
    const prod = ld.find((d) => d && (d["@type"] === "Product" || d.offers || /Residence/i.test(d["@type"] || "")));

    const title = (node && (node.title || node.headline)) || (prod && prod.name) || text("h1") || document.title;
    const description = (node && node.description) || (prod && prod.description) || meta('meta[name="description"]');
    const { basics, all: features } = readFeatures();
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
      const n = intFrom(node && (node.price || node.priceValue));
      if (n && n >= 10000) price = n;
    }
    if (!price || price < 10000) {
      const n = intFrom(prod && prod.offers && (prod.offers.price || prod.offers.lowPrice));
      if (n && n >= 10000) price = n;
    }
    if (!price || price < 10000) {
      const n = intFrom(text("[class*='price'], .price, [itemprop='price']"));
      if (n && n >= 10000) price = n;
    }
    if (price && price < 10000) price = null;
    const images = readImages();
    const loc = readLocation(node);
    const ext = location.pathname.match(/\/anuncios\/(\d+)/);
    const externalId = ext ? ext[1] : null;

    const payload = {
      url: location.href.split("#")[0].split("?")[0],
      portal: PORTAL, externalId,
      title: (title || "Anuncio Indomio").slice(0, 200),
      description: description || null, price: price || null,
      type: detectType(),
      city: loc.city, province: loc.province, neighborhood: loc.neighborhood,
      rooms: basics.rooms ?? null, bathrooms: basics.bathrooms ?? null,
      builtArea: basics.builtArea ?? null, usableArea: basics.usableArea ?? null,
      floor: basics.floor ?? null, yearBuilt: basics.yearBuilt ?? null,
      hasElevator: basics.hasElevator ?? null, hasGarage: basics.hasGarage ?? null,
      hasStorage: basics.hasStorage ?? null, hasTerrace: basics.hasTerrace ?? null,
      hasFireplace: basics.hasFireplace ?? null, hasGarden: basics.hasGarden ?? null,
      hasPool: basics.hasPool ?? null,
      energyRating: "UNKNOWN", images, features,
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
