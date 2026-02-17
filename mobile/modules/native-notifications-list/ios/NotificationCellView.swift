//
//  NotificationCellView.swift
//  Asphodel
//
//  Created by Claude Code
//  SwiftUI views for individual notification cells
//

import SwiftUI
import NotificationBridge
import ExpoSwiftUIFeed

// MARK: - NotificationCellView

/// SwiftUI view for a single notification
struct NotificationCellView: View {
    let notification: SerializedNotification
    let onNotificationPress: (() -> Void)?
    let onProfilePress: ((String) -> Void)?
    let onPostPress: ((String) -> Void)?
    let onMentionPress: ((String, String) -> Void)?
    let onHashtagPress: ((String) -> Void)?

    var body: some View {
        Button(action: {
            onNotificationPress?()
        }) {
            HStack(alignment: .top, spacing: 12) {
                // Notification icon
                notificationIcon
                    .frame(width: 32, height: 32)
                    .background(notificationColor.opacity(0.15))
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 8) {
                    // Author info and action message
                    HStack(alignment: .top) {
                        // Avatar
                        Button(action: {
                            onProfilePress?(notification.author.handle)
                        }) {
                            if let avatarUrl = notification.author.avatar {
                                CachedAsyncImage(url: URL(string: avatarUrl)) { image in
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                } placeholder: {
                                    Color.gray.opacity(0.3)
                                }
                                .frame(width: 36, height: 36)
                                .clipShape(Circle())
                            } else {
                                Circle()
                                    .fill(Color.gray.opacity(0.3))
                                    .frame(width: 36, height: 36)
                            }
                        }
                        .buttonStyle(.plain)

                        VStack(alignment: .leading, spacing: 2) {
                            // Display name and action
                            HStack(spacing: 4) {
                                Text(notification.author.displayName ?? notification.author.handle)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundColor(.primary)

                                Text(notificationActionMessage)
                                    .font(.system(size: 15))
                                    .foregroundColor(.secondary)
                            }

                            // Handle
                            Text("@\(notification.author.handle)")
                                .font(.system(size: 13))
                                .foregroundColor(.secondary)
                        }

                        Spacer()

                        // Timestamp
                        Text(relativeTimeString(from: notification.indexedAt))
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                    }

                    // Post preview if available
                    if let record = notification.record, let text = record.text, !text.isEmpty {
                        VStack(alignment: .leading, spacing: 4) {
                            RichTextView(
                                text: text,
                                facets: record.facets,
                                onMentionPress: onMentionPress,
                                onHashtagPress: onHashtagPress
                            )
                            .font(.system(size: 14))
                            .foregroundColor(.primary)
                            .lineLimit(4)
                        }
                        .padding(12)
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(8)
                    }
                }

                // Unread indicator
                if !notification.isRead {
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 6, height: 6)
                }
            }
            .padding(16)
        }
        .buttonStyle(.plain)
        .background(notification.isRead ? Color(UIColor.systemBackground) : Color(UIColor.systemBackground).opacity(0.95))
        .overlay(
            Rectangle()
                .fill(Color(UIColor.separator))
                .frame(height: 0.5),
            alignment: .bottom
        )
    }

    // MARK: - Helpers

    private var notificationIcon: some View {
        Group {
            switch notification.reason {
            case "like":
                Image(systemName: "heart.fill")
                    .foregroundColor(notificationColor)
            case "repost":
                Image(systemName: "arrow.2.squarepath")
                    .foregroundColor(notificationColor)
            case "follow":
                Image(systemName: "person.badge.plus")
                    .foregroundColor(notificationColor)
            case "mention":
                Image(systemName: "at")
                    .foregroundColor(notificationColor)
            case "reply":
                Image(systemName: "arrowshape.turn.up.left")
                    .foregroundColor(notificationColor)
            case "quote":
                Image(systemName: "quote.bubble")
                    .foregroundColor(notificationColor)
            default:
                Image(systemName: "bell")
                    .foregroundColor(notificationColor)
            }
        }
        .font(.system(size: 16))
    }

    private var notificationColor: Color {
        switch notification.reason {
        case "like":
            return Color.pink
        case "repost":
            return Color.green
        case "follow":
            return Color.blue
        case "mention":
            return Color.purple
        case "reply":
            return Color.orange
        case "quote":
            return Color.teal
        default:
            return Color.gray
        }
    }

    private var notificationActionMessage: String {
        switch notification.reason {
        case "like":
            return "liked your post"
        case "repost":
            return "reposted your post"
        case "follow":
            return "followed you"
        case "mention":
            return "mentioned you"
        case "reply":
            return "replied to your post"
        case "quote":
            return "quoted your post"
        default:
            return "sent a notification"
        }
    }

    private func relativeTimeString(from isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let date = formatter.date(from: isoString) ?? ISO8601DateFormatter().date(from: isoString) else {
            return ""
        }

        let now = Date()
        let interval = now.timeIntervalSince(date)

        if interval < 60 {
            return "now"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)m"
        } else if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)h"
        } else if interval < 604800 {
            let days = Int(interval / 86400)
            return "\(days)d"
        } else {
            let weeks = Int(interval / 604800)
            return "\(weeks)w"
        }
    }
}

// MARK: - AggregatedNotificationCellView

/// SwiftUI view for aggregated notifications (e.g., "5 people liked your post")
struct AggregatedNotificationCellView: View {
    let aggregatedNotification: AggregatedNotification
    let onNotificationPress: (() -> Void)?
    let onProfilePress: ((String) -> Void)?

    var body: some View {
        Button(action: {
            onNotificationPress?()
        }) {
            HStack(alignment: .top, spacing: 12) {
                // Notification icon
                notificationIcon
                    .frame(width: 32, height: 32)
                    .background(notificationColor.opacity(0.15))
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 12) {
                    // User avatars (show up to 5)
                    HStack(spacing: -8) {
                        ForEach(Array(aggregatedNotification.users.prefix(5).enumerated()), id: \.offset) { index, user in
                            Button(action: {
                                onProfilePress?(user.handle)
                            }) {
                                if let avatarUrl = user.avatar {
                                    CachedAsyncImage(url: URL(string: avatarUrl)) { image in
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                    } placeholder: {
                                        Color.gray.opacity(0.3)
                                    }
                                    .frame(width: 32, height: 32)
                                    .clipShape(Circle())
                                    .overlay(
                                        Circle()
                                            .stroke(Color(UIColor.systemBackground), lineWidth: 2)
                                    )
                                } else {
                                    Circle()
                                        .fill(Color.gray.opacity(0.3))
                                        .frame(width: 32, height: 32)
                                        .overlay(
                                            Circle()
                                                .stroke(Color(UIColor.systemBackground), lineWidth: 2)
                                        )
                                }
                            }
                            .buttonStyle(.plain)
                            .zIndex(Double(aggregatedNotification.users.count - index))
                        }
                    }

                    // Aggregated message
                    VStack(alignment: .leading, spacing: 4) {
                        Text(aggregatedMessage)
                            .font(.system(size: 15))
                            .foregroundColor(.primary)

                        // User list
                        Text(userListString)
                            .font(.system(size: 13))
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }

                Spacer()

                // Timestamp
                Text(relativeTimeString(from: aggregatedNotification.latestTimestamp))
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            }
            .padding(16)
        }
        .buttonStyle(.plain)
        .background(Color(UIColor.systemBackground))
        .overlay(
            Rectangle()
                .fill(Color(UIColor.separator))
                .frame(height: 0.5),
            alignment: .bottom
        )
    }

    // MARK: - Helpers

    private var notificationIcon: some View {
        Group {
            switch aggregatedNotification.reason {
            case "like":
                Image(systemName: "heart.fill")
                    .foregroundColor(notificationColor)
            case "repost":
                Image(systemName: "arrow.2.squarepath")
                    .foregroundColor(notificationColor)
            case "follow":
                Image(systemName: "person.badge.plus")
                    .foregroundColor(notificationColor)
            case "quote":
                Image(systemName: "quote.bubble")
                    .foregroundColor(notificationColor)
            default:
                Image(systemName: "bell")
                    .foregroundColor(notificationColor)
            }
        }
        .font(.system(size: 16))
    }

    private var notificationColor: Color {
        switch aggregatedNotification.reason {
        case "like":
            return Color.pink
        case "repost":
            return Color.green
        case "follow":
            return Color.blue
        case "quote":
            return Color.teal
        default:
            return Color.gray
        }
    }

    private var aggregatedMessage: String {
        let count = aggregatedNotification.count
        switch aggregatedNotification.reason {
        case "like":
            return "\(count) \(count == 1 ? "person" : "people") liked your post"
        case "repost":
            return "\(count) \(count == 1 ? "person" : "people") reposted your post"
        case "follow":
            return "\(count) \(count == 1 ? "person" : "people") followed you"
        case "quote":
            return "\(count) \(count == 1 ? "person" : "people") quoted your post"
        default:
            return "\(count) notifications"
        }
    }

    private var userListString: String {
        let displayNames = aggregatedNotification.users.prefix(3).compactMap { user in
            user.displayName ?? "@\(user.handle)"
        }

        if displayNames.count == 0 {
            return ""
        } else if displayNames.count == 1 {
            return displayNames[0]
        } else if displayNames.count == 2 {
            return "\(displayNames[0]) and \(displayNames[1])"
        } else {
            let remaining = aggregatedNotification.users.count - 2
            if remaining > 0 {
                return "\(displayNames[0]), \(displayNames[1]) and \(remaining) \(remaining == 1 ? "other" : "others")"
            } else {
                return "\(displayNames[0]), \(displayNames[1]) and \(displayNames[2])"
            }
        }
    }

    private func relativeTimeString(from isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let date = formatter.date(from: isoString) ?? ISO8601DateFormatter().date(from: isoString) else {
            return ""
        }

        let now = Date()
        let interval = now.timeIntervalSince(date)

        if interval < 60 {
            return "now"
        } else if interval < 3600 {
            let minutes = Int(interval / 60)
            return "\(minutes)m"
        } else if interval < 86400 {
            let hours = Int(interval / 3600)
            return "\(hours)h"
        } else if interval < 604800 {
            let days = Int(interval / 86400)
            return "\(days)d"
        } else {
            let weeks = Int(interval / 604800)
            return "\(weeks)w"
        }
    }
}

// MARK: - RichTextView

/// Rich text view for displaying notification text with facets
/// Renders mentions, links, and hashtags with styled text
struct RichTextView: View {
    let text: String
    let facets: [NotificationFacet]?
    let onMentionPress: ((String, String) -> Void)?
    let onHashtagPress: ((String) -> Void)?

    private let primaryColor = Color(red: 0x1d / 255.0, green: 0x9b / 255.0, blue: 0xf0 / 255.0)

    var body: some View {
        if let facets = facets, !facets.isEmpty {
            buildAttributedText(facets: facets)
                .lineLimit(nil)
        } else {
            Text(text)
                .lineLimit(nil)
        }
    }

    @ViewBuilder
    private func buildAttributedText(facets: [NotificationFacet]) -> some View {
        let segments = parseSegments(facets: facets)
        segments.reduce(Text("")) { result, segment in
            switch segment.type {
            case .plain:
                return result + Text(segment.text)
            case .mention:
                return result + Text(segment.text).foregroundColor(primaryColor).fontWeight(.medium)
            case .link:
                return result + Text(segment.text).foregroundColor(primaryColor).underline()
            case .hashtag:
                return result + Text(segment.text).foregroundColor(primaryColor).fontWeight(.medium)
            }
        }
    }

    private enum SegmentType {
        case plain, mention, link, hashtag
    }

    private struct Segment {
        let text: String
        let type: SegmentType
    }

    private func parseSegments(facets: [NotificationFacet]) -> [Segment] {
        var segments: [Segment] = []
        let utf8 = text.utf8
        let sortedFacets = facets.sorted { $0.index.byteStart < $1.index.byteStart }
        var currentByteOffset = 0

        for facet in sortedFacets {
            let byteStart = facet.index.byteStart
            let byteEnd = facet.index.byteEnd

            guard byteStart >= currentByteOffset,
                  byteStart <= utf8.count,
                  byteEnd <= utf8.count else { continue }

            if currentByteOffset < byteStart {
                if let plainText = substringFromBytes(start: currentByteOffset, end: byteStart) {
                    segments.append(Segment(text: plainText, type: .plain))
                }
            }

            if let facetText = substringFromBytes(start: byteStart, end: byteEnd) {
                let segType: SegmentType
                if let feature = facet.features.first {
                    switch feature {
                    case .mention: segType = .mention
                    case .link: segType = .link
                    case .tag: segType = .hashtag
                    }
                } else {
                    segType = .plain
                }
                segments.append(Segment(text: facetText, type: segType))
            }

            currentByteOffset = max(currentByteOffset, byteEnd)
        }

        if currentByteOffset < utf8.count {
            if let remainingText = substringFromBytes(start: currentByteOffset, end: utf8.count) {
                segments.append(Segment(text: remainingText, type: .plain))
            }
        }

        return segments
    }

    private func substringFromBytes(start: Int, end: Int) -> String? {
        let utf8View = text.utf8
        guard start >= 0, end <= utf8View.count, start <= end else { return nil }
        let startIdx = utf8View.index(utf8View.startIndex, offsetBy: start)
        let endIdx = utf8View.index(utf8View.startIndex, offsetBy: end)
        guard let startStrIdx = startIdx.samePosition(in: text),
              let endStrIdx = endIdx.samePosition(in: text) else { return nil }
        return String(text[startStrIdx..<endStrIdx])
    }
}
