import { makeGenericAdapter } from "./_genericAdapter";

export const indomioAdapter = makeGenericAdapter({
  portal: "INDOMIO",
  matches: (url) => /indomio\.es\//i.test(url),
  priceSelectors: ["[class*='price']", ".price", "[itemprop='price']"],
  externalIdFromUrl: (url) => {
    const m = url.match(/\/anuncios\/(\d+)/);
    return m ? m[1] : null;
  },
});
