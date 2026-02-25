//
//  ProfileBridgeModule.swift
//  NativeProfileView
//
//  Created by Claude Code
//  Bridge module for passing profile data from React Native to Swift
//

import ExpoModulesCore
import CoreSpotlight
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
                defer { self.profileDataLock.unlock() }
                self.currentProfileData = profileData

                // Post notification for SwiftUI views to observe
                NotificationCenter.default.post(
                    name: ProfileBridgeModule.profileDataUpdatedNotification,
                    object: nil,
                    userInfo: ["profileData": profileData]
                )

                // Index viewed profile in CoreSpotlight
                ProfileSpotlightIndexer.shared.indexProfile(profileData)
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
                defer { self.profileDataLock.unlock() }
                self.currentStarterPacks = packs

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
                defer { self.profileDataLock.unlock() }
                self.currentPinnedPost = pinnedPost

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
            defer { self.profileDataLock.unlock() }
            self.currentProfileData = nil
            self.currentStarterPacks = nil
            self.currentPinnedPost = nil

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
