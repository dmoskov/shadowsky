// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Note: multiformats/uint8arrays subpath import warnings are a known metro issue
// with @atproto/api dependencies. They're harmless — metro falls back to file-based
// resolution successfully. See: https://github.com/facebook/metro/issues/670

module.exports = config;
