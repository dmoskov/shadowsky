const { withXcodeProject, withEntitlementsPlist } = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

/**
 * Config plugin to add iOS Share Extension target
 * This allows users to share URLs and text from other apps (Safari, etc.) into Asphodel
 *
 * The extension will:
 * - Accept URLs and text from the iOS share sheet
 * - Open the main app with a deep link to the compose screen
 * - Pre-fill the compose screen with the shared content
 */
const withShareExtension = (config) => {
  // Add app groups to main app entitlements
  config = withEntitlementsPlist(config, (config) => {
    if (!config.modResults["com.apple.security.application-groups"]) {
      config.modResults["com.apple.security.application-groups"] = [];
    }

    const appGroups = config.modResults["com.apple.security.application-groups"];
    const groupId = "group.io.shadowsky.app";

    if (!appGroups.includes(groupId)) {
      appGroups.push(groupId);
    }

    return config;
  });

  // Add the Share Extension target to Xcode project
  config = withXcodeProject(config, async (config) => {
    const { modResults, projectRoot } = config;
    const xcodeProject = modResults;

    const targetName = "ShareExtension";
    const bundleIdentifier = "io.shadowsky.app.ShareExtension";

    // Check if target already exists
    const targets = xcodeProject.hash.project.objects.PBXNativeTarget;
    const existingTarget = Object.values(targets).find(
      (target) => target.name === targetName
    );

    if (existingTarget) {
      console.log("ℹ️  ShareExtension target already exists in Xcode project");
      return config;
    }

    console.log("✅ Adding ShareExtension target to Xcode project");

    // Get the main app target for reference
    const mainTarget = xcodeProject.getFirstTarget();
    const mainTargetUuid = mainTarget.uuid;

    // Create the extension target
    const targetUuid = xcodeProject.generateUuid();
    const targetProductUuid = xcodeProject.generateUuid();

    // Add native target
    xcodeProject.addTarget(
      targetName,
      "app_extension",
      targetName,
      bundleIdentifier
    );

    // Get the newly created target
    const newTarget = xcodeProject.hash.project.objects.PBXNativeTarget[targetUuid] ||
                      Object.values(xcodeProject.hash.project.objects.PBXNativeTarget).find(
                        (target) => target.name === targetName
                      );

    if (!newTarget) {
      console.warn("⚠️  Could not find newly created ShareExtension target");
      return config;
    }

    // Add source files to the target
    const sourceFiles = [
      "ShareExtension/ShareViewController.swift",
    ];

    sourceFiles.forEach((filePath) => {
      const fullPath = path.join(projectRoot, "ios", filePath);
      if (fs.existsSync(fullPath)) {
        xcodeProject.addSourceFile(filePath, {}, targetName);
      }
    });

    // Add resources to the target
    const resourceFiles = [
      "ShareExtension/MainInterface.storyboard",
      "ShareExtension/Info.plist",
    ];

    resourceFiles.forEach((filePath) => {
      const fullPath = path.join(projectRoot, "ios", filePath);
      if (fs.existsSync(fullPath)) {
        xcodeProject.addResourceFile(filePath, {}, targetName);
      }
    });

    // Add the extension as a dependency of the main app
    const containerItemProxyUuid = xcodeProject.generateUuid();
    const targetDependencyUuid = xcodeProject.generateUuid();

    // Create container item proxy
    if (!xcodeProject.hash.project.objects.PBXContainerItemProxy) {
      xcodeProject.hash.project.objects.PBXContainerItemProxy = {};
    }

    xcodeProject.hash.project.objects.PBXContainerItemProxy[containerItemProxyUuid] = {
      isa: "PBXContainerItemProxy",
      containerPortal: xcodeProject.hash.project.rootObject,
      proxyType: 1,
      remoteGlobalIDString: newTarget.isa === "PBXNativeTarget" ? targetUuid : newTarget.uuid || targetUuid,
      remoteInfo: targetName,
    };

    // Create target dependency
    if (!xcodeProject.hash.project.objects.PBXTargetDependency) {
      xcodeProject.hash.project.objects.PBXTargetDependency = {};
    }

    xcodeProject.hash.project.objects.PBXTargetDependency[targetDependencyUuid] = {
      isa: "PBXTargetDependency",
      target: newTarget.isa === "PBXNativeTarget" ? targetUuid : newTarget.uuid || targetUuid,
      targetProxy: containerItemProxyUuid,
    };

    // Add dependency to main target
    const mainTargetObj = xcodeProject.hash.project.objects.PBXNativeTarget[mainTargetUuid];
    if (!mainTargetObj.dependencies) {
      mainTargetObj.dependencies = [];
    }
    mainTargetObj.dependencies.push({
      value: targetDependencyUuid,
      comment: targetName,
    });

    // Copy the extension to the main app's bundle
    const copyFilesUuid = xcodeProject.generateUuid();
    const buildFileUuid = xcodeProject.generateUuid();

    // Add build file
    if (!xcodeProject.hash.project.objects.PBXBuildFile) {
      xcodeProject.hash.project.objects.PBXBuildFile = {};
    }

    const extensionProduct = Object.values(xcodeProject.hash.project.objects.PBXFileReference).find(
      (file) => file.path && file.path.includes(targetName) && file.path.endsWith(".appex")
    );

    if (extensionProduct) {
      xcodeProject.hash.project.objects.PBXBuildFile[buildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: Object.keys(xcodeProject.hash.project.objects.PBXFileReference).find(
          (key) => xcodeProject.hash.project.objects.PBXFileReference[key] === extensionProduct
        ),
        settings: {
          ATTRIBUTES: ["RemoveHeadersOnCopy"],
        },
      };
    }

    // Add copy files build phase
    if (!xcodeProject.hash.project.objects.PBXCopyFilesBuildPhase) {
      xcodeProject.hash.project.objects.PBXCopyFilesBuildPhase = {};
    }

    xcodeProject.hash.project.objects.PBXCopyFilesBuildPhase[copyFilesUuid] = {
      isa: "PBXCopyFilesBuildPhase",
      buildActionMask: 2147483647,
      dstPath: "",
      dstSubfolderSpec: 13, // PlugIns
      files: extensionProduct ? [{ value: buildFileUuid, comment: `${targetName}.appex` }] : [],
      name: "Embed App Extensions",
      runOnlyForDeploymentPostprocessing: 0,
    };

    // Add copy files phase to main target
    if (!mainTargetObj.buildPhases) {
      mainTargetObj.buildPhases = [];
    }
    mainTargetObj.buildPhases.push({
      value: copyFilesUuid,
      comment: "Embed App Extensions",
    });

    console.log("✅ ShareExtension target configured successfully");
    return config;
  });

  return config;
};

module.exports = withShareExtension;
