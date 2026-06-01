#!/usr/bin/env node
/**
 * Guard against @atproto/api version drift between the web app, the mobile app,
 * and the shared @bsky/core package.
 *
 * The web and mobile apps re-implement the same AT Protocol concepts and share
 * code via @bsky/core. If their @atproto/api versions diverge across a
 * major/minor, types (e.g. BlobRef, BskyAgent) become incompatible and the
 * shared package breaks. This fails CI when the declared ranges disagree.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

/** Strip range operators and return [major, minor] (or null). */
function majorMinor(range) {
  if (!range) return null;
  const m = String(range).match(/(\d+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}` : null;
}

const sources = [
  { name: "web (package.json)", range: read("package.json").dependencies?.["@atproto/api"] },
  { name: "mobile (mobile/package.json)", range: read("mobile/package.json").dependencies?.["@atproto/api"] },
];

// @bsky/core declares it as a peerDependency — must be satisfiable by both apps.
const corePeer = read("packages/core/package.json").peerDependencies?.["@atproto/api"];

const present = sources.filter((s) => s.range);
const versions = present.map((s) => majorMinor(s.range));
const unique = [...new Set(versions)];

let ok = true;
console.log("@atproto/api versions:");
for (const s of present) console.log(`  - ${s.name}: ${s.range}`);
console.log(`  - @bsky/core peerDependency: ${corePeer ?? "(none)"}`);

if (unique.length > 1) {
  ok = false;
  console.error(
    `\n✗ @atproto/api major.minor drift: ${unique.join(" vs ")}. ` +
      `Keep web and mobile on the same minor (the shared @bsky/core types depend on it).`,
  );
}

if (ok) {
  console.log("\n✓ @atproto/api versions are in lockstep.");
  process.exit(0);
}
process.exit(1);
