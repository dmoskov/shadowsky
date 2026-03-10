const { withXcodeProject, withInfoPlist } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin that:
 * 1. Copies alternate icon PNGs into the Xcode project
 * 2. Registers them in Info.plist under CFBundleIcons
 */
function withAlternateIcons(config) {
  // Add icons to Info.plist
  config = withInfoPlist(config, (config) => {
    config.modResults.CFBundleIcons = {
      ...(config.modResults.CFBundleIcons || {}),
      CFBundleAlternateIcons: {
        light: {
          CFBundleIconFiles: ["icon-light"],
          UIPrerenderedIcon: true,
        },
        mono: {
          CFBundleIconFiles: ["icon-mono"],
          UIPrerenderedIcon: true,
        },
        pride: {
          CFBundleIconFiles: ["icon-pride"],
          UIPrerenderedIcon: true,
        },
      },
    };
    return config;
  });

  // Copy icon files into the Xcode project
  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const iconsDir = path.resolve(__dirname, "../assets/alternate-icons");
    const icons = ["icon-light.png", "icon-mono.png", "icon-pride.png"];

    // Find the main group
    const mainGroup = project.getFirstProject().firstProject.mainGroup;

    for (const iconFile of icons) {
      const src = path.join(iconsDir, iconFile);
      if (fs.existsSync(src)) {
        // Add file reference to Xcode project
        project.addResourceFile(
          iconFile,
          { lastKnownFileType: "image.png" },
          mainGroup
        );

        // Copy file to iOS project directory
        const iosDir = path.resolve(config.modRequest.platformProjectRoot);
        const dest = path.join(iosDir, iconFile);
        fs.copyFileSync(src, dest);
      }
    }

    return config;
  });

  return config;
}

module.exports = withAlternateIcons;
