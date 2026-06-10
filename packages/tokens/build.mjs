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
import { web, mobile, swiftModules } from "./tokens.mjs";

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

function generateCss() {
  const blocks = [
    `/* ${HEADER_NOTE.join("\n * ")}\n *\n * Color, shadow, and letter-spacing variables for the Asphodel theme.\n * Non-token variables (focus rings, animation timing, loading states) live\n * in asphodel-theme.css. */`,
    cssBlock(":root", web.light),
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
