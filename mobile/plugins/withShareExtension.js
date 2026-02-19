const {
  withXcodeProject,
  withEntitlementsPlist,
  withInfoPlist,
} = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Expo config plugin to add an iOS Share Extension target to the Xcode project.
 *
 * This plugin:
 * 1. Adds the ShareExtension target and its files to the Xcode project
 * 2. Configures App Groups on both the main app and the extension
 * 3. Sets up the correct build settings for the extension
 */

const APP_GROUP_ID = "group.io.asphodel.app";
const SHARE_EXT_NAME = "ShareExtension";
const SHARE_EXT_BUNDLE_ID = "io.asphodel.app.ShareExtension";

// Deterministic UUIDs for Share Extension (so config plugin is idempotent)
const SE_PRODUCT_REF = "SHARE_EXT_PRODUCT_001";
const SE_FILE_REF_VC = "SHARE_EXT_VC_FILE_001";
const SE_FILE_REF_PLIST = "SHARE_EXT_PLIST_FILE1";
const SE_FILE_REF_ENTITLEMENTS = "SHARE_EXT_ENTL_FILE1";
const SE_BUILD_FILE_VC = "SHARE_EXT_VC_BUILD_01";
const SE_GROUP_REF = "SHARE_EXT_GROUP_0001";
const SE_TARGET_REF = "SHARE_EXT_TARGET_001";
const SE_SOURCES_PHASE = "SHARE_EXT_SRC_PHASE1";
const SE_RESOURCES_PHASE = "SHARE_EXT_RES_PHASE1";
const SE_FRAMEWORKS_PHASE = "SHARE_EXT_FRM_PHASE1";
const SE_CONFIG_LIST = "SHARE_EXT_CFG_LIST_1";
const SE_CONFIG_DEBUG = "SHARE_EXT_CFG_DEBUG1";
const SE_CONFIG_RELEASE = "SHARE_EXT_CFG_RELEAS";
const SE_DEPENDENCY = "SHARE_EXT_DEPEND_001";
const SE_CONTAINER_PROXY = "SHARE_EXT_PROXY_0001";
const SE_COPY_FILES_PHASE = "SHARE_EXT_COPY_FILE1";
const SE_COPY_BUILD_FILE = "SHARE_EXT_COPY_BLD_1";

const withShareExtension = (config) => {
  // Step 1: Add App Group to main app entitlements
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

  // Step 2: Add the Share Extension target to the Xcode project
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectRoot = config.modRequest.projectRoot;

    // Check if ShareExtension files exist
    const shareExtDir = path.join(projectRoot, "ios", SHARE_EXT_NAME);
    if (!fs.existsSync(shareExtDir)) {
      console.warn(`⚠️  ShareExtension directory not found at ${shareExtDir}`);
      return config;
    }

    // Check if target already exists
    const existingTarget = xcodeProject.pbxTargetByName(SHARE_EXT_NAME);
    if (existingTarget) {
      console.log("ℹ️  ShareExtension target already exists in Xcode project");
      return config;
    }

    const projectObj = xcodeProject.getFirstProject().firstProject;
    const mainTargetKey = xcodeProject.getFirstTarget().firstTarget.uuid;

    // Add file references
    xcodeProject.hash.project.objects["PBXFileReference"] =
      xcodeProject.hash.project.objects["PBXFileReference"] || {};
    const fileRefs = xcodeProject.hash.project.objects["PBXFileReference"];

    fileRefs[SE_FILE_REF_VC] = {
      isa: "PBXFileReference",
      lastKnownFileType: "sourcecode.swift",
      name: "ShareViewController.swift",
      path: `${SHARE_EXT_NAME}/ShareViewController.swift`,
      sourceTree: '"<group>"',
    };
    fileRefs[`${SE_FILE_REF_VC}_comment`] = "ShareViewController.swift";

    fileRefs[SE_FILE_REF_PLIST] = {
      isa: "PBXFileReference",
      lastKnownFileType: "text.plist.xml",
      name: "Info.plist",
      path: `${SHARE_EXT_NAME}/Info.plist`,
      sourceTree: '"<group>"',
    };
    fileRefs[`${SE_FILE_REF_PLIST}_comment`] = "Info.plist";

    fileRefs[SE_FILE_REF_ENTITLEMENTS] = {
      isa: "PBXFileReference",
      lastKnownFileType: "text.plist.entitlements",
      name: `${SHARE_EXT_NAME}.entitlements`,
      path: `${SHARE_EXT_NAME}/${SHARE_EXT_NAME}.entitlements`,
      sourceTree: '"<group>"',
    };
    fileRefs[`${SE_FILE_REF_ENTITLEMENTS}_comment`] =
      `${SHARE_EXT_NAME}.entitlements`;

    fileRefs[SE_PRODUCT_REF] = {
      isa: "PBXFileReference",
      explicitFileType: '"wrapper.app-extension"',
      includeInIndex: 0,
      path: `${SHARE_EXT_NAME}.appex`,
      sourceTree: "BUILT_PRODUCTS_DIR",
    };
    fileRefs[`${SE_PRODUCT_REF}_comment`] = `${SHARE_EXT_NAME}.appex`;

    // Add product to Products group
    const productsGroup = xcodeProject.pbxGroupByName("Products");
    if (productsGroup) {
      productsGroup.children.push({
        value: SE_PRODUCT_REF,
        comment: `${SHARE_EXT_NAME}.appex`,
      });
    }

    // Create ShareExtension group
    xcodeProject.hash.project.objects["PBXGroup"] =
      xcodeProject.hash.project.objects["PBXGroup"] || {};
    const groups = xcodeProject.hash.project.objects["PBXGroup"];

    groups[SE_GROUP_REF] = {
      isa: "PBXGroup",
      children: [
        { value: SE_FILE_REF_VC, comment: "ShareViewController.swift" },
        { value: SE_FILE_REF_PLIST, comment: "Info.plist" },
        {
          value: SE_FILE_REF_ENTITLEMENTS,
          comment: `${SHARE_EXT_NAME}.entitlements`,
        },
      ],
      name: `"${SHARE_EXT_NAME}"`,
      sourceTree: '"<group>"',
    };
    groups[`${SE_GROUP_REF}_comment`] = SHARE_EXT_NAME;

    // Add to main group
    const mainGroupKey = projectObj.mainGroup;
    if (groups[mainGroupKey]) {
      groups[mainGroupKey].children.push({
        value: SE_GROUP_REF,
        comment: SHARE_EXT_NAME,
      });
    }

    // Create build file for ShareViewController.swift
    xcodeProject.hash.project.objects["PBXBuildFile"] =
      xcodeProject.hash.project.objects["PBXBuildFile"] || {};
    const buildFiles = xcodeProject.hash.project.objects["PBXBuildFile"];

    buildFiles[SE_BUILD_FILE_VC] = {
      isa: "PBXBuildFile",
      fileRef: SE_FILE_REF_VC,
      fileRef_comment: "ShareViewController.swift",
    };
    buildFiles[`${SE_BUILD_FILE_VC}_comment`] =
      "ShareViewController.swift in Sources";

    // Create build file for embedding the extension
    buildFiles[SE_COPY_BUILD_FILE] = {
      isa: "PBXBuildFile",
      fileRef: SE_PRODUCT_REF,
      fileRef_comment: `${SHARE_EXT_NAME}.appex`,
      settings: { ATTRIBUTES: ["RemoveHeadersOnCopy"] },
    };
    buildFiles[`${SE_COPY_BUILD_FILE}_comment`] =
      `${SHARE_EXT_NAME}.appex in Embed App Extensions`;

    // Create build phases
    xcodeProject.hash.project.objects["PBXSourcesBuildPhase"] =
      xcodeProject.hash.project.objects["PBXSourcesBuildPhase"] || {};
    xcodeProject.hash.project.objects["PBXSourcesBuildPhase"][
      SE_SOURCES_PHASE
    ] = {
      isa: "PBXSourcesBuildPhase",
      buildActionMask: 2147483647,
      files: [
        {
          value: SE_BUILD_FILE_VC,
          comment: "ShareViewController.swift in Sources",
        },
      ],
      runOnlyForDeploymentPostprocessing: 0,
    };
    xcodeProject.hash.project.objects["PBXSourcesBuildPhase"][
      `${SE_SOURCES_PHASE}_comment`
    ] = "Sources";

    xcodeProject.hash.project.objects["PBXResourcesBuildPhase"] =
      xcodeProject.hash.project.objects["PBXResourcesBuildPhase"] || {};
    xcodeProject.hash.project.objects["PBXResourcesBuildPhase"][
      SE_RESOURCES_PHASE
    ] = {
      isa: "PBXResourcesBuildPhase",
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    xcodeProject.hash.project.objects["PBXResourcesBuildPhase"][
      `${SE_RESOURCES_PHASE}_comment`
    ] = "Resources";

    xcodeProject.hash.project.objects["PBXFrameworksBuildPhase"] =
      xcodeProject.hash.project.objects["PBXFrameworksBuildPhase"] || {};
    xcodeProject.hash.project.objects["PBXFrameworksBuildPhase"][
      SE_FRAMEWORKS_PHASE
    ] = {
      isa: "PBXFrameworksBuildPhase",
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    xcodeProject.hash.project.objects["PBXFrameworksBuildPhase"][
      `${SE_FRAMEWORKS_PHASE}_comment`
    ] = "Frameworks";

    // Create Copy Files (Embed App Extensions) build phase on main target
    xcodeProject.hash.project.objects["PBXCopyFilesBuildPhase"] =
      xcodeProject.hash.project.objects["PBXCopyFilesBuildPhase"] || {};
    xcodeProject.hash.project.objects["PBXCopyFilesBuildPhase"][
      SE_COPY_FILES_PHASE
    ] = {
      isa: "PBXCopyFilesBuildPhase",
      buildActionMask: 2147483647,
      dstPath: '""',
      dstSubfolderSpec: 13, // App Extensions
      files: [
        {
          value: SE_COPY_BUILD_FILE,
          comment: `${SHARE_EXT_NAME}.appex in Embed App Extensions`,
        },
      ],
      name: '"Embed App Extensions"',
      runOnlyForDeploymentPostprocessing: 0,
    };
    xcodeProject.hash.project.objects["PBXCopyFilesBuildPhase"][
      `${SE_COPY_FILES_PHASE}_comment`
    ] = "Embed App Extensions";

    // Add the copy files phase to the main target
    const mainTarget =
      xcodeProject.hash.project.objects["PBXNativeTarget"][mainTargetKey];
    if (mainTarget && mainTarget.buildPhases) {
      mainTarget.buildPhases.push({
        value: SE_COPY_FILES_PHASE,
        comment: "Embed App Extensions",
      });
    }

    // Create build configurations for the extension
    xcodeProject.hash.project.objects["XCBuildConfiguration"] =
      xcodeProject.hash.project.objects["XCBuildConfiguration"] || {};
    const buildConfigs =
      xcodeProject.hash.project.objects["XCBuildConfiguration"];

    const commonSettings = {
      CLANG_ENABLE_MODULES: "YES",
      CODE_SIGN_ENTITLEMENTS: `${SHARE_EXT_NAME}/${SHARE_EXT_NAME}.entitlements`,
      CODE_SIGN_STYLE: "Automatic",
      CURRENT_PROJECT_VERSION: 1,
      DEVELOPMENT_TEAM: "P8T66U743T",
      GENERATE_INFOPLIST_FILE: "NO",
      INFOPLIST_FILE: `${SHARE_EXT_NAME}/Info.plist`,
      IPHONEOS_DEPLOYMENT_TARGET: "15.1",
      LD_RUNPATH_SEARCH_PATHS: [
        '"$(inherited)"',
        '"@executable_path/Frameworks"',
        '"@executable_path/../../Frameworks"',
      ],
      MARKETING_VERSION: "1.0",
      PRODUCT_BUNDLE_IDENTIFIER: `"${SHARE_EXT_BUNDLE_ID}"`,
      PRODUCT_NAME: `"$(TARGET_NAME)"`,
      SKIP_INSTALL: "YES",
      SWIFT_VERSION: "5.0",
      TARGETED_DEVICE_FAMILY: '"1,2"',
    };

    buildConfigs[SE_CONFIG_DEBUG] = {
      isa: "XCBuildConfiguration",
      buildSettings: {
        ...commonSettings,
        DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"',
        SWIFT_ACTIVE_COMPILATION_CONDITIONS: "DEBUG",
        SWIFT_OPTIMIZATION_LEVEL: '"-Onone"',
      },
      name: "Debug",
    };
    buildConfigs[`${SE_CONFIG_DEBUG}_comment`] = "Debug";

    buildConfigs[SE_CONFIG_RELEASE] = {
      isa: "XCBuildConfiguration",
      buildSettings: {
        ...commonSettings,
        COPY_PHASE_STRIP: "NO",
        DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"',
      },
      name: "Release",
    };
    buildConfigs[`${SE_CONFIG_RELEASE}_comment`] = "Release";

    // Create configuration list
    xcodeProject.hash.project.objects["XCConfigurationList"] =
      xcodeProject.hash.project.objects["XCConfigurationList"] || {};
    xcodeProject.hash.project.objects["XCConfigurationList"][SE_CONFIG_LIST] = {
      isa: "XCConfigurationList",
      buildConfigurations: [
        { value: SE_CONFIG_DEBUG, comment: "Debug" },
        { value: SE_CONFIG_RELEASE, comment: "Release" },
      ],
      defaultConfigurationIsVisible: 0,
      defaultConfigurationName: "Release",
    };
    xcodeProject.hash.project.objects["XCConfigurationList"][
      `${SE_CONFIG_LIST}_comment`
    ] = `Build configuration list for PBXNativeTarget "${SHARE_EXT_NAME}"`;

    // Create container item proxy (dependency)
    xcodeProject.hash.project.objects["PBXContainerItemProxy"] =
      xcodeProject.hash.project.objects["PBXContainerItemProxy"] || {};
    xcodeProject.hash.project.objects["PBXContainerItemProxy"][
      SE_CONTAINER_PROXY
    ] = {
      isa: "PBXContainerItemProxy",
      containerPortal: "83CBB9F71A601CBA00E9B192",
      containerPortal_comment: "Project object",
      proxyType: 1,
      remoteGlobalIDString: SE_TARGET_REF,
      remoteInfo: `"${SHARE_EXT_NAME}"`,
    };
    xcodeProject.hash.project.objects["PBXContainerItemProxy"][
      `${SE_CONTAINER_PROXY}_comment`
    ] = "PBXContainerItemProxy";

    // Create target dependency
    xcodeProject.hash.project.objects["PBXTargetDependency"] =
      xcodeProject.hash.project.objects["PBXTargetDependency"] || {};
    xcodeProject.hash.project.objects["PBXTargetDependency"][SE_DEPENDENCY] = {
      isa: "PBXTargetDependency",
      target: SE_TARGET_REF,
      target_comment: SHARE_EXT_NAME,
      targetProxy: SE_CONTAINER_PROXY,
      targetProxy_comment: "PBXContainerItemProxy",
    };
    xcodeProject.hash.project.objects["PBXTargetDependency"][
      `${SE_DEPENDENCY}_comment`
    ] = "PBXTargetDependency";

    // Add dependency to main target
    if (mainTarget) {
      if (!mainTarget.dependencies) {
        mainTarget.dependencies = [];
      }
      mainTarget.dependencies.push({
        value: SE_DEPENDENCY,
        comment: "PBXTargetDependency",
      });
    }

    // Create the native target
    xcodeProject.hash.project.objects["PBXNativeTarget"] =
      xcodeProject.hash.project.objects["PBXNativeTarget"] || {};
    xcodeProject.hash.project.objects["PBXNativeTarget"][SE_TARGET_REF] = {
      isa: "PBXNativeTarget",
      buildConfigurationList: SE_CONFIG_LIST,
      buildConfigurationList_comment: `Build configuration list for PBXNativeTarget "${SHARE_EXT_NAME}"`,
      buildPhases: [
        { value: SE_SOURCES_PHASE, comment: "Sources" },
        { value: SE_FRAMEWORKS_PHASE, comment: "Frameworks" },
        { value: SE_RESOURCES_PHASE, comment: "Resources" },
      ],
      buildRules: [],
      dependencies: [],
      name: `"${SHARE_EXT_NAME}"`,
      productName: `"${SHARE_EXT_NAME}"`,
      productReference: SE_PRODUCT_REF,
      productReference_comment: `${SHARE_EXT_NAME}.appex`,
      productType: '"com.apple.product-type.app-extension"',
    };
    xcodeProject.hash.project.objects["PBXNativeTarget"][
      `${SE_TARGET_REF}_comment`
    ] = SHARE_EXT_NAME;

    // Add target to project
    const project =
      xcodeProject.hash.project.objects["PBXProject"][
        "83CBB9F71A601CBA00E9B192"
      ];
    if (project && project.targets) {
      project.targets.push({
        value: SE_TARGET_REF,
        comment: SHARE_EXT_NAME,
      });
    }

    // Add target attributes
    if (project && project.attributes && project.attributes.TargetAttributes) {
      project.attributes.TargetAttributes[SE_TARGET_REF] = {
        CreatedOnToolsVersion: "15.0",
        DevelopmentTeam: "P8T66U743T",
        ProvisioningStyle: "Automatic",
      };
    }

    console.log("✅ ShareExtension target added to Xcode project");
    return config;
  });

  return config;
};

module.exports = withShareExtension;
