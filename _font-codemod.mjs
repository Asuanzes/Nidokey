// Codemod de un solo uso: migra fontWeight -> fontFamily (familias fonts.*) en las
// pantallas/componentes moviles. Determinista, sin agentes. Se borra tras usar.
import { readFileSync, writeFileSync } from "node:fs";

const REL = [
  "apps/mobile/app/(tabs)/_layout.tsx",
  "apps/mobile/app/(tabs)/account.tsx",
  "apps/mobile/components/RecordCard.tsx",
  "apps/mobile/components/AssetDetail.tsx",
  "apps/mobile/app/job/[id].tsx",
  "apps/mobile/app/holiday/[id].tsx",
  "apps/mobile/app/book/[id].tsx",
  "apps/mobile/app/(tabs)/index.tsx",
  "apps/mobile/app/property/[id].tsx",
  "apps/mobile/app/viajes/nuevo.tsx",
  "apps/mobile/app/(tabs)/importar.tsx",
  "apps/mobile/app/(tabs)/matches.tsx",
  "apps/mobile/components/ReorderableCategoryList.tsx",
  "apps/mobile/app/login.tsx",
  "apps/mobile/components/LanguageSelector.tsx",
  "apps/mobile/components/travel/HotelDetailModal.tsx",
  "apps/mobile/components/ui/ResultModal.tsx",
  "apps/mobile/app/scan-book.tsx",
  "apps/mobile/components/DuplicateRootNotice.tsx",
  "apps/mobile/components/ArticleWebViewScreen.tsx",
  "apps/mobile/components/NewsSheet.tsx",
  "apps/mobile/components/BrandLoading.tsx",
  "apps/mobile/components/WebViewImporter.tsx",
  "apps/mobile/app/tools/[tool].tsx",
  "apps/mobile/app/tools/mortgage.tsx",
  "apps/mobile/components/CategoryContextSheet.tsx",
  "apps/mobile/components/ui/Section.tsx",
  "apps/mobile/app/modal.tsx",
];

// peso -> familia. Sin la regla "titulo grande -> Poppins" (los titulos de pantalla
// ya usan Poppins via el componente Screen / cabeceras); aqui todo el cuerpo es Inter.
const MAP = {
  "700": "fonts.bodyBold",
  bold: "fonts.bodyBold",
  "600": "fonts.bodySemibold",
  "500": "fonts.bodyMedium",
  "400": "fonts.body",
  normal: "fonts.body",
};

let total = 0;
for (const rel of REL) {
  let src;
  try {
    src = readFileSync(rel, "utf8");
  } catch {
    console.log(`SKIP (no existe)\t${rel}`);
    continue;
  }
  let n = 0;
  // fontWeight: "700" | '700' | "bold" ...
  src = src.replace(/fontWeight:\s*(['"])(700|600|500|400|bold|normal)\1/g, (m, _q, w) => {
    const fam = MAP[w];
    if (!fam) return m;
    n++;
    return `fontFamily: ${fam}`;
  });
  // fontWeight: 700  (numero sin comillas)
  src = src.replace(/fontWeight:\s*(700|600|500|400)\b/g, (m, w) => {
    const fam = MAP[w];
    if (!fam) return m;
    n++;
    return `fontFamily: ${fam}`;
  });
  if (n > 0) {
    if (!/from\s+["']@\/lib\/fonts["']/.test(src)) {
      if (/import[^\n]*from\s+["']@\/lib\/theme["'];?\n/.test(src)) {
        src = src.replace(
          /(import[^\n]*from\s+["']@\/lib\/theme["'];?\n)/,
          `$1import { fonts } from "@/lib/fonts";\n`,
        );
      } else {
        src = src.replace(/(^import[^\n]*\n)/m, `$1import { fonts } from "@/lib/fonts";\n`);
      }
    }
    writeFileSync(rel, src);
  }
  total += n;
  console.log(`${n}\t${rel}`);
}
console.log(`TOTAL ${total}`);
