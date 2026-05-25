// ==UserScript==
// @name         BuySell Asturias - Importador Idealista
// @namespace    https://buysell.local/
// @version      0.8.0
// @description  Añade un botón "Importar a BuySell" en cada anuncio de Idealista y envía la ficha a la app local.
// @match        https://www.idealista.com/inmueble/*
// @match        https://www.idealista.es/inmueble/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const API = "http://localhost:4200/api/listings/import";

  // ---------- UI: botón flotante ----------
  function injectButton() {
    if (document.getElementById("__buysell_btn__")) return;
    const btn = document.createElement("button");
    btn.id = "__buysell_btn__";
    btn.type = "button";
    btn.textContent = "📥 Importar a BuySell";
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
    const id = "__buysell_toast__";
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

  // ---------- Helpers de extracción ----------
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

  function readBasicFeatures() {
    const out = {};
    const items = document.querySelectorAll(
      ".info-features span, .details-property_features li, .details-property li"
    );
    items.forEach((li) => {
      const txt = li.textContent.trim().toLowerCase();
      const n = intFrom(txt);
      if (/m²|\bm2\b/.test(txt) && /constru/.test(txt) && n) out.builtArea = n;
      else if (/m²|\bm2\b/.test(txt) && !out.builtArea && n) out.builtArea = n;
      if (/útil|util/.test(txt) && n) out.usableArea = n;
      if (/habitaci[oó]n|hab\.?\b|dormitorio/.test(txt) && n != null) out.rooms = n;
      if (/baño/.test(txt) && n != null) out.bathrooms = n;
      if (/planta/.test(txt)) out.floor = li.textContent.trim();
      // Año de construcción: SOLO "construido en YYYY" y validar rango plausible
      const ybMatch = txt.match(/construido en\s+(\d{4})/i);
      if (ybMatch) {
        const y = parseInt(ybMatch[1], 10);
        if (y >= 1700 && y <= new Date().getFullYear() + 2) out.yearBuilt = y;
      }
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
    document
      .querySelectorAll(".details-property_features li, .details-property li, .info-features span")
      .forEach((li) => {
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

  function normalizePhotoUrl(u) {
    // Limpia escapes JSON/HTML y deja la URL tal cual la entrega Idealista.
    // No tocamos /blur/ ni el segmento de tamaño: el CDN solo sirve la imagen
    // si la URL coincide exactamente con la que ha firmado.
    return u
      .replace(/\\u002F/g, "/")
      .replace(/\\\//g, "/")
      .replace(/&amp;/g, "&");
  }

  function readImages() {
    const all = new Set();

    // 1. <img> visibles
    document.querySelectorAll("img").forEach((img) => {
      const src = img.src || img.getAttribute("data-src") || img.getAttribute("data-service") || "";
      if (/img\d?\.idealista\.com/i.test(src) && !/\/blank\.gif$/.test(src)) {
        all.add(normalizePhotoUrl(src));
      }
    });

    // 2. og:image / twitter:image
    document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach((m) => {
      const c = m.getAttribute("content");
      if (c && /idealista\.com/i.test(c)) all.add(normalizePhotoUrl(c));
    });

    // 3. JSON-LD
    const ld = readJsonLd();
    if (ld) {
      const imgs = ld.image;
      if (Array.isArray(imgs)) imgs.forEach((u) => all.add(normalizePhotoUrl(u)));
      else if (typeof imgs === "string") all.add(normalizePhotoUrl(imgs));
    }

    // 4. Regex sobre todo el HTML (scripts inline incluidos)
    const html = document.documentElement.outerHTML;
    const re = /https?:(?:\\?\/){2}img\d?\.idealista\.com\/[^"'\s<>\\)]+?\.(?:jpg|jpeg|png|webp)/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const u = normalizePhotoUrl(m[0]);
      if (!/\/blank\.gif$/.test(u)) all.add(u);
    }

    const urls = Array.from(all);

    // 5. Filtrar: agrupar por "carpeta padre" del path.
    //    Idealista guarda cada anuncio en su carpeta. El grupo más grande
    //    son las fotos de este anuncio; los demás (relacionados, logos,
    //    banners) acaban en otras carpetas con 1-2 imágenes cada uno.
    const groups = new Map();
    const skip = []; // URLs sin path utilizable (logos planos, etc.)
    for (const u of urls) {
      try {
        const parsed = new URL(u);
        if (!/^img\d?\.idealista\.com$/i.test(parsed.hostname)) { skip.push(u); continue; }
        // Carpeta = todo el path sin el último segmento. Sirve para img4.idealista.com/blur/... y otros formatos.
        const folder = parsed.pathname.replace(/\/[^/]+$/, "");
        if (!folder || folder === "/") { skip.push(u); continue; }
        if (!groups.has(folder)) groups.set(folder, []);
        groups.get(folder).push(u);
      } catch (_) {
        skip.push(u);
      }
    }

    if (groups.size === 0) return dedupeByFilename(urls).slice(0, 80); // fallback

    // El grupo más grande es el anuncio actual.
    let bestFolder = null;
    let bestSize = 0;
    for (const [folder, list] of groups) {
      if (list.length > bestSize) {
        bestSize = list.length;
        bestFolder = folder;
      }
    }
    // Si el "mejor" grupo es ridículamente pequeño (≤3), probablemente el
    // patrón cambió: caemos a todas las URLs por seguridad.
    const candidates = bestSize <= 3 ? urls : groups.get(bestFolder);
    return dedupeByFilename(candidates).slice(0, 80);
  }

  // Una misma foto aparece con varios tamaños (WEB_DETAIL, WEB_LISTING,
  // thumbnail…) — el "ID" real es el nombre del fichero al final del path.
  // Nos quedamos con la mejor variante para cada fichero.
  function photoSizeScore(u) {
    if (/\/WEB_DETAIL-MULTIMEDIA\//i.test(u)) return 100;
    if (/\/WEB_DETAIL-L\//i.test(u)) return 90;
    if (/\/WEB_DETAIL\//i.test(u)) return 80;
    if (/\/WEB_LISTING-L\//i.test(u)) return 60;
    if (/\/WEB_LISTING-M\//i.test(u)) return 50;
    if (/\/WEB_LISTING\//i.test(u)) return 40;
    const m = u.match(/\/(\d+)x(\d+)\//);
    if (m) return Math.min(30, parseInt(m[1], 10) / 100);
    if (/thumbnail/i.test(u)) return 5;
    return 10;
  }

  function dedupeByFilename(list) {
    const byFile = new Map();
    for (const u of list) {
      try {
        const parsed = new URL(u);
        // Idealista publica cada foto en .jpg Y .webp con el mismo nombre.
        // Agrupamos por path SIN extensión, y damos un pequeño bonus a JPG
        // (más compatible que WebP en algunos lectores/exportadores).
        const noExt = parsed.pathname.replace(/\.(jpe?g|png|webp|avif)$/i, "");
        const key = noExt;
        const sizeScore = photoSizeScore(u);
        const formatBonus = /\.jpe?g$/i.test(parsed.pathname) ? 1 : 0;
        const score = sizeScore + formatBonus;
        const prev = byFile.get(key);
        if (!prev || score > prev.score) byFile.set(key, { url: u, score });
      } catch (_) {
        if (!byFile.has(u)) byFile.set(u, { url: u, score: 0 });
      }
    }
    return Array.from(byFile.values()).map((x) => x.url);
  }

  function readLocation() {
    const headerLoc = text("#headerMap, .main-info__title-minor, .header-map-list");
    const breadcrumbs = Array.from(
      document.querySelectorAll(".breadcrumb-geo a, nav[aria-label*='breadcrumb'] a")
    )
      .map((a) => a.textContent.trim())
      .filter(Boolean);

    let address = headerLoc;
    let city = null;
    let province = "Asturias";
    let neighborhood = null;

    if (breadcrumbs.length) {
      city = breadcrumbs[breadcrumbs.length - 1] || null;
      if (breadcrumbs.length >= 2) province = breadcrumbs[breadcrumbs.length - 2] || province;
    }
    if (!city && headerLoc) {
      const parts = headerLoc.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) city = parts[parts.length - 1];
    }
    // Fallback: el título suele acabar en "...en <Barrio>-<Ciudad>" o "...en <Ciudad>"
    const h1 = text("h1.main-info__title-main, .txt-bold.main-info__title-main, h1");
    if (h1) {
      const m = h1.match(/\ben\s+([^,]+?)(?:\s*[-,]\s*([^,]+?))?\s*$/i);
      if (m) {
        if (!city) city = (m[2] || m[1] || "").trim() || null;
        if (!neighborhood && m[2]) neighborhood = m[1].trim();
      }
    }
    // Último recurso: si address es una palabra suelta (ej. "Oviedo"), úsala como city.
    if (!city && address && !address.includes(",") && address.length < 40) {
      city = address;
    }
    return { address, city, province, neighborhood };
  }

  // ---------- Run ----------
  function run() {
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
      neighborhood: loc.neighborhood ?? null,
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

    notify("BuySell: enviando…\n" + (title || "").slice(0, 60), "#3A5F8A");
    console.log("[BuySell] payload:", payload);

    // GM_xmlhttpRequest se salta CORS y CSP de la página
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
          console.error("[BuySell] error:", data);
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
        console.log("[BuySell] result:", data);
      },
      onerror: function (err) {
        notify("Error de red.\n¿Está la app en localhost:4200?", "#B91C1C");
        console.error("[BuySell] fetch error:", err);
      },
    });
  }

  // Inject button + re-inject si Idealista repinta el DOM
  injectButton();
  new MutationObserver(injectButton).observe(document.body, { childList: true, subtree: false });
})();
