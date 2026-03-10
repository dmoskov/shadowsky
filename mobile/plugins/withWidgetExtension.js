const {
  withXcodeProject,
  withEntitlementsPlist,
} = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Expo config plugin to add a WidgetKit extension target to the Xcode project.
 *
 * This plugin:
 * 1. Ensures App Groups entitlement on the main app (shared with ShareExtension)
 * 2. Adds the WidgetExtension target with all Swift source files
 * 3. Configures build settings for the extension (WidgetKit + SwiftUI)
 */

const APP_GROUP_ID = "group.is.asphodel.app";
const WIDGET_EXT_NAME = "WidgetExtension";
const WIDGET_EXT_BUNDLE_ID = "is.asphodel.app.WidgetExtension";

// Deterministic UUIDs for Widget Extension (so config plugin is idempotent)
const WE_PRODUCT_REF = "WIDGET_EXT_PRODUCT_01";
const WE_FILE_REF_BUNDLE = "WIDGET_EXT_BUNDLE_FL";
const WE_FILE_REF_SHARED = "WIDGET_EXT_SHARED_FL";
const WE_FILE_REF_NOTIF = "WIDGET_EXT_NOTIF_FIL";
const WE_FILE_REF_TREND = "WIDGET_EXT_TREND_FIL";
const WE_FILE_REF_DMS = "WIDGET_EXT_DMS_FILE1";
const WE_FILE_REF_PLIST = "WIDGET_EXT_PLIST_FL1";
const WE_FILE_REF_ENTITLEMENTS = "WIDGET_EXT_ENTL_FL1";
const WE_BUILD_FILE_BUNDLE = "WIDGET_EXT_BLD_BNDL";
const WE_BUILD_FILE_SHARED = "WIDGET_EXT_BLD_SHRD";
const WE_BUILD_FILE_NOTIF = "WIDGET_EXT_BLD_NOTF";
const WE_BUILD_FILE_TREND = "WIDGET_EXT_BLD_TRND";
const WE_BUILD_FILE_DMS = "WIDGET_EXT_BLD_DMS1";
const WE_GROUP_REF = "WIDGET_EXT_GROUP_001";
const WE_TARGET_REF = "WIDGET_EXT_TARGET_01";
const WE_SOURCES_PHASE = "WIDGET_EXT_SRC_PHS01";
const WE_RESOURCES_PHASE = "WIDGET_EXT_RES_PHS01";
const WE_FRAMEWORKS_PHASE = "WIDGET_EXT_FRM_PHS01";
const WE_CONFIG_LIST = "WIDGET_EXT_CFG_LIST1";
const WE_CONFIG_DEBUG = "WIDGET_EXT_CFG_DBG01";
const WE_CONFIG_RELEASE = "WIDGET_EXT_CFG_REL01";
const WE_DEPENDENCY = "WIDGET_EXT_DEPEND_01";
const WE_CONTAINER_PROXY = "WIDGET_EXT_PROXY_001";
const WE_COPY_FILES_PHASE = "WIDGET_EXT_COPY_PHS1";
const WE_COPY_BUILD_FILE = "WIDGET_EXT_COPY_BLD1";

const withWidgetExtension = (config) => {
  // Step 1: Ensure App Group on main app entitlements (may already be set by ShareExtension)
  config = withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;
    if (!entitlements["com.apple.security.application-groups"]) {
      entitlements["com.apple.security.application-groups"] = [];
    }
    const groups = entitlements["com.apple.security.application-groups"];
    if (!groups.includes(APP_GROUP_ID)) {
      groups.push(APP_GROUP_ID);
    }
    return config;
  });

  // Step 2: Add the WidgetExtension target to the Xcode project
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectRoot = config.modRequest.projectRoot;

    // Check if WidgetExtension files exist
    const widgetExtDir = path.join(projectRoot, "ios", WIDGET_EXT_NAME);
    if (!fs.existsSync(widgetExtDir)) {
      console.log(
        `ℹ️  WidgetExtension: skipping — source directory not yet created at ${widgetExtDir}`
      );
      return config;
    }

    // Check if target already exists
    const existingTarget = xcodeProject.pbxTargetByName(WIDGET_EXT_NAME);
    if (existingTarget) {
      console.log("ℹ️  WidgetExtension target already exists in Xcode project");
      return config;
    }

    const projectObj = xcodeProject.getFirstProject().firstProject;
    const mainTargetKey = xcodeProject.getFirstTarget().firstTarget.uuid;

    // --- Add file references ---
    xcodeProject.hash.project.objects["PBXFileReference"] =
      xcodeProject.hash.project.objects["PBXFileReference"] || {};
    const fileRefs = xcodeProject.hash.project.objects["PBXFileReference"];

    // Swift source files
    const swiftFiles = [
      {
        ref: WE_FILE_REF_BUNDLE,
        name: "WidgetExtensionBundle.swift",
        build: WE_BUILD_FILE_BUNDLE,
      },
      {
        ref: WE_FILE_REF_SHARED,
        name: "SharedDataProvider.swift",
        build: WE_BUILD_FILE_SHARED,
      },
      {
        ref: WE_FILE_REF_NOTIF,
        name: "NotificationCountWidget.swift",
        build: WE_BUILD_FILE_NOTIF,
      },
      {
        ref: WE_FILE_REF_TREND,
        name: "TrendingTopicsWidget.swift",
        build: WE_BUILD_FILE_TREND,
      },
      {
        ref: WE_FILE_REF_DMS,
        name: "RecentDMsWidget.swift",
        build: WE_BUILD_FILE_DMS,
      },
    ];

    for (const file of swiftFiles) {
      fileRefs[file.ref] = {
        isa: "PBXFileReference",
        lastKnownFileType: "sourcecode.swift",
        name: file.name,
        path: `${WIDGET_EXT_NAME}/${file.name}`,
        sourceTree: '"<group>"',
      };
      fileRefs[`${file.ref}_comment`] = file.name;
    }

    // Info.plist
    fileRefs[WE_FILE_REF_PLIST] = {
      isa: "PBXFileReference",
      lastKnownFileType: "text.plist.xml",
      name: "Info.plist",
      path: `${WIDGET_EXT_NAME}/Info.plist`,
      sourceTree: '"<group>"',
    };
    fileRefs[`${WE_FILE_REF_PLIST}_comment`] = "Info.plist";

    // Entitlements
    fileRefs[WE_FILE_REF_ENTITLEMENTS] = {
      isa: "PBXFileReference",
      lastKnownFileType: "text.plist.entitlements",
      name: `${WIDGET_EXT_NAME}.entitlements`,
      path: `${WIDGET_EXT_NAME}/${WIDGET_EXT_NAME}.entitlements`,
      sourceTree: '"<group>"',
    };
    fileRefs[`${WE_FILE_REF_ENTITLEMENTS}_comment`] =
      `${WIDGET_EXT_NAME}.entitlements`;

    // Product reference
    fileRefs[WE_PRODUCT_REF] = {
      isa: "PBXFileReference",
      explicitFileType: '"wrapper.app-extension"',
      includeInIndex: 0,
      path: `${WIDGET_EXT_NAME}.appex`,
      sourceTree: "BUILT_PRODUCTS_DIR",
    };
    fileRefs[`${WE_PRODUCT_REF}_comment`] = `${WIDGET_EXT_NAME}.appex`;

    // Add product to Products group
    const productsGroup = xcodeProject.pbxGroupByName("Products");
    if (productsGroup) {
      productsGroup.children.push({
        value: WE_PRODUCT_REF,
        comment: `${WIDGET_EXT_NAME}.appex`,
      });
    }

    // --- Create WidgetExtension group ---
    xcodeProject.hash.project.objects["PBXGroup"] =
      xcodeProject.hash.project.objects["PBXGroup"] || {};
    const groups = xcodeProject.hash.project.objects["PBXGroup"];

    const groupChildren = swiftFiles.map((f) => ({
      value: f.ref,
      comment: f.name,
    }));
    groupChildren.push({
      value: WE_FILE_REF_PLIST,
      comment: "Info.plist",
    });
    groupChildren.push({
      value: WE_FILE_REF_ENTITLEMENTS,
      comment: `${WIDGET_EXT_NAME}.entitlements`,
    });

    groups[WE_GROUP_REF] = {
      isa: "PBXGroup",
      children: groupChildren,
      name: `"${WIDGET_EXT_NAME}"`,
      sourceTree: '"<group>"',
    };
    groups[`${WE_GROUP_REF}_comment`] = WIDGET_EXT_NAME;

    // Add to main group
    const mainGroupKey = projectObj.mainGroup;
    if (groups[mainGroupKey]) {
      groups[mainGroupKey].children.push({
        value: WE_GROUP_REF,
        comment: WIDGET_EXT_NAME,
      });
    }

    // --- Create build files for Swift sources ---
    xcodeProject.hash.project.objects["PBXBuildFile"] =
      xcodeProject.hash.project.objects["PBXBuildFile"] || {};
    const buildFiles = xcodeProject.hash.project.objects["PBXBuildFile"];

    for (const file of swiftFiles) {
      buildFiles[file.build] = {
        isa: "PBXBuildFile",
        fileRef: file.ref,
        fileRef_comment: file.name,
      };
      buildFiles[`${file.build}_comment`] = `${file.name} in Sources`;
    }

    // Build file for embedding the extension
    buildFiles[WE_COPY_BUILD_FILE] = {
      isa: "PBXBuildFile",
      fileRef: WE_PRODUCT_REF,
      fileRef_comment: `${WIDGET_EXT_NAME}.appex`,
      settings: { ATTRIBUTES: ["RemoveHeadersOnCopy"] },
    };
    buildFiles[`${WE_COPY_BUILD_FILE}_comment`] =
      `${WIDGET_EXT_NAME}.appex in Embed App Extensions`;

    // --- Create build phases ---
    // Sources
    xcodeProject.hash.project.objects["PBXSourcesBuildPhase"] =
      xcodeProject.hash.project.objects["PBXSourcesBuildPhase"] || {};
    xcodeProject.hash.project.objects["PBXSourcesBuildPhase"][
      WE_SOURCES_PHASE
    ] = {
      isa: "PBXSourcesBuildPhase",
      buildActionMask: 2147483647,
      files: swiftFiles.map((f) => ({
        value: f.build,
        comment: `${f.name} in Sources`,
      })),
      runOnlyForDeploymentPostprocessing: 0,
    };
    xcodeProject.hash.project.objects["PBXSourcesBuildPhase"][
      `${WE_SOURCES_PHASE}_comment`
    ] = "Sources";

    // Resources
    xcodeProject.hash.project.objects["PBXResourcesBuildPhase"] =
      xcodeProject.hash.project.objects["PBXResourcesBuildPhase"] || {};
    xcodeProject.hash.project.objects["PBXResourcesBuildPhase"][
      WE_RESOURCES_PHASE
    ] = {
      isa: "PBXResourcesBuildPhase",
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    xcodeProject.hash.project.objects["PBXResourcesBuildPhase"][
      `${WE_RESOURCES_PHASE}_comment`
    ] = "Resources";

    // Frameworks
    xcodeProject.hash.project.objects["PBXFrameworksBuildPhase"] =
      xcodeProject.hash.project.objects["PBXFrameworksBuildPhase"] || {};
    xcodeProject.hash.project.objects["PBXFrameworksBuildPhase"][
      WE_FRAMEWORKS_PHASE
    ] = {
      isa: "PBXFrameworksBuildPhase",
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    xcodeProject.hash.project.objects["PBXFrameworksBuildPhase"][
      `${WE_FRAMEWORKS_PHASE}_comment`
    ] = "Frameworks";

    // --- Embed App Extensions (on main target) ---
    // Check if a "Embed App Extensions" phase already exists (from ShareExtension)
    let copyFilesPhaseKey = null;
    const copyFilesPhases =
      xcodeProject.hash.project.objects["PBXCopyFilesBuildPhase"] || {};
    const mainTarget =
      xcodeProject.hash.project.objects["PBXNativeTarget"][mainTargetKey];

    if (mainTarget && mainTarget.buildPhases) {
      for (const phase of mainTarget.buildPhases) {
        const phaseObj = copyFilesPhases[phase.value];
        if (
          phaseObj &&
          phaseObj.name &&
          phaseObj.name.includes("Embed App Extensions")
        ) {
          copyFilesPhaseKey = phase.value;
          break;
        }
      }
    }

    if (copyFilesPhaseKey) {
      // Add to existing Embed App Extensions phase
      copyFilesPhases[copyFilesPhaseKey].files.push({
        value: WE_COPY_BUILD_FILE,
        comment: `${WIDGET_EXT_NAME}.appex in Embed App Extensions`,
      });
    } else {
      // Create new Embed App Extensions phase
      xcodeProject.hash.project.objects["PBXCopyFilesBuildPhase"] =
        xcodeProject.hash.project.objects["PBXCopyFilesBuildPhase"] || {};
      xcodeProject.hash.project.objects["PBXCopyFilesBuildPhase"][
        WE_COPY_FILES_PHASE
      ] = {
        isa: "PBXCopyFilesBuildPhase",
        buildActionMask: 2147483647,
        dstPath: '""',
        dstSubfolderSpec: 13, // App Extensions
        files: [
          {
            value: WE_COPY_BUILD_FILE,
            comment: `${WIDGET_EXT_NAME}.appex in Embed App Extensions`,
          },
        ],
        name: '"Embed App Extensions"',
        runOnlyForDeploymentPostprocessing: 0,
      };
      xcodeProject.hash.project.objects["PBXCopyFilesBuildPhase"][
        `${WE_COPY_FILES_PHASE}_comment`
      ] = "Embed App Extensions";

      if (mainTarget && mainTarget.buildPhases) {
        mainTarget.buildPhases.push({
          value: WE_COPY_FILES_PHASE,
          comment: "Embed App Extensions",
        });
      }
    }

    // --- Build configurations ---
    xcodeProject.hash.project.objects["XCBuildConfiguration"] =
      xcodeProject.hash.project.objects["XCBuildConfiguration"] || {};
    const buildConfigs =
      xcodeProject.hash.project.objects["XCBuildConfiguration"];

    const commonSettings = {
      ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: "AccentColor",
      ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME: "WidgetBackground",
      CLANG_ENABLE_MODULES: "YES",
      CODE_SIGN_ENTITLEMENTS: `${WIDGET_EXT_NAME}/${WIDGET_EXT_NAME}.entitlements`,
      CODE_SIGN_STYLE: "Automatic",
      CURRENT_PROJECT_VERSION: 1,
      DEVELOPMENT_TEAM: "P8T66U743T",
      GENERATE_INFOPLIST_FILE: "NO",
      INFOPLIST_FILE: `${WIDGET_EXT_NAME}/Info.plist`,
      IPHONEOS_DEPLOYMENT_TARGET: "17.0",
      LD_RUNPATH_SEARCH_PATHS: [
        '"$(inherited)"',
        '"@executable_path/Frameworks"',
        '"@executable_path/../../Frameworks"',
      ],
      MARKETING_VERSION: "1.0",
      PRODUCT_BUNDLE_IDENTIFIER: `"${WIDGET_EXT_BUNDLE_ID}"`,
      PRODUCT_NAME: `"$(TARGET_NAME)"`,
      SKIP_INSTALL: "YES",
      SWIFT_VERSION: "5.0",
      TARGETED_DEVICE_FAMILY: '"1,2"',
    };

    buildConfigs[WE_CONFIG_DEBUG] = {
      isa: "XCBuildConfiguration",
      buildSettings: {
        ...commonSettings,
        DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"',
        SWIFT_ACTIVE_COMPILATION_CONDITIONS: "DEBUG",
        SWIFT_OPTIMIZATION_LEVEL: '"-Onone"',
      },
      name: "Debug",
    };
    buildConfigs[`${WE_CONFIG_DEBUG}_comment`] = "Debug";

    buildConfigs[WE_CONFIG_RELEASE] = {
      isa: "XCBuildConfiguration",
      buildSettings: {
        ...commonSettings,
        COPY_PHASE_STRIP: "NO",
        DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"',
      },
      name: "Release",
    };
    buildConfigs[`${WE_CONFIG_RELEASE}_comment`] = "Release";

    // --- Configuration list ---
    xcodeProject.hash.project.objects["XCConfigurationList"] =
      xcodeProject.hash.project.objects["XCConfigurationList"] || {};
    xcodeProject.hash.project.objects["XCConfigurationList"][WE_CONFIG_LIST] = {
      isa: "XCConfigurationList",
      buildConfigurations: [
        { value: WE_CONFIG_DEBUG, comment: "Debug" },
        { value: WE_CONFIG_RELEASE, comment: "Release" },
      ],
      defaultConfigurationIsVisible: 0,
      defaultConfigurationName: "Release",
    };
    xcodeProject.hash.project.objects["XCConfigurationList"][
      `${WE_CONFIG_LIST}_comment`
    ] = `Build configuration list for PBXNativeTarget "${WIDGET_EXT_NAME}"`;

    // --- Container item proxy (dependency) ---
    xcodeProject.hash.project.objects["PBXContainerItemProxy"] =
      xcodeProject.hash.project.objects["PBXContainerItemProxy"] || {};
    xcodeProject.hash.project.objects["PBXContainerItemProxy"][
      WE_CONTAINER_PROXY
    ] = {
      isa: "PBXContainerItemProxy",
      containerPortal: "83CBB9F71A601CBA00E9B192",
      containerPortal_comment: "Project object",
      proxyType: 1,
      remoteGlobalIDString: WE_TARGET_REF,
      remoteInfo: `"${WIDGET_EXT_NAME}"`,
    };
    xcodeProject.hash.project.objects["PBXContainerItemProxy"][
      `${WE_CONTAINER_PROXY}_comment`
    ] = "PBXContainerItemProxy";

    // --- Target dependency ---
    xcodeProject.hash.project.objects["PBXTargetDependency"] =
      xcodeProject.hash.project.objects["PBXTargetDependency"] || {};
    xcodeProject.hash.project.objects["PBXTargetDependency"][WE_DEPENDENCY] = {
      isa: "PBXTargetDependency",
      target: WE_TARGET_REF,
      target_comment: WIDGET_EXT_NAME,
      targetProxy: WE_CONTAINER_PROXY,
      targetProxy_comment: "PBXContainerItemProxy",
    };
    xcodeProject.hash.project.objects["PBXTargetDependency"][
      `${WE_DEPENDENCY}_comment`
    ] = "PBXTargetDependency";

    // Add dependency to main target
    if (mainTarget) {
      if (!mainTarget.dependencies) {
        mainTarget.dependencies = [];
      }
      mainTarget.dependencies.push({
        value: WE_DEPENDENCY,
        comment: "PBXTargetDependency",
      });
    }

    // --- Create the native target ---
    xcodeProject.hash.project.objects["PBXNativeTarget"] =
      xcodeProject.hash.project.objects["PBXNativeTarget"] || {};
    xcodeProject.hash.project.objects["PBXNativeTarget"][WE_TARGET_REF] = {
      isa: "PBXNativeTarget",
      buildConfigurationList: WE_CONFIG_LIST,
      buildConfigurationList_comment: `Build configuration list for PBXNativeTarget "${WIDGET_EXT_NAME}"`,
      buildPhases: [
        { value: WE_SOURCES_PHASE, comment: "Sources" },
        { value: WE_FRAMEWORKS_PHASE, comment: "Frameworks" },
        { value: WE_RESOURCES_PHASE, comment: "Resources" },
      ],
      buildRules: [],
      dependencies: [],
      name: `"${WIDGET_EXT_NAME}"`,
      productName: `"${WIDGET_EXT_NAME}"`,
      productReference: WE_PRODUCT_REF,
      productReference_comment: `${WIDGET_EXT_NAME}.appex`,
      productType: '"com.apple.product-type.app-extension.widgets-extension"',
    };
    xcodeProject.hash.project.objects["PBXNativeTarget"][
      `${WE_TARGET_REF}_comment`
    ] = WIDGET_EXT_NAME;

    // Add target to project
    const project =
      xcodeProject.hash.project.objects["PBXProject"][
        "83CBB9F71A601CBA00E9B192"
      ];
    if (project && project.targets) {
      project.targets.push({
        value: WE_TARGET_REF,
        comment: WIDGET_EXT_NAME,
      });
    }

    // Add target attributes
    if (project && project.attributes && project.attributes.TargetAttributes) {
      project.attributes.TargetAttributes[WE_TARGET_REF] = {
        CreatedOnToolsVersion: "15.0",
        DevelopmentTeam: "P8T66U743T",
        ProvisioningStyle: "Automatic",
      };
    }

    console.log("✅ WidgetExtension target added to Xcode project");
    return config;
  });

  return config;
};

module.exports = withWidgetExtension;
