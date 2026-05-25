import { makeGenericAdapter } from "./_genericAdapter";

export const thinkspainAdapter = makeGenericAdapter({
  portal: "THINKSPAIN",
  matches: (url) => /thinkspain\.com\//i.test(url),
  priceSelectors: ["[class*='price']", ".price", "[itemprop='price']"],
  externalIdFromUrl: (url) => {
    const m = url.match(/\/(\d+)\/?$/);
    return m ? m[1] : null;
  },
});
