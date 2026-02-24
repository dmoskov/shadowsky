// Learn more https://docs.expo.io/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix package exports resolution for @atproto dependencies.
// multiformats and uint8arrays use "exports" field with ESM/CJS conditions.
// Without this, Metro tries CJS internal paths not listed in "exports",
// triggering "not listed in the exports" warnings at runtime.
config.resolver.unstable_conditionNames = ['browser', 'require', 'import'];

// Some @atproto deps need .mjs extension resolution
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

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
  // Default resolution
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Suppress spurious package exports warnings from Metro bundler
// These occur when @atproto/api dependencies (multiformats, uint8arrays) are resolved.
// Metro warns about accessing internal CJS paths not listed in "exports" field,
// but successfully falls back to file-based resolution. The warnings are harmless noise.
// See: https://github.com/facebook/metro/issues/670
const originalWarn = console.warn;
console.warn = function (...args) {
  const message = args[0];
  if (
    typeof message === 'string' &&
    message.includes('not listed in the "exports"') &&
    (message.includes('multiformats') || message.includes('uint8arrays'))
  ) {
    // Suppress these specific warnings - packages resolve correctly via fallback
    return;
  }
  originalWarn.apply(console, args);
};

module.exports = config;
