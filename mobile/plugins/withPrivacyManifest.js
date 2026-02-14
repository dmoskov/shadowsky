const { withXcodeProject } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Config plugin to add PrivacyInfo.xcprivacy to the iOS project
 * Required for iOS 17+ App Store submission
 *
 * This plugin ensures the privacy manifest is properly included in the Xcode project
 * and declares the app's use of required reason APIs:
 * - NSPrivacyAccessedAPICategoryUserDefaults (AsyncStorage)
 * - NSPrivacyAccessedAPICategoryFileTimestamp (file operations)
 * - NSPrivacyAccessedAPICategoryDiskSpace (cache size calculation)
 * - NSPrivacyAccessedAPICategorySystemBootTime (performance/analytics)
 */
const withPrivacyManifest = (config) => {
  return withXcodeProject(config, async (config) => {
    const { modResults, projectRoot } = config;
    const xcodeProject = modResults;

    // Path to the privacy manifest file
    const privacyManifestPath = "PrivacyInfo.xcprivacy";
    const privacyManifestFullPath = path.join(
      projectRoot,
      "ios",
      privacyManifestPath
    );

    // Check if privacy manifest file exists
    if (!fs.existsSync(privacyManifestFullPath)) {
      console.warn(
        `⚠️  PrivacyInfo.xcprivacy not found at ${privacyManifestFullPath}`
      );
      return config;
    }

    // Get the app target name (usually matches the app name)
    const targets = xcodeProject.getFirstTarget();
    const targetName = targets ? targets.firstTarget.name : config.name;

    // Add the privacy manifest to the project if it's not already there
    const file = xcodeProject.addResourceFile(
      privacyManifestPath,
      { target: targetName },
      xcodeProject.getFirstProject().uuid
    );

    if (file) {
      console.log("✅ PrivacyInfo.xcprivacy added to Xcode project");
    } else {
      console.log("ℹ️  PrivacyInfo.xcprivacy already exists in Xcode project");
    }

    return config;
  });
};

module.exports = withPrivacyManifest;
