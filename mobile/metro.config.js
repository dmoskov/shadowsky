const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Allow importing from shared source
    extraNodeModules: {
      '@shared': `${__dirname}/../src/shared`,
    },
  },
  watchFolders: [
    // Watch the shared source directory
    `${__dirname}/../src/shared`,
  ],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
