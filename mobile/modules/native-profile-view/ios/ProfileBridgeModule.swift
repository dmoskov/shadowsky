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

    // Static shared storage so SwiftUI views can read existing data
    // even if they start observing after the notification was posted
    private static var sharedLock = NSLock()
    private static var sharedProfileData: SerializedProfile?
    private static var sharedStarterPacks: [SerializedStarterPack]?
    private static var sharedPinnedPost: SerializedPinnedPost?

    /// Thread-safe access to the most recent profile data
    public static func getSharedProfileData() -> SerializedProfile? {
        sharedLock.lock()
        defer { sharedLock.unlock() }
        return sharedProfileData
    }

    /// Thread-safe access to the most recent starter packs
    public static func getSharedStarterPacks() -> [SerializedStarterPack]? {
        sharedLock.lock()
        defer { sharedLock.unlock() }
        return sharedStarterPacks
    }

    /// Thread-safe access to the most recent pinned post
    public static func getSharedPinnedPost() -> SerializedPinnedPost? {
        sharedLock.lock()
        defer { sharedLock.unlock() }
        return sharedPinnedPost
    }

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

                // Update static shared storage
                ProfileBridgeModule.sharedLock.lock()
                ProfileBridgeModule.sharedProfileData = profileData
                ProfileBridgeModule.sharedLock.unlock()

                // Post notification for SwiftUI views to observe
                NotificationCenter.default.post(
                    name: ProfileBridgeModule.profileDataUpdatedNotification,
                    object: nil,
                    userInfo: ["profileData": profileData]
                )

                // Index viewed profile in CoreSpotlight
                ProfileSpotlightIndexer.shared.indexProfile(profileData)
            } catch {
                #if DEBUG
                print("[ProfileBridge] Failed to decode profile data: \(error)")
                #endif
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

                ProfileBridgeModule.sharedLock.lock()
                ProfileBridgeModule.sharedStarterPacks = packs
                ProfileBridgeModule.sharedLock.unlock()

                NotificationCenter.default.post(
                    name: ProfileBridgeModule.starterPacksUpdatedNotification,
                    object: nil,
                    userInfo: ["starterPacks": packs]
                )
            } catch {
                #if DEBUG
                print("[ProfileBridge] Failed to decode starter packs: \(error)")
                #endif
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

                ProfileBridgeModule.sharedLock.lock()
                ProfileBridgeModule.sharedPinnedPost = pinnedPost
                ProfileBridgeModule.sharedLock.unlock()

                NotificationCenter.default.post(
                    name: ProfileBridgeModule.pinnedPostUpdatedNotification,
                    object: nil,
                    userInfo: ["pinnedPost": pinnedPost]
                )
            } catch {
                #if DEBUG
                print("[ProfileBridge] Failed to decode pinned post: \(error)")
                #endif
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

            ProfileBridgeModule.sharedLock.lock()
            ProfileBridgeModule.sharedProfileData = nil
            ProfileBridgeModule.sharedStarterPacks = nil
            ProfileBridgeModule.sharedPinnedPost = nil
            ProfileBridgeModule.sharedLock.unlock()

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
