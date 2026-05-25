// One-shot: rewrite imports from @/lib/{sanity,similarity,format} to @buysell/shared
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const REPLACEMENTS = [
  [/"@\/lib\/sanity"/g, '"@buysell/shared"'],
  [/"@\/lib\/similarity"/g, '"@buysell/shared"'],
  [/"@\/lib\/format"/g, '"@buysell/shared"'],
];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p);
    } else if ([".ts", ".tsx"].includes(extname(name))) {
      const orig = readFileSync(p, "utf8");
      let next = orig;
      for (const [re, to] of REPLACEMENTS) next = next.replace(re, to);
      if (next !== orig) {
        writeFileSync(p, next);
        console.log("updated", p);
      }
    }
  }
}

walk("src");
