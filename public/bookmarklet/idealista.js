/* Nidokey - Importador Idealista
 * Se ejecuta en la pestaña abierta del anuncio. Lee el DOM y manda payload
 * normalizado a http://localhost:4200/api/listings/import.
 *
 * Para generar el bookmarklet final, este código se minifica/encoda en /bookmarklet.
 */
(function () {
  "use strict";

  const API = "http://localhost:4200/api/listings/import";

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

  function text(sel, root) {
    const el = (root || document).querySelector(sel);
    return el ? el.textContent.trim().replace(/\s+/g, " ") : null;
  }

  function intFrom(str) {
    if (!str) return null;
    const m = String(str).replace(/[\.\s]/g, "").match(/-?\d+/);
    return m ? parseInt(m[0], 10) : null;
  }

  function readJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent);
        const arr = Array.isArray(data) ? data : [data];
        for (const d of arr) {
          if (d && (d["@type"] === "Product" || d["@type"] === "Residence" || d["@type"] === "Place" || d.offers)) {
            return d;
          }
        }
      } catch (_) {}
    }
    return null;
  }

  // --- Tipo de inmueble desde título / breadcrumb ---
  function detectType(title) {
    const t = (title || "").toLowerCase();
    if (/\báti?co\b/.test(t)) return "ATICO";
    if (/\bchalet\b|\bunifamiliar\b/.test(t)) return "CHALET";
    if (/\bd[úu]plex\b/.test(t)) return "DUPLEX";
    if (/\bestudio\b/.test(t)) return "ESTUDIO";
    if (/\bloft\b/.test(t)) return "LOFT";
    if (/\bcasa\b/.test(t)) return "HOUSE";
    if (/\blocal\b/.test(t)) return "LOCAL";
    if (/\bterreno\b|\bparcela\b|\bsolar\b/.test(t)) return "TERRENO";
    if (/\bpiso\b|\bapartamento\b/.test(t)) return "PISO";
    return "PISO";
  }

  // --- Características (m², habitaciones, planta, etc.) ---
  function readBasicFeatures() {
    const out = {};
    const items = document.querySelectorAll(".info-features span, .details-property_features li, .details-property li");
    items.forEach((li) => {
      const txt = li.textContent.trim().toLowerCase();
      const n = intFrom(txt);
      if (/m²/.test(txt) && /constru/.test(txt) && n) out.builtArea = n;
      else if (/m²/.test(txt) && !out.builtArea && n) out.builtArea = n;
      if (/útil|util/.test(txt) && n) out.usableArea = n;
      if (/habitaci[oó]n|hab\.?\b|dormitorio/.test(txt) && n != null) out.rooms = n;
      if (/baño/.test(txt) && n != null) out.bathrooms = n;
      if (/planta/.test(txt)) out.floor = li.textContent.trim();
      if (/construido en|año/.test(txt) && n) out.yearBuilt = n;
      if (/ascensor/.test(txt)) out.hasElevator = !/sin ascensor/.test(txt);
      if (/garaje|plaza de garaje|parking/.test(txt)) out.hasGarage = true;
      if (/trastero/.test(txt)) out.hasStorage = true;
      if (/terraza|balcón/.test(txt)) out.hasTerrace = true;
      if (/chimenea/.test(txt)) out.hasFireplace = true;
      if (/jard[ií]n/.test(txt)) out.hasGarden = true;
      if (/piscina/.test(txt)) out.hasPool = true;
    });
    return out;
  }

  function readAllFeatures() {
    const feats = [];
    document.querySelectorAll(".details-property_features li, .details-property li, .info-features span").forEach((li) => {
      const t = li.textContent.trim().replace(/\s+/g, " ");
      if (t && t.length < 80) feats.push(t);
    });
    return Array.from(new Set(feats));
  }

  function readEnergy() {
    const all = document.body.textContent;
    const m = all.match(/Consumo:\s*([A-G])/i) || all.match(/Calificaci[oó]n energ[eé]tica[:\s]+([A-G])\b/i);
    return m ? m[1].toUpperCase() : "UNKNOWN";
  }

  function readImages() {
    const urls = new Set();
    // 1. Imágenes visibles
    document.querySelectorAll("img").forEach((img) => {
      const src = img.src || img.getAttribute("data-src") || "";
      if (/img\d?\.idealista\.com/i.test(src) && !/\/blank\.gif$/.test(src)) {
        // Quitar parámetros de tamaño para coger la versión grande
        urls.add(src.replace(/\/(\d+x\d+|thumbnail)\//, "/").replace(/\?.*$/, ""));
      }
    });
    // 2. og:image
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach((m) => {
      const c = m.getAttribute("content");
      if (c) urls.add(c);
    });
    // 3. JSON-LD
    const ld = readJsonLd();
    if (ld) {
      const imgs = ld.image;
      if (Array.isArray(imgs)) imgs.forEach((u) => urls.add(u));
      else if (typeof imgs === "string") urls.add(imgs);
    }
    return Array.from(urls).slice(0, 40);
  }

  function readLocation() {
    // Breadcrumb / ubicación en cabecera
    const headerLoc = text("#headerMap, .main-info__title-minor, .header-map-list");
    const breadcrumbs = Array.from(document.querySelectorAll(".breadcrumb-geo a, nav[aria-label*='breadcrumb'] a"))
      .map((a) => a.textContent.trim())
      .filter(Boolean);

    let address = headerLoc;
    let city = null;
    let province = "Asturias";

    if (breadcrumbs.length) {
      city = breadcrumbs[breadcrumbs.length - 1] || null;
      if (breadcrumbs.length >= 2) province = breadcrumbs[breadcrumbs.length - 2] || province;
    }
    // Heurística: si headerLoc tiene formato "Calle X, Barrio, Ciudad"
    if (!city && headerLoc) {
      const parts = headerLoc.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) city = parts[parts.length - 1];
    }
    return { address, city, province };
  }

  // ---------- Extracción ----------
  const url = location.href.split("#")[0];
  const ld = readJsonLd();

  const title =
    text("h1.main-info__title-main, .txt-bold.main-info__title-main") ||
    text("h1") ||
    document.title;

  const description =
    text(".comment .adCommentsLanguage, .comment p, [data-testid='ad-description']") ||
    text("meta[name=description]");

  const priceText = text(".info-data-price, .info-data .price, .pricedown__price, .price");
  const price = intFrom(priceText) || (ld && ld.offers && intFrom(ld.offers.price)) || null;

  const basics = readBasicFeatures();
  const features = readAllFeatures();
  const energy = readEnergy();
  const images = readImages();
  const loc = readLocation();

  const externalIdMatch = url.match(/\/inmueble\/(\d+)/);
  const externalId = externalIdMatch ? externalIdMatch[1] : null;

  const payload = {
    url,
    portal: "IDEALISTA",
    externalId,
    title: (title || "Anuncio Idealista").slice(0, 200),
    description: description || null,
    price,
    type: detectType(title),
    address: loc.address,
    city: loc.city,
    province: loc.province,
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
    features,
  };

  notify("Nidokey: extrayendo y enviando…\n" + (title || "").slice(0, 60), "#3A5F8A");
  console.log("[Nidokey] payload:", payload);

  fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    mode: "cors",
  })
    .then(async (r) => {
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        notify("Error " + r.status + ":\n" + (data.error || r.statusText), "#B91C1C");
        console.error("[Nidokey] error:", data);
        return;
      }
      if (data.created) {
        notify("✅ Inmueble creado\n" + (price ? price.toLocaleString("es-ES") + " €" : ""), "#15803D");
      } else if (data.priceChanged) {
        const prev = data.previousPrice ? (data.previousPrice / 100).toLocaleString("es-ES") : "?";
        const now = data.newPrice ? (data.newPrice / 100).toLocaleString("es-ES") : "?";
        notify("💶 Precio actualizado\n" + prev + " € → " + now + " €", "#C49A4D");
      } else {
        notify("👌 Ya existía, sin cambios", "#2C7A8A");
      }
      console.log("[Nidokey] result:", data);
    })
    .catch((err) => {
      notify("Error de red:\n" + err.message + "\n¿Está la app en localhost:4200?", "#B91C1C");
      console.error("[Nidokey] fetch error:", err);
    });
})();
