//
// SpotlightSearchModule.swift
// Spotlight Search Module
//
// Expo Module for indexing profiles and posts in iOS Spotlight via CoreSpotlight
//

import ExpoModulesCore
import CoreSpotlight
import MobileCoreServices
import UniformTypeIdentifiers

public class SpotlightSearchModule: Module {
    private let domainProfile = "io.shadowsky.profile"
    private let domainPost = "io.shadowsky.post"
    private let maxIndexedItems = 500

    public func definition() -> ModuleDefinition {
        Name("SpotlightSearch")

        Function("isAvailable") { () -> Bool in
            return CSSearchableIndex.isIndexingAvailable()
        }

        // Index a profile in Spotlight
        Function("indexProfile") { (data: [String: Any]) in
            guard CSSearchableIndex.isIndexingAvailable() else { return }

            let handle = data["handle"] as? String ?? ""
            let displayName = data["displayName"] as? String ?? handle
            let description = data["description"] as? String ?? ""
            let avatarUrl = data["avatarUrl"] as? String
            let did = data["did"] as? String ?? ""

            let attributeSet = CSSearchableItemAttributeSet(contentType: UTType.contact)
            attributeSet.title = displayName
            attributeSet.contentDescription = "@\(handle)\(description.isEmpty ? "" : " — \(description)")"
            attributeSet.displayName = displayName
            attributeSet.relatedUniqueIdentifier = "profile:\(handle)"

            // Download and set thumbnail if avatar URL provided
            if let urlString = avatarUrl, let url = URL(string: urlString) {
                attributeSet.thumbnailURL = url
            }

            // Build deep link URI: shadowsky://profile/{handle}
            attributeSet.url = URL(string: "shadowsky://profile/\(handle)")

            // Custom keywords for search
            attributeSet.keywords = [handle, displayName, "profile", "bluesky"]

            let uniqueId = "profile:\(handle)"
            let item = CSSearchableItem(
                uniqueIdentifier: uniqueId,
                domainIdentifier: self.domainProfile,
                attributeSet: attributeSet
            )
            // Items expire after 30 days
            item.expirationDate = Date().addingTimeInterval(30 * 24 * 60 * 60)

            CSSearchableIndex.default().indexSearchableItems([item]) { error in
                if let error = error {
                    NSLog("[SpotlightSearch] Failed to index profile \(handle): \(error.localizedDescription)")
                }
            }

            // Enforce max item limit
            self.enforceItemLimit()
        }

        // Index a post in Spotlight
        Function("indexPost") { (data: [String: Any]) in
            guard CSSearchableIndex.isIndexingAvailable() else { return }

            let uri = data["uri"] as? String ?? ""
            let text = data["text"] as? String ?? ""
            let authorHandle = data["authorHandle"] as? String ?? ""
            let authorName = data["authorName"] as? String ?? authorHandle
            let avatarUrl = data["avatarUrl"] as? String
            let rkey = data["rkey"] as? String ?? ""

            let attributeSet = CSSearchableItemAttributeSet(contentType: UTType.text)
            attributeSet.title = "\(authorName)'s post"
            attributeSet.contentDescription = text
            attributeSet.displayName = "\(authorName) (@\(authorHandle))"

            if let urlString = avatarUrl, let url = URL(string: urlString) {
                attributeSet.thumbnailURL = url
            }

            // Deep link: shadowsky://post/{handle}/{rkey}
            attributeSet.url = URL(string: "shadowsky://post/\(authorHandle)/\(rkey)")

            attributeSet.keywords = [authorHandle, authorName, "post", "bluesky"]

            let uniqueId = "post:\(uri)"
            let item = CSSearchableItem(
                uniqueIdentifier: uniqueId,
                domainIdentifier: self.domainPost,
                attributeSet: attributeSet
            )
            item.expirationDate = Date().addingTimeInterval(14 * 24 * 60 * 60) // 14 days for posts

            CSSearchableIndex.default().indexSearchableItems([item]) { error in
                if let error = error {
                    NSLog("[SpotlightSearch] Failed to index post: \(error.localizedDescription)")
                }
            }

            self.enforceItemLimit()
        }

        // Remove a specific item from the index
        Function("removeItem") { (identifier: String) in
            CSSearchableIndex.default().deleteSearchableItems(
                withIdentifiers: [identifier]
            ) { error in
                if let error = error {
                    NSLog("[SpotlightSearch] Failed to remove item: \(error.localizedDescription)")
                }
            }
        }

        // Remove all indexed items
        Function("removeAllItems") { () in
            CSSearchableIndex.default().deleteAllSearchableItems { error in
                if let error = error {
                    NSLog("[SpotlightSearch] Failed to remove all items: \(error.localizedDescription)")
                }
            }
        }

        // Get approximate count of indexed items (from UserDefaults tracker)
        Function("getIndexedCount") { () -> Int in
            return UserDefaults.standard.integer(forKey: "spotlightIndexedCount")
        }
    }

    /// Enforce the maximum item limit by deleting oldest domain items
    /// when the tracked count exceeds the max.
    private func enforceItemLimit() {
        let defaults = UserDefaults.standard
        var count = defaults.integer(forKey: "spotlightIndexedCount")
        count += 1
        defaults.set(count, forKey: "spotlightIndexedCount")

        if count > maxIndexedItems {
            // Delete older post items first (profiles are more valuable to keep)
            CSSearchableIndex.default().deleteSearchableItems(
                withDomainIdentifiers: [domainPost]
            ) { error in
                if error == nil {
                    // Reset count — profiles remain, posts cleared
                    let profileCount = defaults.integer(forKey: "spotlightProfileCount")
                    defaults.set(profileCount, forKey: "spotlightIndexedCount")
                }
            }
        }
    }
}
