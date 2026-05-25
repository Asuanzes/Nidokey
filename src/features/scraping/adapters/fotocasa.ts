import { makeGenericAdapter } from "./_genericAdapter";

export const fotocasaAdapter = makeGenericAdapter({
  portal: "FOTOCASA",
  matches: (url) => /fotocasa\.es\//i.test(url),
  priceSelectors: [
    "[class*='Price']",
    ".re-DetailHeader-price",
    "[data-test='price']",
    "[itemprop='price']",
  ],
  externalIdFromUrl: (url) => {
    const m = url.match(/\/(\d+)\/[^/]*\/?$/);
    return m ? m[1] : null;
  },
});
