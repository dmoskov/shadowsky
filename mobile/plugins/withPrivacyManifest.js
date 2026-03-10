const { withXcodeProject } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Config plugin to add PrivacyInfo.xcprivacy to the iOS project
 * Required for iOS 17+ App Store submission
 *
 * This plugin generates the privacy manifest in the app target directory,
 * declaring the app's use of required reason APIs:
 * - NSPrivacyAccessedAPICategoryUserDefaults (AsyncStorage)
 * - NSPrivacyAccessedAPICategoryFileTimestamp (file operations)
 * - NSPrivacyAccessedAPICategoryDiskSpace (cache size calculation)
 * - NSPrivacyAccessedAPICategorySystemBootTime (performance/analytics)
 */

const PRIVACY_MANIFEST_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyCollectedDataTypes</key>
  <array/>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>C617.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryDiskSpace</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>E174.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategorySystemBootTime</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>35F9.1</string>
      </array>
    </dict>
  </array>
</dict>
</plist>`;

const withPrivacyManifest = (config) => {
  return withXcodeProject(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const appTargetName = config.modRequest.projectName || config.name;

    const privacyManifestFullPath = path.join(
      projectRoot,
      "ios",
      appTargetName,
      "PrivacyInfo.xcprivacy"
    );

    // Create the privacy manifest if it doesn't exist
    if (!fs.existsSync(privacyManifestFullPath)) {
      const dir = path.dirname(privacyManifestFullPath);
      if (fs.existsSync(dir)) {
        fs.writeFileSync(privacyManifestFullPath, PRIVACY_MANIFEST_CONTENT);
        console.log("✅ PrivacyInfo.xcprivacy created");
      } else {
        console.warn(`⚠️  Target directory not found: ${dir}`);
      }
    } else {
      console.log("ℹ️  PrivacyInfo.xcprivacy already exists");
    }

    return config;
  });
};

module.exports = withPrivacyManifest;
