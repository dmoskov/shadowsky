#!/usr/bin/env node

/**
 * Bundle size budget enforcement for React Native (Expo) builds.
 *
 * Runs `expo export --platform ios --no-bytecode` to produce a JS bundle,
 * then checks the output against thresholds defined in ../.bundle-budget.json.
 *
 * Usage:
 *   node scripts/check-bundle-size.js [--output-dir <dir>] [--github-summary] [--pr-comment]
 *
 * Flags:
 *   --output-dir <dir>   Use an existing export directory instead of running expo export
 *   --github-summary     Append a Markdown table to $GITHUB_STEP_SUMMARY
 *   --pr-comment         Write a PR comment body to bundle-size-comment.md
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.resolve(__dirname, "..");
const BUDGET_PATH = path.join(ROOT, ".bundle-budget.json");
const DEFAULT_EXPORT_DIR = path.join(ROOT, ".bundle-export");

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    outputDir: null,
    githubSummary: false,
    prComment: false,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output-dir" && args[i + 1]) {
      flags.outputDir = args[++i];
    } else if (args[i] === "--github-summary") {
      flags.githubSummary = true;
    } else if (args[i] === "--pr-comment") {
      flags.prComment = true;
    }
  }
  return flags;
}

function loadBudget() {
  if (!fs.existsSync(BUDGET_PATH)) {
    console.error(`Budget file not found: ${BUDGET_PATH}`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(BUDGET_PATH, "utf-8"));
}

function runExpoExport(outputDir) {
  console.log("Running expo export (iOS, no bytecode)...");
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true });
  }
  execSync(
    `npx expo export --platform ios --no-bytecode --output-dir ${outputDir}`,
    {
      cwd: ROOT,
      stdio: "inherit",
      timeout: 300_000,
    },
  );
}

function findJsBundles(exportDir) {
  const jsDir = path.join(exportDir, "_expo", "static", "js", "ios");
  if (!fs.existsSync(jsDir)) {
    console.error(`JS output directory not found: ${jsDir}`);
    process.exit(1);
  }
  return fs
    .readdirSync(jsDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => path.join(jsDir, f));
}

function measureAssets(exportDir) {
  let totalBytes = 0;
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (!entry.name.endsWith(".js") && !entry.name.endsWith(".map")) {
        totalBytes += fs.statSync(full).size;
      }
    }
  }
  walk(exportDir);
  return totalBytes;
}

function gzipSize(filePath) {
  const content = fs.readFileSync(filePath);
  return zlib.gzipSync(content).length;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function deltaString(current, baseline) {
  if (!baseline) return "";
  const diff = current - baseline;
  const pct = ((diff / baseline) * 100).toFixed(1);
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${formatBytes(diff)} (${sign}${pct}%)`;
}

function statusEmoji(current, max) {
  if (current > max) return "\u274C"; // red X
  if (current > max * 0.9) return "\u26A0\uFE0F"; // warning
  return "\u2705"; // green check
}

function main() {
  const flags = parseArgs();
  const budget = loadBudget();

  const exportDir = flags.outputDir || DEFAULT_EXPORT_DIR;
  if (!flags.outputDir) {
    runExpoExport(exportDir);
  }

  // Measure JS bundle
  const bundles = findJsBundles(exportDir);
  if (bundles.length === 0) {
    console.error("No JS bundles found in export output");
    process.exit(1);
  }

  let totalJsBytes = 0;
  let totalJsGzipBytes = 0;
  for (const b of bundles) {
    const raw = fs.statSync(b).size;
    const gz = gzipSize(b);
    totalJsBytes += raw;
    totalJsGzipBytes += gz;
    console.log(
      `  ${path.basename(b)}: ${formatBytes(raw)} (gzip: ${formatBytes(gz)})`,
    );
  }

  // Measure assets
  const assetBytes = measureAssets(exportDir);

  const measurements = {
    "js-bundle": totalJsBytes,
    "js-bundle-gzip": totalJsGzipBytes,
    "total-assets": assetBytes,
  };

  // Check budgets
  let failed = false;
  const results = [];

  console.log("\nBundle Size Budget Check:");
  console.log("=".repeat(60));

  for (const [key, config] of Object.entries(budget.budgets)) {
    const current = measurements[key];
    if (current === undefined) continue;

    const overBudget = current > config.maxBytes;
    const status = statusEmoji(current, config.maxBytes);
    const baselineVal = budget.baseline ? budget.baseline[key] : null;
    const delta = deltaString(current, baselineVal);

    results.push({
      name: config.description,
      key,
      current,
      max: config.maxBytes,
      maxLabel: config.maxLabel,
      baseline: baselineVal,
      delta,
      overBudget,
      status,
    });

    console.log(`${status} ${config.description}`);
    console.log(
      `   Current: ${formatBytes(current)} / Budget: ${config.maxLabel}`,
    );
    if (delta) {
      console.log(`   Delta from baseline: ${delta}`);
    }
    if (overBudget) {
      console.log(`   OVER BUDGET by ${formatBytes(current - config.maxBytes)}`);
      failed = true;
    }
    console.log();
  }

  // GitHub step summary
  if (flags.githubSummary && process.env.GITHUB_STEP_SUMMARY) {
    const lines = [
      "## Mobile Bundle Size Report",
      "",
      "| Metric | Current | Budget | Delta | Status |",
      "|--------|---------|--------|-------|--------|",
    ];
    for (const r of results) {
      lines.push(
        `| ${r.name} | ${formatBytes(r.current)} | ${r.maxLabel} | ${r.delta || "n/a"} | ${r.status} |`,
      );
    }
    lines.push("");
    if (failed) {
      lines.push(
        "> **Bundle size budget exceeded.** Please investigate large dependencies or asset additions.",
      );
    }
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
  }

  // PR comment file
  if (flags.prComment) {
    const lines = [
      "## Mobile Bundle Size Report",
      "",
      "| Metric | Current | Budget | Delta | Status |",
      "|--------|---------|--------|-------|--------|",
    ];
    for (const r of results) {
      lines.push(
        `| ${r.name} | ${formatBytes(r.current)} | ${r.maxLabel} | ${r.delta || "n/a"} | ${r.status} |`,
      );
    }
    lines.push("");
    if (failed) {
      lines.push(
        "> **Bundle size budget exceeded.** Please investigate large dependencies or asset additions.",
      );
    } else {
      lines.push("> All bundle size budgets passed.");
    }
    fs.writeFileSync(
      path.join(ROOT, "bundle-size-comment.md"),
      lines.join("\n") + "\n",
    );
    console.log("PR comment body written to bundle-size-comment.md");
  }

  // Clean up default export dir
  if (!flags.outputDir && fs.existsSync(DEFAULT_EXPORT_DIR)) {
    fs.rmSync(DEFAULT_EXPORT_DIR, { recursive: true });
  }

  if (failed) {
    console.error("FAILED: Bundle size budget exceeded");
    process.exit(1);
  }

  console.log("PASSED: All bundle size budgets within limits");
}

main();
