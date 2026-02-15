// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

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
