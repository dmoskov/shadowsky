const { withInfoPlist } = require("@expo/config-plugins");

/**
 * Config plugin to allow all orientations on iPad while keeping iPhone portrait-only.
 *
 * Expo's `orientation: "portrait"` config restricts orientations globally.
 * This plugin adds the `UISupportedInterfaceOrientations~ipad` key to Info.plist
 * so iPad retains all 4 orientations (portrait, portrait upside-down, landscape left/right).
 */
const withIpadOrientations = (config) => {
  return withInfoPlist(config, (config) => {
    config.modResults["UISupportedInterfaceOrientations~ipad"] = [
      "UIInterfaceOrientationPortrait",
      "UIInterfaceOrientationPortraitUpsideDown",
      "UIInterfaceOrientationLandscapeLeft",
      "UIInterfaceOrientationLandscapeRight",
    ];
    return config;
  });
};

module.exports = withIpadOrientations;
