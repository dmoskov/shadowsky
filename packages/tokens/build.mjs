// Design token codegen. Reads tokens.mjs and writes the checked-in consumer
// files for web (CSS variables), React Native (TS theme objects), and native
// iOS modules (SwiftUI colors).
//
// Usage (from repo root):
//   node packages/tokens/build.mjs          # write generated files
//   node packages/tokens/build.mjs --check  # exit 1 if any file is stale

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { web, mobile, swiftModules, typeScale } from "./tokens.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const HEADER_NOTE = [
  "GENERATED FILE - do not edit.",
  "Edit packages/tokens/tokens.mjs and run `npm run tokens:build`.",
];

// --- CSS ------------------------------------------------------------------

function cssBlock(selector, vars) {
  const lines = Object.entries(vars).map(
    ([key, value]) => `  --asph-${key}: ${value};`,
  );
  return `${selector} {\n${lines.join("\n")}\n}`;
}

function typeScaleVars() {
  return Object.fromEntries(
    Object.entries(typeScale).map(([name, px]) => [
      `font-${name}`,
      `${px / 16}rem`,
    ]),
  );
}

function generateCss() {
  const blocks = [
    `/* ${HEADER_NOTE.join("\n * ")}\n *\n * Color, shadow, letter-spacing, and type-scale variables for the Asphodel\n * theme. Non-token variables (focus rings, animation timing, loading\n * states) live in asphodel-theme.css. */`,
    cssBlock(":root", { ...web.light, ...typeScaleVars() }),
    `/* Dark theme */\n${cssBlock('.dark,\n[data-theme="dark"]', web.dark)}`,
    `/* High Contrast - Light - WCAG AAA (7:1 minimum contrast ratio) */\n${cssBlock(
      '[data-high-contrast="true"],\n[data-high-contrast="true"][data-theme="light"]',
      web.highContrastLight,
    )}`,
    `/* High Contrast - Dark - WCAG AAA (7:1 minimum contrast ratio) */\n${cssBlock(
      '[data-high-contrast="true"][data-theme="dark"],\n[data-high-contrast="true"].dark',
      web.highContrastDark,
    )}`,
  ];
  return `${blocks.join("\n\n")}\n`;
}

// --- Static pages CSS ---------------------------------------------------------

// The standalone legal pages in public/ (privacy, terms) are served outside the
// Vite build, so they can't use the Tailwind asph-* utilities. They get their
// own generated stylesheet instead: the same token values, plus the small set
// of base element styles those pages need. Theme follows the OS, since there is
// no app shell to carry a theme toggle.
function generateStaticPagesCss() {
  const vars = (obj, indent) =>
    Object.entries(obj)
      .map(([key, value]) => `${indent}--asph-${key}: ${value};`)
      .join("\n");

  return `/* ${HEADER_NOTE.join("\n * ")}
 *
 * Stylesheet for the standalone legal pages in public/ (privacy, terms).
 * Token values are shared with the app; theme follows the OS. */

:root {
${vars({ ...web.light, ...typeScaleVars() }, "  ")}
  --asph-measure: 42rem;
}

@media (prefers-color-scheme: dark) {
  :root {
${vars(web.dark, "    ")}
  }
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0 1.25rem 4rem;
  background: var(--asph-bg-primary);
  color: var(--asph-text-primary);
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: var(--asph-font-body);
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
}

.doc {
  max-width: var(--asph-measure);
  margin: 0 auto;
}

/* Masthead: the butterfly plus wordmark, linking back into the app. */
.doc-masthead {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 1.75rem 0;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--asph-border-light);
  color: var(--asph-text-primary);
  text-decoration: none;
  font-weight: 600;
}

.doc-masthead img {
  width: 2rem;
  height: 2rem;
}

.doc-masthead:hover {
  color: var(--asph-primary);
}

h1 {
  font-size: var(--asph-font-title1);
  line-height: 1.25;
  margin: 0 0 0.25rem;
}

h2 {
  font-size: var(--asph-font-title3);
  line-height: 1.35;
  margin: 2.5rem 0 0.5rem;
  color: var(--asph-text-primary);
}

p,
li {
  color: var(--asph-text-secondary);
}

a {
  color: var(--asph-text-link);
  text-underline-offset: 0.15em;
}

ul {
  padding-left: 1.25rem;
}

li + li {
  margin-top: 0.35rem;
}

.doc-updated {
  color: var(--asph-text-tertiary);
  font-size: var(--asph-font-footnote);
  margin: 0 0 2.5rem;
}

.doc-footer {
  margin-top: 3.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--asph-border-light);
  font-size: var(--asph-font-footnote);
  color: var(--asph-text-tertiary);
}

.doc-footer a + a {
  margin-left: 1rem;
}
`;
}

// --- React Native TS --------------------------------------------------------

function tsObject(name, vars) {
  const lines = Object.entries(vars).map(
    ([key, value]) => `  ${key}: "${value}",`,
  );
  return `export const ${name} = {\n${lines.join("\n")}\n} as const;`;
}

function generateMobileTs() {
  return [
    `// ${HEADER_NOTE.join("\n// ")}`,
    tsObject("darkColors", mobile.dark),
    tsObject("lightColors", mobile.light),
    "",
  ].join("\n\n");
}

// --- SwiftUI -----------------------------------------------------------------

function swiftColor(value) {
  const hex = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const [r, g, b] = [0, 2, 4].map(
      (i) => `0x${hex[1].slice(i, i + 2).toUpperCase()}`,
    );
    return `Color(red: ${r} / 255.0, green: ${g} / 255.0, blue: ${b} / 255.0)`;
  }
  const rgba = value.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
  if (rgba) {
    const [, r, g, b, a] = rgba;
    return `Color(red: ${r} / 255.0, green: ${g} / 255.0, blue: ${b} / 255.0, opacity: ${a})`;
  }
  throw new Error(`Cannot convert color value to SwiftUI Color: ${value}`);
}

function swiftStatics(vars, indent) {
  return Object.entries(vars)
    .map(([key, value]) => `${indent}static let ${key} = ${swiftColor(value)}`)
    .join("\n");
}

function generateSwift() {
  const invariant = Object.fromEntries(
    Object.entries(mobile.dark).filter(
      ([key, value]) => mobile.light[key] === value,
    ),
  );
  const darkOnly = Object.fromEntries(
    Object.entries(mobile.dark).filter(([key]) => !(key in invariant)),
  );
  const lightOnly = Object.fromEntries(
    Object.entries(mobile.light).filter(([key]) => !(key in invariant)),
  );
  return `// ${HEADER_NOTE.join("\n// ")}
//
// Mirrors the React Native theme (mobile/src/constants/theme.ts) so SwiftUI
// views match the rest of the app. Mode-invariant colors are at the top
// level; mode-specific colors live under Dark/Light.

import SwiftUI

enum DesignTokens {
${swiftStatics(invariant, "  ")}

  enum Dark {
${swiftStatics(darkOnly, "    ")}
  }

  enum Light {
${swiftStatics(lightOnly, "    ")}
  }
}
`;
}

// --- Output ------------------------------------------------------------------

const outputs = [
  { path: "src/styles/generated-tokens.css", content: generateCss() },
  { path: "public/static-pages.css", content: generateStaticPagesCss() },
  {
    path: "mobile/src/constants/generated/tokens.ts",
    content: generateMobileTs(),
  },
  ...swiftModules.map((mod) => ({
    path: `mobile/modules/${mod}/ios/Generated/DesignTokens.swift`,
    content: generateSwift(),
  })),
];

const checkMode = process.argv.includes("--check");
let stale = false;

for (const { path, content } of outputs) {
  const absPath = join(repoRoot, path);
  let existing = null;
  try {
    existing = readFileSync(absPath, "utf8");
  } catch {
    // missing file: stale in check mode, created in build mode
  }
  if (existing === content) continue;
  if (checkMode) {
    stale = true;
    console.error(`stale: ${relative(repoRoot, absPath)}`);
  } else {
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, content);
    console.log(`wrote: ${relative(repoRoot, absPath)}`);
  }
}

if (checkMode) {
  if (stale) {
    console.error(
      "\nGenerated design-token files are out of date. Run `npm run tokens:build` and commit the result.",
    );
    process.exit(1);
  }
  console.log("Design tokens up to date.");
}
