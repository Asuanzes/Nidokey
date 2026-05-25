// ==UserScript==
// @name         BuySell Asturias - Importador Yaencontre
// @namespace    https://buysell.local/
// @version      0.6.0
// @description  Importa anuncios de Yaencontre a BuySell.
// @match        https://www.yaencontre.com/*
// @match        https://yaencontre.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";
  const API = "http://localhost:4200/api/listings/import";
  const PORTAL = "YAENCONTRE";

  if (!/\/inmueble-\d+/.test(location.pathname)) return;

  function injectButton() {
    if (document.getElementById("__buysell_btn__")) return;
    const b = document.createElement("button");
    b.id = "__buysell_btn__"; b.textContent = "📥 Importar a BuySell";
    b.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:2147483647;background:#3A5F8A;color:#FAFAF7;border:none;cursor:pointer;padding:12px 18px;border-radius:8px;font:14px system-ui,sans-serif;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.25);";
    b.onclick = run; document.body.appendChild(b);
  }
  function notify(msg, color) {
    document.getElementById("__buysell_toast__")?.remove();
    const el = document.createElement("div"); el.id = "__buysell_toast__"; el.textContent = msg;
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

  // Recorre todo el JSON buscando URLs de imágenes (jpg/webp/png en CDN).
  function collectImageUrlsFromJson(obj, out, depth) {
    if (depth > 10 || !obj) return;
    if (typeof obj === "string") {
      if (/^https?:\/\/[^\s"']+\.(jpe?g|png|webp|avif)/i.test(obj)) out.add(obj);
      return;
    }
    if (typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const x of obj) collectImageUrlsFromJson(x, out, depth + 1);
      return;
    }
    for (const k of Object.keys(obj)) {
      collectImageUrlsFromJson(obj[k], out, depth + 1);
    }
  }

  // Yaencontre sirve fotos en distintos tamaños: 360x270, 480x360, 800x600...
  // El path tiene la dimensión. Forzamos la mayor disponible.
  function upscaleYaencontreUrl(u) {
    return u
      .replace(/\/\d+x\d+\//, "/1024x768/")
      .replace(/[_-](small|thumb|thumbnail|s|m|sm|md)\./i, "_l.")
      .replace(/\?.*$/, "");
  }
  function detectType() {
    const p = location.pathname.toLowerCase();
    if (/\/atico/.test(p)) return "ATICO";
    if (/\/chalet|\/casa/.test(p)) return "CHALET";
    if (/\/duplex/.test(p)) return "DUPLEX";
    if (/\/estudio/.test(p)) return "ESTUDIO";
    if (/\/loft/.test(p)) return "LOFT";
    if (/\/local/.test(p)) return "LOCAL";
    if (/\/terreno|\/parcela/.test(p)) return "TERRENO";
    if (/\/piso|\/apartamento/.test(p)) return "PISO";
    return "PISO";
  }
  function readImages() {
    const raw = new Set();

    // 1. <img> visibles
    document.querySelectorAll("img").forEach((img) => {
      const src = img.src || img.getAttribute("data-src") || img.getAttribute("data-lazy") || "";
      if (/\.(jpg|jpeg|png|webp)/i.test(src)) raw.add(src);
    });

    // 2. og:image / twitter:image
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach((m) => {
      const c = m.getAttribute("content");
      if (c) raw.add(c);
    });

    // 3. JSON-LD
    for (const d of readJsonLd()) {
      const i = d.image;
      if (Array.isArray(i)) i.forEach((u) => typeof u === "string" && raw.add(u));
      else if (typeof i === "string") raw.add(i);
    }

    // 4. __NEXT_DATA__ recursivo (aquí está la galería completa pre-renderizada)
    const nx = readNext();
    if (nx) collectImageUrlsFromJson(nx, raw, 0);

    // 5. Regex sobre todo el HTML (scripts inline)
    const reYae = /https?:(?:\\?\/){2}[a-z0-9.-]*?(?:yaencontre|cdn-yae|cloudinary|imghs)[a-z0-9.-]*?\/[^"'\s<>\\)]+?\.(?:jpg|jpeg|png|webp)/gi;
    let m;
    while ((m = reYae.exec(document.documentElement.outerHTML)) !== null) raw.add(m[0]);

    // Filtrar: solo dominios CDN de Yaencontre/aliados, descartar logos/banners
    const isYaePhoto = (u) =>
      /(yaencontre|cdn-yae|cloudinary|imghs|adevinta)/i.test(u) &&
      !/logo|sprite|icon|placeholder|banner|favicon|partnerServices/i.test(u);

    // Normalizar a tamaño grande
    const normalized = new Set();
    for (const u of raw) {
      if (!isYaePhoto(u)) continue;
      normalized.add(upscaleYaencontreUrl(u));
    }

    // Dedup por nombre de archivo (sin ext, sin tamaño)
    const byFile = new Map();
    for (const u of normalized) {
      try {
        const p = new URL(u);
        // Quitar la parte de tamaño "/360x270/" del key para que jpg/webp del
        // mismo recurso colapsen aunque vinieran de tamaños distintos.
        const key = p.pathname
          .replace(/\/\d+x\d+\//, "/")
          .replace(/\.(jpe?g|png|webp|avif)$/i, "")
          .replace(/[_-](small|thumb|thumbnail|s|m|sm|md|l|lg|xl)$/i, "");
        const isJpg = /\.jpe?g$/i.test(p.pathname);
        const has1024 = /\/1024x|_(l|lg|xl|large)\./i.test(u);
        const prev = byFile.get(key);
        const score = (isJpg ? 1 : 0) + (has1024 ? 2 : 0);
        if (!prev || score > prev.score) byFile.set(key, { url: u, score });
      } catch (_) {}
    }
    const final = Array.from(byFile.values()).map((x) => x.url).slice(0, 80);
    // DEBUG: imprime las 3 primeras raw vs final para diagnóstico
    console.log("[BuySell yae] raw image URLs (muestra 5):", Array.from(raw).slice(0, 5));
    console.log("[BuySell yae] final URLs (muestra 5):", final.slice(0, 5));
    return final;
  }
  function readFeatures() {
    const out = {}; const all = [];
    document.querySelectorAll("[class*='feature'] li, [class*='Feature'] li, .characteristics li, dl dt, dl dd, .property-features li").forEach((li) => {
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
  const BAD_CRUMB_RX = /iniciar|sesi[oó]n|registrar|registro|inicio|home|consejos|encontrar|ayuda|contacto|publicar|favoritos|recomend|buscar|men[uú]|comprar|alquilar|alquiler|vender|vivienda|cookies/i;

  function readLocation() {
    const crumbs = Array.from(document.querySelectorAll(".breadcrumb a, [class*='Breadcrumb'] a, nav a"))
      .map((a) => a.textContent.trim())
      .filter((t) => t && t.length >= 3 && t.length < 40 && !BAD_CRUMB_RX.test(t));
    let province = "Asturias", city = null;
    if (crumbs.length) {
      city = crumbs[crumbs.length - 1] || null;
      if (crumbs.length >= 2) province = crumbs[crumbs.length - 2] || province;
    }
    return { city, province };
  }
  function run() {
    const ld = readJsonLd();
    const prod = ld.find((d) => d && (d["@type"] === "Product" || d.offers || /Residence/i.test(d["@type"] || "")));
    const title = (prod && prod.name) || text("h1") || document.title;
    const description = (prod && prod.description) || meta('meta[name="description"]');
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
    const ext = location.pathname.match(/-(\d+)$/);
    const externalId = ext ? ext[1] : null;
    const payload = {
      url: location.href.split("#")[0].split("?")[0],
      portal: PORTAL, externalId,
      title: (title || "Anuncio Yaencontre").slice(0, 200),
      description: description || null, price: price || null,
      type: detectType(), city: loc.city, province: loc.province,
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
        if (r.status >= 400) {
          console.error("[BuySell] full server response:", d);
          const detail = [d.error, d.code, d.name].filter(Boolean).join(" · ");
          return notify("Error " + r.status + ":\n" + (detail || r.statusText), "#B91C1C");
        }
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
