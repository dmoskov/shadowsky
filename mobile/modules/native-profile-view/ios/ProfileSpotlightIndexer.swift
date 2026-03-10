//
//  ProfileSpotlightIndexer.swift
//  NativeProfileView
//
//  Indexes viewed profiles in CoreSpotlight for iOS Spotlight search.
//  Only profiles the user actually opens (not seen in feed) are indexed.
//

import CoreSpotlight
import MobileCoreServices
import UniformTypeIdentifiers
import Foundation

final class ProfileSpotlightIndexer {

    static let shared = ProfileSpotlightIndexer()

    private let domainIdentifier = "is.asphodel.profile"

    private init() {}

    // MARK: - Public API

    /// Index a profile that was viewed by the user.
    /// Updates the existing entry if the profile was previously indexed.
    func indexProfile(_ profile: SerializedProfile) {
        guard CSSearchableIndex.isIndexingAvailable() else { return }

        let displayName = profile.displayName.orIfEmpty(profile.handle)
        let uniqueIdentifier = "bsky-profile-\(profile.did)"

        let attributeSet = CSSearchableItemAttributeSet(contentType: UTType.contact)
        attributeSet.title = displayName
        attributeSet.displayName = displayName
        attributeSet.contentDescription = buildContentDescription(profile: profile)
        attributeSet.supportsNavigation = true
        attributeSet.creator = profile.handle

        // Accessibility: include both display name and handle in keywords
        attributeSet.keywords = [
            displayName,
            profile.handle,
            "@\(profile.handle)",
            "profile",
            "bluesky"
        ]

        // Deep link: shadowsky://profile/{handle}
        attributeSet.url = URL(string: "shadowsky://profile/\(profile.handle)")

        // Set thumbnail from avatar URL if available
        if let avatarURLString = profile.avatar, let avatarURL = URL(string: avatarURLString) {
            loadThumbnailData(from: avatarURL) { [weak self] data in
                guard self != nil else { return }
                if let data = data {
                    attributeSet.thumbnailData = data
                }
                self?.commitIndexItem(
                    uniqueIdentifier: uniqueIdentifier,
                    attributeSet: attributeSet
                )
            }
        } else {
            commitIndexItem(
                uniqueIdentifier: uniqueIdentifier,
                attributeSet: attributeSet
            )
        }
    }

    /// Remove a specific profile from the Spotlight index.
    func removeProfile(did: String) {
        let uniqueIdentifier = "bsky-profile-\(did)"
        CSSearchableIndex.default().deleteSearchableItems(
            withIdentifiers: [uniqueIdentifier]
        ) { error in
            if let error = error {
                NSLog("[ProfileSpotlightIndexer] Failed to remove profile: \(error.localizedDescription)")
            }
        }
    }

    /// Remove all indexed profiles.
    func removeAllProfiles() {
        CSSearchableIndex.default().deleteSearchableItems(
            withDomainIdentifiers: [domainIdentifier]
        ) { error in
            if let error = error {
                NSLog("[ProfileSpotlightIndexer] Failed to remove all profiles: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Private Helpers

    private func buildContentDescription(profile: SerializedProfile) -> String {
        var parts: [String] = ["@\(profile.handle)"]
        if let bio = profile.description, !bio.isEmpty {
            parts.append(bio)
        }
        return parts.joined(separator: " — ")
    }

    private func commitIndexItem(
        uniqueIdentifier: String,
        attributeSet: CSSearchableItemAttributeSet
    ) {
        let item = CSSearchableItem(
            uniqueIdentifier: uniqueIdentifier,
            domainIdentifier: domainIdentifier,
            attributeSet: attributeSet
        )
        // Expire after 30 days
        item.expirationDate = Date().addingTimeInterval(30 * 24 * 60 * 60)

        CSSearchableIndex.default().indexSearchableItems([item]) { error in
            if let error = error {
                NSLog("[ProfileSpotlightIndexer] Failed to index profile \(uniqueIdentifier): \(error.localizedDescription)")
            }
        }
    }

    /// Download avatar image data for thumbnail.
    /// Uses URLSession with a short timeout to avoid blocking.
    private func loadThumbnailData(from url: URL, completion: @escaping (Data?) -> Void) {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForResource = 5
        config.requestCachePolicy = .returnCacheDataElseLoad
        let session = URLSession(configuration: config)

        session.dataTask(with: url) { data, response, error in
            guard error == nil,
                  let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200,
                  let data = data else {
                completion(nil)
                return
            }
            completion(data)
        }.resume()
    }
}
