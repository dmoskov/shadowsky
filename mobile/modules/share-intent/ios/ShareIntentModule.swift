//
// ShareIntentModule.swift
// Share Intent Module
//
// Expo Module for reading shared content from the iOS Share Extension via App Group
//

import ExpoModulesCore
import Foundation

public class ShareIntentModule: Module {
    private let appGroupId = "group.io.asphodel.app"

    public func definition() -> ModuleDefinition {
        Name("ShareIntent")

        // Get shared content saved by the Share Extension
        Function("getSharedContent") { () -> [String: Any]? in
            guard let userDefaults = UserDefaults(suiteName: self.appGroupId) else {
                return nil
            }

            guard let sharedData = userDefaults.dictionary(forKey: "SharedContent") else {
                return nil
            }

            // Check if the shared content is recent (within 5 minutes)
            if let timestamp = sharedData["timestamp"] as? TimeInterval {
                let age = Date().timeIntervalSince1970 - timestamp
                if age > 300 { // 5 minutes
                    // Stale content, clear it
                    userDefaults.removeObject(forKey: "SharedContent")
                    userDefaults.synchronize()
                    return nil
                }
            }

            return sharedData
        }

        // Clear shared content after it has been consumed
        Function("clearSharedContent") { () in
            guard let userDefaults = UserDefaults(suiteName: self.appGroupId) else {
                return
            }
            userDefaults.removeObject(forKey: "SharedContent")
            userDefaults.synchronize()

            // Also clean up shared images
            self.cleanupSharedImages()
        }

        // Get the full file path for a shared image filename
        Function("getSharedImagePath") { (filename: String) -> String? in
            guard let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: self.appGroupId
            ) else {
                return nil
            }

            let imagePath = containerURL
                .appendingPathComponent("shared-images", isDirectory: true)
                .appendingPathComponent(filename)

            if FileManager.default.fileExists(atPath: imagePath.path) {
                return imagePath.absoluteString
            }

            return nil
        }
    }

    private func cleanupSharedImages() {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else {
            return
        }

        let sharedImagesDir = containerURL.appendingPathComponent("shared-images", isDirectory: true)
        try? FileManager.default.removeItem(at: sharedImagesDir)
    }
}
