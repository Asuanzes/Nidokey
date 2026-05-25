import { makeGenericAdapter } from "./_genericAdapter";

export const pisosAdapter = makeGenericAdapter({
  portal: "PISOS_COM",
  matches: (url) => /pisos\.com\//i.test(url),
  priceSelectors: [
    "[class*='Price']",
    "[class*='price']",
    ".price",
    "[itemprop='price']",
  ],
  externalIdFromUrl: (url) => {
    const m = url.match(/-(\d+)_\d+\/?$/);
    return m ? m[1] : null;
  },
});
