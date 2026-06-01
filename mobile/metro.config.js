// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Monorepo: allow Metro to resolve the shared @bsky/core workspace package,
// installed as a `file:../packages/core` dependency (symlinked into
// mobile/node_modules). Metro only follows symlinks into watched folders, so we
// add packages/ to watchFolders. Purely additive — mobile keeps its own
// node_modules and hierarchical lookup, so the @atproto shim below is
// unaffected. See docs/SHARED_PACKAGE_MIGRATION.md.
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '..', 'packages'),
];

// Fix package exports resolution for @atproto dependencies.
// multiformats and uint8arrays use "exports" field with ESM/CJS conditions.
// Metro's legacy "browser" field processing in redirectModulePath() conflicts
// with the modern "exports" field: it rewrites e.g. "multiformats/cid" →
// "multiformats/cjs/src/cid.js" via the browser field, then the exports check
// fails on that rewritten path, producing "not listed in the exports" warnings.
// Metro uses context.unstable_logWarning (reporter system), not console.warn,
// so console.warn patching cannot suppress them.
//
// Fix: resolve these packages' subpath imports directly via their exports map
// (using the "browser" condition), bypassing the browser field redirect entirely.
config.resolver.unstable_conditionNames = ['browser', 'require', 'import'];

// Some @atproto deps need .mjs extension resolution
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

// Build exports resolution maps at config load time.
// Reads the "exports" field from each package and picks the "browser" condition
// target for every subpath, giving us a direct file path for each specifier.
function buildExportsMap(packageName) {
  const pkgJson = require(path.join(
    __dirname,
    'node_modules',
    packageName,
    'package.json'
  ));
  const exportsField = pkgJson.exports;
  if (!exportsField || typeof exportsField !== 'object') return {};

  const map = {};
  for (const [subpath, conditions] of Object.entries(exportsField)) {
    if (typeof conditions === 'object' && conditions !== null) {
      // Prefer browser → import → require → default
      const target =
        conditions.browser || conditions.import || conditions.require || conditions.default;
      if (target) {
        // Normalize subpath: "./cid" → "cid", "." → ""
        const normalizedSubpath = subpath === '.' ? '' : subpath.replace(/^\.\//, '');
        map[normalizedSubpath] = path.resolve(
          __dirname,
          'node_modules',
          packageName,
          target
        );
      }
    }
  }
  return map;
}

const exportsResolutionMaps = {
  multiformats: buildExportsMap('multiformats'),
  uint8arrays: buildExportsMap('uint8arrays'),
};

// Redirect core-js polyfills that fail to resolve under Metro.
// core-js 3.48+ has internal module references (../internals/*) that Metro's
// resolver cannot follow. We replace the problematic entry points with a
// lightweight local shim that provides the same runtime polyfills.
const coreJsShim = path.resolve(__dirname, 'src/polyfills/explicit-resource-management.js');

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Redirect all core-js imports to our local shim
  if (
    moduleName === 'core-js/proposals/explicit-resource-management' ||
    moduleName === 'core-js/modules/es.symbol.dispose'
  ) {
    return { type: 'sourceFile', filePath: coreJsShim };
  }

  // Resolve multiformats and uint8arrays via their exports map directly.
  // This prevents Metro's browser field redirect from rewriting the specifier
  // to an internal CJS path that isn't in the exports map.
  for (const [packageName, exportsMap] of Object.entries(exportsResolutionMaps)) {
    if (moduleName === packageName) {
      // Root import: e.g. require("multiformats")
      const filePath = exportsMap[''];
      if (filePath) return { type: 'sourceFile', filePath };
    } else if (moduleName.startsWith(packageName + '/')) {
      // Subpath import: e.g. require("multiformats/cid")
      const subpath = moduleName.slice(packageName.length + 1);
      const filePath = exportsMap[subpath];
      if (filePath) return { type: 'sourceFile', filePath };
    }
  }

  // Default resolution
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
