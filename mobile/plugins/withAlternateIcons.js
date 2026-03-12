const {
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin that:
 * 1. Copies alternate icon PNGs (all sizes) into the Xcode project
 * 2. Registers them in Info.plist under CFBundleIcons
 *
 * Each alternate icon needs multiple sizes:
 * - 120x120 (iPhone 60pt @2x)
 * - 152x152 (iPad 76pt @2x)
 * - 167x167 (iPad Pro 83.5pt @2x)
 * - 180x180 (iPhone 60pt @3x)
 * - 1024x1024 (App Store)
 */

const ICON_VARIANTS = ["light", "mono", "pride"];
const ICON_SIZES = [120, 152, 167, 180];

function getIconFiles(variant) {
  const files = [`icon-${variant}.png`];
  for (const size of ICON_SIZES) {
    files.push(`icon-${variant}-${size}.png`);
  }
  return files;
}

function withAlternateIcons(config) {
  // Add icons to Info.plist
  config = withInfoPlist(config, (config) => {
    const alternateIcons = {};
    for (const variant of ICON_VARIANTS) {
      alternateIcons[variant] = {
        CFBundleIconFiles: [
          `icon-${variant}`,
          ...ICON_SIZES.map((size) => `icon-${variant}-${size}`),
        ],
        UIPrerenderedIcon: true,
      };
    }

    config.modResults.CFBundleIcons = {
      ...(config.modResults.CFBundleIcons || {}),
      CFBundleAlternateIcons: alternateIcons,
    };
    return config;
  });

  // Copy icon files into the iOS project directory
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const iconsDir = path.resolve(__dirname, "../assets/alternate-icons");
      const projectName = config.modRequest.projectName;
      const appDir = path.join(
        config.modRequest.platformProjectRoot,
        projectName
      );

      for (const variant of ICON_VARIANTS) {
        for (const iconFile of getIconFiles(variant)) {
          const src = path.join(iconsDir, iconFile);
          if (fs.existsSync(src)) {
            fs.copyFileSync(src, path.join(appDir, iconFile));
          }
        }
      }

      return config;
    },
  ]);

  // Add icon files to Xcode project resources
  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const projectName = config.modRequest.projectName;

    // Collect all icon files
    const allIconFiles = [];
    for (const variant of ICON_VARIANTS) {
      allIconFiles.push(...getIconFiles(variant));
    }

    // Find the app group by iterating PBXGroup entries
    const pbxGroupSection = project.hash.project.objects["PBXGroup"];
    let appGroupKey = null;

    for (const key of Object.keys(pbxGroupSection)) {
      const group = pbxGroupSection[key];
      if (typeof group === "object" && group.name === projectName) {
        appGroupKey = key;
        break;
      }
    }

    if (!appGroupKey) {
      // Fallback: look by path
      for (const key of Object.keys(pbxGroupSection)) {
        const group = pbxGroupSection[key];
        if (typeof group === "object" && group.path === projectName) {
          appGroupKey = key;
          break;
        }
      }
    }

    for (const iconFile of allIconFiles) {
      const filePath = `${projectName}/${iconFile}`;

      // Add file reference
      const fileRef = project.generateUuid();
      project.hash.project.objects["PBXFileReference"] =
        project.hash.project.objects["PBXFileReference"] || {};
      project.hash.project.objects["PBXFileReference"][fileRef] = {
        isa: "PBXFileReference",
        lastKnownFileType: "image.png",
        name: iconFile,
        path: filePath,
        sourceTree: '"<group>"',
      };
      project.hash.project.objects["PBXFileReference"][`${fileRef}_comment`] =
        iconFile;

      // Add to app group's children
      if (appGroupKey && pbxGroupSection[appGroupKey].children) {
        pbxGroupSection[appGroupKey].children.push({
          value: fileRef,
          comment: iconFile,
        });
      }

      // Add build file
      const buildFileUuid = project.generateUuid();
      project.hash.project.objects["PBXBuildFile"] =
        project.hash.project.objects["PBXBuildFile"] || {};
      project.hash.project.objects["PBXBuildFile"][buildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: fileRef,
        fileRef_comment: iconFile,
      };
      project.hash.project.objects["PBXBuildFile"][
        `${buildFileUuid}_comment`
      ] = `${iconFile} in Resources`;

      // Add to Resources build phase
      const resourcesBuildPhase = project.pbxResourcesBuildPhaseObj(
        project.getFirstTarget().uuid
      );
      if (resourcesBuildPhase) {
        resourcesBuildPhase.files.push({
          value: buildFileUuid,
          comment: `${iconFile} in Resources`,
        });
      }
    }

    return config;
  });

  return config;
}

module.exports = withAlternateIcons;
