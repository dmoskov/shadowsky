// Design-token usage guard. Fails when components use raw Tailwind gray
// utilities or arbitrary hex color classes instead of the asph-* semantic
// tokens (see src/styles/generated-tokens.css and docs/DESIGN.md).
//
// Usage: node scripts/check-design-tokens.mjs
// Exceptions: add "path/to/file.tsx" or "path/to/file.tsx:class-token" lines
// to scripts/design-tokens-allowlist.txt (one per line, # comments allowed).

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(repoRoot, "src");

const BANNED = [
  // Tailwind gray scale (incl. hover:/dark:/etc. variants via the lookbehind-free token match)
  /(?:bg|text|border|divide|ring|placeholder|from|to|via)-gray-\d{2,3}\b/g,
  // Arbitrary hex color utilities like bg-[#1f2937]
  /(?:bg|text|border|ring|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/g,
];

const allowlistPath = join(repoRoot, "scripts", "design-tokens-allowlist.txt");
const allowlist = new Set(
  existsSync(allowlistPath)
    ? readFileSync(allowlistPath, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
    : [],
);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx|ts)$/.test(entry) && !/\.test\.(tsx|ts)$/.test(entry)) {
      yield p;
    }
  }
}

let failures = 0;
for (const file of walk(srcDir)) {
  const rel = relative(repoRoot, file);
  if (allowlist.has(rel)) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const pattern of BANNED) {
      for (const match of line.matchAll(pattern)) {
        if (allowlist.has(`${rel}:${match[0]}`)) continue;
        failures++;
        console.error(`${rel}:${i + 1}: banned class "${match[0]}"`);
      }
    }
  });
}

if (failures > 0) {
  console.error(
    `\n${failures} non-token color usage(s). Use asph-* semantic utilities (e.g. bg-asph-bg-secondary, text-asph-text-secondary, border-asph-border-primary) or add a justified entry to scripts/design-tokens-allowlist.txt.`,
  );
  process.exit(1);
}
console.log("Design token usage clean.");
