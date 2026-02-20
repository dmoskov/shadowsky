//
//  AggregatedNotificationItemView.swift
//  NativeNotificationsList
//
//  SwiftUI view for rendering aggregated notification groups.
//  Matches the behavior of AggregatedNotificationItem.tsx
//

import SwiftUI
import FeedBridge
import NotificationBridge
import ExpoSwiftUIFeed

struct AggregatedNotificationItemView: View {
    let model: AggregatedNotificationUIModel
    let onPress: () -> Void
    let onProfilePress: (String) -> Void
    let onMentionPress: (String, String) -> Void
    let onHashtagPress: (String) -> Void
    let onLinkPress: (String) -> Void

    @State private var isExpanded = false
    @ScaledMetric(relativeTo: .body) private var iconCircleSize: CGFloat = 32

    private var themeColor: Color {
        NotificationThemeColors.color(for: model.reason)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Main aggregated content
            mainContent

            // Expand/collapse button (when count > 1)
            if model.count > 1 {
                expandButton
            }

            // Expanded list
            if isExpanded {
                expandedList
            }
        }
        .background(Color(UIColor.systemBackground))
        .accessibilityElement(children: .contain)
    }

    // MARK: - Main Content

    private var mainContent: some View {
        Button(action: onPress) {
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .center, spacing: 12) {
                    // Icon
                    ZStack {
                        Circle()
                            .fill(themeColor.opacity(0.12))
                            .frame(width: iconCircleSize, height: iconCircleSize)

                        Image(systemName: model.reason.sfSymbolName)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(themeColor)
                    }

                    // Avatar stack + text
                    HStack(spacing: 12) {
                        avatarStack

                        VStack(alignment: .leading, spacing: 2) {
                            summaryText
                            Text(model.timestamp)
                                .font(.caption)
                                .foregroundColor(Color(UIColor.tertiaryLabel))
                        }
                    }
                }

                // Post preview for non-follow notifications
                if model.reason != .follow, let preview = model.postPreview {
                    aggregatedPostPreview(preview: preview)
                        .padding(.top, 10)
                        .padding(.leading, 44) // Align with text content
                }
            }
            .padding(16)
            .background(Color(UIColor.systemBackground))
            .overlay(model.hasUnread ? NotificationThemeColors.primary.opacity(0.04) : Color.clear)
        }
        .buttonStyle(.plain)
        .overlay(alignment: .leading) {
            if model.hasUnread {
                Circle()
                    .fill(NotificationThemeColors.primary)
                    .frame(width: 6, height: 6)
                    .padding(.leading, 4)
            }
        }
        .accessibilityLabel(accessibilityLabelText)
        .accessibilityHint("Double tap to view details")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Aggregated Post Preview

    private func aggregatedPostPreview(preview: PostPreview) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            // Post author header
            HStack(spacing: 6) {
                let contextLabel: String = {
                    switch model.reason {
                    case .quote: return "Quoting your post:"
                    default: return "Your post:"
                    }
                }()
                Text(contextLabel)
                    .font(.caption.weight(.medium))
                    .foregroundColor(Color(UIColor.tertiaryLabel))

                avatarView(url: preview.author.avatar, size: 18)

                Text(preview.author.displayName ?? preview.author.handle)
                    .font(.caption.weight(.medium))
                    .foregroundColor(Color(UIColor.secondaryLabel))
                    .lineLimit(1)

                if preview.images != nil || preview.video != nil || preview.external != nil {
                    Text("·")
                        .foregroundColor(Color(UIColor.tertiaryLabel))
                    if preview.video != nil {
                        Image(systemName: "film")
                            .font(.caption2)
                            .foregroundColor(Color(UIColor.tertiaryLabel))
                    } else if preview.external != nil {
                        Image(systemName: "link")
                            .font(.caption2)
                            .foregroundColor(Color(UIColor.tertiaryLabel))
                    } else {
                        Image(systemName: "photo")
                            .font(.caption2)
                            .foregroundColor(Color(UIColor.tertiaryLabel))
                    }
                }
            }

            // Post text
            if let text = preview.text, !text.isEmpty {
                Text(text)
                    .font(.subheadline)
                    .foregroundColor(Color(UIColor.label))
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Images
            if let images = preview.images, !images.isEmpty {
                notificationImageGrid(images: images)
            }

            // Video thumbnail
            if let video = preview.video {
                notificationVideoThumbnail(video: video)
            }

            // External link
            if let external = preview.external {
                notificationExternalLink(external: external)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(8)
    }

    // MARK: - Avatar Stack

    private var avatarStack: some View {
        HStack(spacing: -12) {
            ForEach(Array(model.users.prefix(3).enumerated()), id: \.element.did) { index, user in
                avatarView(url: user.avatar, size: 32)
                    .overlay(
                        Circle()
                            .stroke(Color(UIColor.systemBackground), lineWidth: 2)
                    )
                    .zIndex(Double(model.users.count - index))
            }

            if model.users.count > 3 {
                ZStack {
                    Circle()
                        .fill(Color(UIColor.secondarySystemBackground))
                        .frame(width: 32, height: 32)
                        .overlay(
                            Circle()
                                .stroke(Color(UIColor.systemBackground), lineWidth: 2)
                        )

                    Text("+\(model.users.count - 3)")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(Color(UIColor.secondaryLabel))
                }
            }
        }
    }

    // MARK: - Summary Text

    private var summaryText: some View {
        (Text(userSummary)
            .font(.subheadline.weight(.semibold))
            .foregroundColor(Color(UIColor.label))
        + Text(" \(model.reason.actionText)")
            .font(.subheadline)
            .foregroundColor(Color(UIColor.secondaryLabel)))
        .lineLimit(2)
    }

    private var userSummary: String {
        if model.count == 1 {
            return model.users.first?.displayName ?? "@\(model.users.first?.handle ?? "")"
        }
        if model.count == 2, model.users.count == 2 {
            let name1 = model.users[0].displayName ?? "@\(model.users[0].handle)"
            let name2 = model.users[1].displayName ?? "@\(model.users[1].handle)"
            return "\(name1) and \(name2)"
        }
        let firstName = model.users.first?.displayName ?? "@\(model.users.first?.handle ?? "")"
        let othersCount = model.count - 1
        return "\(firstName) and \(othersCount) \(othersCount == 1 ? "other" : "others")"
    }

    // MARK: - Expand Button

    private var expandButton: some View {
        Button(action: { withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() } }) {
            HStack(spacing: 6) {
                Text(isExpanded ? "Collapse" : "Show all \(model.count) notifications")
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(Color(UIColor.tertiaryLabel))

                Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(Color(UIColor.tertiaryLabel))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .padding(.horizontal, 16)
        }
        .buttonStyle(.plain)
        .background(Color(UIColor.systemBackground))
        .overlay(alignment: .top) {
            Divider()
        }
        .accessibilityLabel(isExpanded ? "Collapse notifications" : "Show all \(model.count) notifications")
    }

    // MARK: - Expanded List

    private var expandedList: some View {
        VStack(spacing: 0) {
            Divider()
            ForEach(model.notifications) { notification in
                NotificationItemView(
                    notification: notification,
                    onPress: onPress,
                    onProfilePress: onProfilePress,
                    onMentionPress: onMentionPress,
                    onHashtagPress: onHashtagPress,
                    onLinkPress: onLinkPress
                )
                Divider()
            }
        }
    }

    // MARK: - Accessibility

    private var accessibilityLabelText: String {
        "\(userSummary) \(model.reason.actionText). \(model.count) notifications. \(model.timestamp). \(model.hasUnread ? "Contains unread" : "All read")"
    }
}
