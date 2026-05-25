import { makeGenericAdapter } from "./_genericAdapter";

export const habitacliaAdapter = makeGenericAdapter({
  portal: "HABITACLIA",
  matches: (url) => /habitaclia\.com\//i.test(url),
  priceSelectors: ["[class*='price']", ".price", "[itemprop='price']"],
  externalIdFromUrl: (url) => {
    const m = url.match(/-i(\d+)\.htm/);
    return m ? m[1] : null;
  },
});
