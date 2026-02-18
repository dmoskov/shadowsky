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
    // Shared data stores
    private var currentProfileData: SerializedProfile?
    private var currentStarterPacks: [SerializedStarterPack]?
    private var currentPinnedPost: SerializedPinnedPost?
    private var profileDataLock = NSLock()

    // Notification names for data updates
    public static let profileDataUpdatedNotification = Notification.Name("ProfileBridgeDataUpdated")
    public static let profileDataClearedNotification = Notification.Name("ProfileBridgeDataCleared")
    public static let starterPacksUpdatedNotification = Notification.Name("ProfileBridgeStarterPacksUpdated")
    public static let pinnedPostUpdatedNotification = Notification.Name("ProfileBridgePinnedPostUpdated")

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

        // Update starter packs data
        Function("updateStarterPacks") { (jsonData: String) in
            do {
                let packs = try SerializedStarterPack.decodeArray(from: jsonData)

                self.profileDataLock.lock()
                self.currentStarterPacks = packs
                self.profileDataLock.unlock()

                NotificationCenter.default.post(
                    name: ProfileBridgeModule.starterPacksUpdatedNotification,
                    object: nil,
                    userInfo: ["starterPacks": packs]
                )
            } catch {
                print("[ProfileBridge] Failed to decode starter packs: \(error)")
                throw error
            }
        }

        // Update pinned post data
        Function("updatePinnedPost") { (jsonData: String) in
            do {
                let pinnedPost = try SerializedPinnedPost.decode(from: jsonData)

                self.profileDataLock.lock()
                self.currentPinnedPost = pinnedPost
                self.profileDataLock.unlock()

                NotificationCenter.default.post(
                    name: ProfileBridgeModule.pinnedPostUpdatedNotification,
                    object: nil,
                    userInfo: ["pinnedPost": pinnedPost]
                )
            } catch {
                print("[ProfileBridge] Failed to decode pinned post: \(error)")
                throw error
            }
        }

        // Clear all profile data
        Function("clearProfileData") {
            self.profileDataLock.lock()
            self.currentProfileData = nil
            self.currentStarterPacks = nil
            self.currentPinnedPost = nil
            self.profileDataLock.unlock()

            NotificationCenter.default.post(
                name: ProfileBridgeModule.profileDataClearedNotification,
                object: nil
            )
        }
    }

    // Public accessors (thread-safe)
    public func getCurrentProfileData() -> SerializedProfile? {
        profileDataLock.lock()
        defer { profileDataLock.unlock() }
        return currentProfileData
    }

    public func getCurrentStarterPacks() -> [SerializedStarterPack]? {
        profileDataLock.lock()
        defer { profileDataLock.unlock() }
        return currentStarterPacks
    }

    public func getCurrentPinnedPost() -> SerializedPinnedPost? {
        profileDataLock.lock()
        defer { profileDataLock.unlock() }
        return currentPinnedPost
    }
}
