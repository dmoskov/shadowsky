// Learn more https://docs.expo.io/guides/customizing-metro
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

module.exports = config;
