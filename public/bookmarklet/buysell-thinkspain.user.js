// ==UserScript==
// @name         BuySell Asturias - Importador ThinkSPAIN
// @namespace    https://buysell.local/
// @version      0.3.0
// @description  Importa anuncios de ThinkSPAIN a BuySell.
// @match        https://www.thinkspain.com/*
// @match        https://thinkspain.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";
  const API = "http://localhost:4200/api/listings/import";
  const PORTAL = "THINKSPAIN";

  const isDetailUrl = () => /\/venta-viviendas\/\d+/.test(location.pathname);
  const isDetailOpen = () =>
    isDetailUrl() ||
    !!document.querySelector("[class*='modal'][class*='open'], [class*='Modal'][class*='open'], [role='dialog'][aria-hidden='false']");

  function injectButton() {
    if (!isDetailOpen()) {
      document.getElementById("__buysell_btn__")?.remove();
      return;
    }
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
  const intFrom = (s) => { if (s == null) return null; const m = String(s).replace(/[\.\s,]/g, "").match(/-?\d+/); return m ? +m[0] : null; };
  const meta = (q) => document.querySelector(q)?.getAttribute("content") || null;
  function readJsonLd() {
    const out = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try { const d = JSON.parse(s.textContent); (Array.isArray(d) ? d : [d]).forEach((x) => out.push(x)); } catch (_) {}
    });
    return out;
  }

  function detectType() {
    const all = document.body.textContent.toLowerCase().slice(0, 5000);
    if (/\báti?co\b/.test(all)) return "ATICO";
    if (/\bchalet|\bvilla\b|\bhouse\b|\bcasa\b/.test(all)) return "CHALET";
    if (/\bd[úu]plex/.test(all)) return "DUPLEX";
    if (/\bestudio|\bstudio/.test(all)) return "ESTUDIO";
    if (/\bpiso\b|\bapartament|\bflat\b/.test(all)) return "PISO";
    return "PISO";
  }

  function readImages() {
    const all = new Set();
    document.querySelectorAll("img").forEach((img) => {
      const src = img.src || img.getAttribute("data-src") || "";
      if (/thinkspain/i.test(src) && /\.(jpg|jpeg|png|webp)/i.test(src)) all.add(src.replace(/\?.*$/, ""));
    });
    document.querySelectorAll('meta[property="og:image"]').forEach((m) => { const c = m.getAttribute("content"); if (c) all.add(c); });
    for (const d of readJsonLd()) {
      const i = d.image;
      if (Array.isArray(i)) i.forEach((u) => typeof u === "string" && all.add(u));
      else if (typeof i === "string") all.add(i);
    }
    const re = /https?:(?:\\?\/){2}[a-z0-9.-]*?thinkspain[a-z0-9.-]*?\/[^"'\s<>\\)]+?\.(?:jpg|jpeg|png|webp)/gi;
    let m; while ((m = re.exec(document.documentElement.outerHTML)) !== null) all.add(m[0]);
    // Filtrar junk + agrupar por carpeta padre
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

  const BAD_CRUMB_RX = /iniciar|sesi[oó]n|registrar|registro|inicio|home|consejos|encontrar|ayuda|contacto|publicar|favoritos|recomend|buscar|men[uú]|comprar|alquilar|alquiler|vender|vivienda|cookies|login/i;

  function readFeatures() {
    const out = {}; const all = [];
    document.querySelectorAll("[class*='feature'] li, [class*='Feature'] li, .characteristics li, .details li, dl dt, dl dd, table tr").forEach((li) => {
      const t = li.textContent.trim().replace(/\s+/g, " ");
      if (!t || t.length > 80) return;
      all.push(t);
      const low = t.toLowerCase(); const n = intFrom(t);
      if (/(m²|metros|sqm|m2)/.test(low) && /constru|edificad|built/.test(low) && n) out.builtArea = n;
      else if (/(m²|metros|sqm|m2)/.test(low) && !out.builtArea && n) out.builtArea = n;
      if (/(bed|habitaci|dormit|rooms)/.test(low) && n != null && !out.rooms) out.rooms = n;
      if (/(bath|baño|aseo)/.test(low) && n != null && !out.bathrooms) out.bathrooms = n;
      if (/lift|ascensor/.test(low)) out.hasElevator = !/no lift|sin ascensor/i.test(low);
      if (/garage|garaje|parking/.test(low)) out.hasGarage = true;
      if (/storage|trastero/.test(low)) out.hasStorage = true;
      if (/terrace|terraza|balcony|balcón/.test(low)) out.hasTerrace = true;
      if (/fireplace|chimenea/.test(low)) out.hasFireplace = true;
      if (/garden|jardín/.test(low)) out.hasGarden = true;
      if (/pool|piscina/.test(low)) out.hasPool = true;
      const yb = low.match(/(?:built|construido en|año\s*construcci[oó]n)\D*(\d{4})/);
      if (yb) { const y = +yb[1]; if (y > 1700 && y < new Date().getFullYear() + 2) out.yearBuilt = y; }
    });
    return { basics: out, all };
  }

  function readLocation() {
    const crumbs = Array.from(document.querySelectorAll(".breadcrumb a, [class*='Breadcrumb'] a"))
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
        const m = f.replace(/\s/g, "").match(/(\d{1,3}(?:[.,]\d{3})+|\d{5,})\s*€?/);
        if (m) {
          const n = parseInt(m[1].replace(/[.,]/g, ""), 10);
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
      const n = intFrom(text("[class*='price'], .price, [itemprop='price']"));
      if (n && n >= 10000) price = n;
    }
    if (price && price < 10000) price = null;
    const images = readImages();
    const loc = readLocation();
    const ext = location.pathname.match(/\/(\d+)\/?$/);
    const externalId = ext ? ext[1] : null;
    const payload = {
      url: location.href.split("#")[0].split("?")[0],
      portal: PORTAL, externalId,
      title: (title || "Anuncio ThinkSPAIN").slice(0, 200),
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
  // Inicial + reaccionar a cambios de DOM y de URL (SPA con History API)
  injectButton();
  new MutationObserver(injectButton).observe(document.body, { childList: true, subtree: true });

  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      injectButton();
    }
  }, 500);

  // Parchea pushState/replaceState para detectar navegaciones SPA al instante
  const _ps = history.pushState;
  history.pushState = function () {
    _ps.apply(this, arguments);
    setTimeout(injectButton, 50);
  };
  const _rs = history.replaceState;
  history.replaceState = function () {
    _rs.apply(this, arguments);
    setTimeout(injectButton, 50);
  };
  window.addEventListener("popstate", () => setTimeout(injectButton, 50));
})();
