//
//  ContentFilter.swift
//  Asphodel
//
//  Content filtering utility for muted words
//

import Foundation

// MARK: - Muted Word Model
struct MutedWord: Codable {
    let id: String
    let value: String
    let duration: Duration?
    let expiresAt: Double?
    let appliesTo: AppliesTo?

    enum Duration: String, Codable {
        case forever
        case twentyFourHours = "24h"
        case sevenDays = "7d"
        case thirtyDays = "30d"
    }

    enum AppliesTo: String, Codable {
        case all
        case home
    }
}

// MARK: - Content Filter
class ContentFilter {

    /// Check if a muted word has expired
    static func isMutedWordExpired(_ mutedWord: MutedWord) -> Bool {
        guard let expiresAt = mutedWord.expiresAt else {
            return false
        }

        if mutedWord.duration == .forever {
            return false
        }

        let currentTime = Date().timeIntervalSince1970 * 1000 // Convert to milliseconds
        return currentTime > expiresAt
    }

    /// Calculate expiration timestamp for a muted word based on duration
    static func calculateExpirationTime(duration: MutedWord.Duration?) -> Double? {
        guard let duration = duration, duration != .forever else {
            return nil
        }

        let now = Date().timeIntervalSince1970 * 1000 // Milliseconds
        let durations: [MutedWord.Duration: Double] = [
            .twentyFourHours: 24 * 60 * 60 * 1000,
            .sevenDays: 7 * 24 * 60 * 60 * 1000,
            .thirtyDays: 30 * 24 * 60 * 60 * 1000
        ]

        guard let durationMs = durations[duration] else {
            return nil
        }

        return now + durationMs
    }

    /// Check if text contains a muted word/phrase
    /// Case-insensitive matching with support for phrases and hashtags
    static func containsMutedWord(text: String, mutedWord: MutedWord) -> Bool {
        if isMutedWordExpired(mutedWord) {
            return false
        }

        let searchValue = mutedWord.value.lowercased().trimmingCharacters(in: .whitespaces)
        let searchText = text.lowercased()

        // Handle hashtag matching
        if searchValue.hasPrefix("#") {
            let tag = String(searchValue.dropFirst())
            // Match hashtag exactly with word boundaries
            let pattern = "#\(NSRegularExpression.escapedPattern(for: tag))(?![\\w])"
            if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
                let range = NSRange(text.startIndex..., in: text)
                return regex.firstMatch(in: text, options: [], range: range) != nil
            }
            return false
        }

        // For phrases (multi-word), check if the entire phrase exists
        if searchValue.contains(" ") {
            return searchText.contains(searchValue)
        }

        // For single words, match with word boundaries to avoid partial matches
        // e.g., "cat" should not match "category"
        let escapedValue = NSRegularExpression.escapedPattern(for: searchValue)
        let pattern = "\\b\(escapedValue)\\b"
        if let regex = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) {
            let range = NSRange(text.startIndex..., in: text)
            return regex.firstMatch(in: text, options: [], range: range) != nil
        }

        return false
    }

    /// Extract text content from a post for filtering
    static func extractPostText(post: FeedViewPost) -> String {
        var text = ""

        // Add post text
        text += post.post.record.text + " "

        // Add alt text from images if present
        if case .images(let images) = post.post.embed {
            for image in images {
                if let alt = image.alt {
                    text += alt + " "
                }
            }
        }

        // Add quoted post text
        if case .record(let recordEmbed) = post.post.embed {
            if let embeddedText = recordEmbed.record.value?.text {
                text += embeddedText + " "
            }
        }

        return text
    }

    /// Check if a post should be muted based on muted words
    static func isPostMuted(
        post: FeedViewPost,
        mutedWords: [MutedWord],
        feedType: String? = nil
    ) -> Bool {
        guard !mutedWords.isEmpty else {
            return false
        }

        let postText = extractPostText(post: post)

        // Check each muted word
        for mutedWord in mutedWords {
            // Skip if muted word only applies to home feed and we're in another feed
            if mutedWord.appliesTo == .home && feedType != "home" {
                continue
            }

            // Skip if expired
            if isMutedWordExpired(mutedWord) {
                continue
            }

            // Check if post contains muted word
            if containsMutedWord(text: postText, mutedWord: mutedWord) {
                return true
            }
        }

        return false
    }

    /// Filter a list of posts based on muted words
    static func filterMutedPosts(
        posts: [FeedViewPost],
        mutedWords: [MutedWord],
        feedType: String? = nil
    ) -> [FeedViewPost] {
        guard !mutedWords.isEmpty else {
            return posts
        }

        return posts.filter { post in
            !isPostMuted(post: post, mutedWords: mutedWords, feedType: feedType)
        }
    }

    /// Get list of active (non-expired) muted words
    static func getActiveMutedWords(_ mutedWords: [MutedWord]) -> [MutedWord] {
        return mutedWords.filter { !isMutedWordExpired($0) }
    }
}
