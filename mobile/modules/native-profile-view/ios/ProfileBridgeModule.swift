//
//  ProfileBridgeModule.swift
//  NativeProfileView
//
//  Created by Claude Code
//  Bridge module for passing profile data from React Native to Swift
//

import ExpoModulesCore
import Foundation

public class ProfileBridgeModule: Module {
    // Shared profile data store
    private var currentProfileData: SerializedProfile?
    private var profileDataLock = NSLock()

    // Notification names for profile updates
    public static let profileDataUpdatedNotification = Notification.Name("ProfileBridgeDataUpdated")
    public static let profileDataClearedNotification = Notification.Name("ProfileBridgeDataCleared")

    public func definition() -> ModuleDefinition {
        Name("ProfileBridge")

        // Update profile data with serialized data
        Function("updateProfileData") { (jsonData: String) in
            do {
                let profileData = try SerializedProfile.decode(from: jsonData)

                self.profileDataLock.lock()
                self.currentProfileData = profileData
                self.profileDataLock.unlock()

                // Post notification for SwiftUI views to observe
                NotificationCenter.default.post(
                    name: ProfileBridgeModule.profileDataUpdatedNotification,
                    object: nil,
                    userInfo: ["profileData": profileData]
                )
            } catch {
                print("[ProfileBridge] Failed to decode profile data: \(error)")
                throw error
            }
        }

        // Clear profile data
        Function("clearProfileData") {
            self.profileDataLock.lock()
            self.currentProfileData = nil
            self.profileDataLock.unlock()

            NotificationCenter.default.post(
                name: ProfileBridgeModule.profileDataClearedNotification,
                object: nil
            )
        }
    }

    // Public accessor for current profile data (thread-safe)
    public func getCurrentProfileData() -> SerializedProfile? {
        profileDataLock.lock()
        defer { profileDataLock.unlock() }
        return currentProfileData
    }
}
