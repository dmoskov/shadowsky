//
//  ThreadSpotlightIndexer.swift
//  NativeThreadView
//
//  Indexes viewed threads in CoreSpotlight for iOS Spotlight search.
//  Only threads the user actually opens and views for >2 seconds are indexed.
//

import CoreSpotlight
import UniformTypeIdentifiers
import Foundation

final class ThreadSpotlightIndexer {

    static let shared = ThreadSpotlightIndexer()

    private let domainIdentifier = "io.shadowsky.thread"

    private init() {}

    // MARK: - Public API

    /// Index a thread's root post that was viewed by the user.
    /// Updates the existing entry if the thread was previously indexed.
    func indexThread(rootPost: ThreadPost) {
        guard CSSearchableIndex.isIndexingAvailable() else { return }

        let authorName = rootPost.author.displayName ?? rootPost.author.handle
        let postText = rootPost.record.text
        let uniqueIdentifier = "bsky-thread-\(rootPost.uri)"

        let attributeSet = CSSearchableItemAttributeSet(contentType: UTType.text)

        // Title: author handle + truncated post text
        let truncatedText = postText.count > 80
            ? String(postText.prefix(80)) + "…"
            : postText
        attributeSet.title = "\(authorName): \(truncatedText)"

        // Full post text as content description
        attributeSet.contentDescription = postText

        // Metadata
        attributeSet.creator = rootPost.author.handle
        attributeSet.displayName = "\(authorName) (@\(rootPost.author.handle))"
        attributeSet.supportsNavigation = true

        // Parse creation date from ISO8601 string
        if let creationDate = parseISO8601Date(rootPost.record.createdAt) {
            attributeSet.contentCreationDate = creationDate
        }

        // Accessibility: include meaningful keywords for search
        attributeSet.keywords = [
            authorName,
            rootPost.author.handle,
            "@\(rootPost.author.handle)",
            "thread",
            "post",
            "bluesky"
        ]

        // Deep link: shadowsky://thread/{did}/{rkey}
        if let deepLinkURL = buildDeepLinkURL(uri: rootPost.uri) {
            attributeSet.url = deepLinkURL
        }

        // Set thumbnail from avatar URL if available
        if let avatarURLString = rootPost.author.avatar,
           let avatarURL = URL(string: avatarURLString) {
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

    /// Remove a specific thread from the Spotlight index.
    func removeThread(uri: String) {
        let uniqueIdentifier = "bsky-thread-\(uri)"
        CSSearchableIndex.default().deleteSearchableItems(
            withIdentifiers: [uniqueIdentifier]
        ) { error in
            if let error = error {
                NSLog("[ThreadSpotlightIndexer] Failed to remove thread: \(error.localizedDescription)")
            }
        }
    }

    /// Remove all indexed threads.
    func removeAllThreads() {
        CSSearchableIndex.default().deleteSearchableItems(
            withDomainIdentifiers: [domainIdentifier]
        ) { error in
            if let error = error {
                NSLog("[ThreadSpotlightIndexer] Failed to remove all threads: \(error.localizedDescription)")
            }
        }
    }

    // MARK: - Private Helpers

    private func buildDeepLinkURL(uri: String) -> URL? {
        // AT URI format: at://did:plc:xxx/app.bsky.feed.post/rkey
        let parts = uri.split(separator: "/")
        // parts: ["at:", "", "did:plc:xxx", "app.bsky.feed.post", "rkey"]
        guard parts.count >= 5 else { return nil }
        let did = String(parts[2])
        let rkey = String(parts[4])
        guard !did.isEmpty, !rkey.isEmpty else { return nil }
        return URL(string: "shadowsky://post/\(did)/\(rkey)")
    }

    private func parseISO8601Date(_ string: String) -> Date? {
        let formatterWithFractional = ISO8601DateFormatter()
        formatterWithFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatterWithFractional.date(from: string) {
            return date
        }
        let formatterStandard = ISO8601DateFormatter()
        formatterStandard.formatOptions = [.withInternetDateTime]
        return formatterStandard.date(from: string)
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
                NSLog("[ThreadSpotlightIndexer] Failed to index thread \(uniqueIdentifier): \(error.localizedDescription)")
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
