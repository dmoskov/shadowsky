//
//  NotificationItemView.swift
//  NativeNotificationsList
//
//  SwiftUI view for rendering a single notification item.
//  Matches the behavior of NotificationItem.tsx
//

import SwiftUI
import FeedBridge
import NotificationBridge
import ExpoSwiftUIFeed
import RichTextView

// MARK: - Theme Colors

struct NotificationThemeColors {
    static let like = Color(red: 0xF9 / 255.0, green: 0x17 / 255.0, blue: 0x80 / 255.0)
    static let repost = Color(red: 0x00 / 255.0, green: 0xBA / 255.0, blue: 0x7C / 255.0)
    static let primary = Color(red: 0x1D / 255.0, green: 0x9B / 255.0, blue: 0xF0 / 255.0)
    static let mention = Color(red: 0xFF / 255.0, green: 0x6B / 255.0, blue: 0x35 / 255.0)
    static let reply = Color(red: 0x1D / 255.0, green: 0x9B / 255.0, blue: 0xF0 / 255.0)
    static let quote = Color(red: 0x87 / 255.0, green: 0x5C / 255.0, blue: 0xFF / 255.0)

    static func color(for reason: NotificationReason) -> Color {
        switch reason {
        case .like, .likeViaRepost: return like
        case .repost, .repostViaRepost: return repost
        case .follow, .starterpackJoined: return primary
        case .mention: return mention
        case .reply: return reply
        case .quote: return quote
        case .unknown: return Color.secondary
        }
    }
}

// MARK: - Notification Item View

struct NotificationItemView: View {
    let notification: NotificationUIModel
    let onPress: () -> Void
    let onProfilePress: (String) -> Void
    let onMentionPress: (String, String) -> Void
    let onHashtagPress: (String) -> Void
    let onLinkPress: (String) -> Void

    private var themeColor: Color {
        NotificationThemeColors.color(for: notification.reason)
    }

    var body: some View {
        Button(action: onPress) {
            HStack(alignment: .top, spacing: 12) {
                // Icon indicator
                iconView

                // Main content
                VStack(alignment: .leading, spacing: 0) {
                    // Author row
                    authorRow

                    // Rich post preview (with fetched post data)
                    if let preview = notification.postPreview {
                        richPostPreviewView(preview: preview)
                    }
                    // Fallback: show notification record text
                    else if let postText = notification.postText, !postText.isEmpty,
                       let facets = notification.postFacets {
                        postPreviewView(text: postText, facets: facets)
                    } else if let postText = notification.postText, !postText.isEmpty {
                        postPreviewView(text: postText, facets: [])
                    } else if notification.reasonSubject != nil {
                        tapHintView
                    }
                }
            }
            .padding(16)
            .background(Color(UIColor.systemBackground))
            .overlay(notification.isRead ? Color.clear : NotificationThemeColors.primary.opacity(0.04))
        }
        .buttonStyle(.plain)
        .overlay(alignment: .leading) {
            // Unread indicator
            if !notification.isRead {
                Circle()
                    .fill(NotificationThemeColors.primary)
                    .frame(width: 6, height: 6)
                    .padding(.leading, 4)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabelText)
        .accessibilityHint("Double tap to view notification details")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Icon View

    private var iconView: some View {
        ZStack {
            Circle()
                .fill(themeColor.opacity(0.12))
                .frame(width: 32, height: 32)

            Image(systemName: notification.reason.sfSymbolName)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(themeColor)
        }
    }

    // MARK: - Author Row

    private var authorRow: some View {
        HStack(alignment: .top, spacing: 8) {
            // Avatar
            Button(action: { onProfilePress(notification.authorHandle) }) {
                avatarView(url: notification.authorAvatar, size: 36)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("View profile of \(notification.authorDisplayName ?? notification.authorHandle)")

            // Name + action
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 0) {
                    Text(notification.authorDisplayName ?? notification.authorHandle)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(Color(UIColor.label))
                        .lineLimit(1)

                    Text(" \(notification.reason.actionText)")
                        .font(.system(size: 15))
                        .foregroundColor(Color(UIColor.secondaryLabel))
                }

                Text("@\(notification.authorHandle)")
                    .font(.system(size: 13))
                    .foregroundColor(Color(UIColor.tertiaryLabel))
                    .lineLimit(1)
            }

            Spacer(minLength: 0)

            // Timestamp
            Text(notification.timestamp)
                .font(.system(size: 12))
                .foregroundColor(Color(UIColor.tertiaryLabel))
        }
    }

    // MARK: - Post Preview

    private func postPreviewView(text: String, facets: [Facet]) -> some View {
        VStack(alignment: .leading) {
            if facets.isEmpty {
                Text(text)
                    .font(.system(size: 14))
                    .foregroundColor(Color(UIColor.secondaryLabel))
                    .lineLimit(4)
            } else {
                RichTextView(
                    text: text,
                    facets: facets,
                    onMentionTap: { handle, did in onMentionPress(handle, did) },
                    onHashtagTap: { tag in onHashtagPress(tag) },
                    onLinkTap: { uri in onLinkPress(uri) }
                )
                .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(8)
        .padding(.top, 8)
    }

    // MARK: - Rich Post Preview

    private func richPostPreviewView(preview: PostPreview) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            // Post author and context label
            HStack(spacing: 6) {
                let contextLabel: String = {
                    switch notification.reason {
                    case .reply: return "Replying to your post:"
                    case .quote: return "Quoting your post:"
                    default: return "Your post:"
                    }
                }()
                Text(contextLabel)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color(UIColor.tertiaryLabel))

                avatarView(url: preview.author.avatar, size: 18)

                Text(preview.author.displayName ?? preview.author.handle)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(Color(UIColor.secondaryLabel))
                    .lineLimit(1)

                // Media indicator
                if preview.images != nil || preview.video != nil || preview.external != nil {
                    Text("·")
                        .foregroundColor(Color(UIColor.tertiaryLabel))
                    if preview.video != nil {
                        Image(systemName: "film")
                            .font(.system(size: 10))
                            .foregroundColor(Color(UIColor.tertiaryLabel))
                    } else if preview.external != nil {
                        Image(systemName: "link")
                            .font(.system(size: 10))
                            .foregroundColor(Color(UIColor.tertiaryLabel))
                    } else {
                        Image(systemName: "photo")
                            .font(.system(size: 10))
                            .foregroundColor(Color(UIColor.tertiaryLabel))
                    }
                }
            }

            // Post text
            if let text = preview.text, !text.isEmpty {
                Text(text)
                    .font(.system(size: 14))
                    .foregroundColor(Color(UIColor.label))
                    .lineLimit(4)
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
        .padding(.top, 8)
    }

    // MARK: - Tap Hint

    private var tapHintView: some View {
        Text("Tap to view post")
            .font(.system(size: 13))
            .italic()
            .foregroundColor(Color(UIColor.tertiaryLabel))
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(8)
            .padding(.top, 8)
    }

    // MARK: - Accessibility

    private var accessibilityLabelText: String {
        let name = notification.authorDisplayName ?? notification.authorHandle
        let action = notification.reason.actionText
        let postPreview = notification.postText.map { "Post: \(String($0.prefix(100)))" } ?? ""
        let readStatus = notification.isRead ? "Read notification" : "Unread notification"
        return "\(name) \(action). \(postPreview) \(notification.timestamp). \(readStatus)"
    }
}

// MARK: - Notification Media Views

/// Compact image grid for notification post previews (smaller than feed images)
func notificationImageGrid(images: [PostPreviewImage]) -> some View {
    let imageCount = min(images.count, 4)

    return Group {
        if imageCount == 1 {
            notificationImageTile(image: images[0])
                .frame(height: 160)
                .cornerRadius(8)
        } else {
            HStack(spacing: 4) {
                ForEach(0..<imageCount, id: \.self) { index in
                    notificationImageTile(image: images[index])
                        .frame(height: imageCount <= 2 ? 120 : 100)
                        .cornerRadius(8)
                }
            }
        }
    }
}

func notificationImageTile(image: PostPreviewImage) -> some View {
    Group {
        if let url = URL(string: image.thumb) {
            CachedAsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    Color.gray.opacity(0.2)
                case .success(let img):
                    img
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                case .failure:
                    Color.gray.opacity(0.2)
                        .overlay(
                            Image(systemName: "photo")
                                .foregroundColor(.gray)
                        )
                @unknown default:
                    Color.gray.opacity(0.2)
                }
            }
            .clipped()
        } else {
            Color.gray.opacity(0.2)
        }
    }
}

/// Video thumbnail with play button overlay
func notificationVideoThumbnail(video: PostPreviewVideo) -> some View {
    ZStack {
        if let thumbURL = video.thumbnail, let url = URL(string: thumbURL) {
            CachedAsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    Color.gray.opacity(0.2)
                case .success(let img):
                    img
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                case .failure:
                    Color.gray.opacity(0.2)
                @unknown default:
                    Color.gray.opacity(0.2)
                }
            }
            .clipped()
        } else {
            Color.gray.opacity(0.2)
                .overlay(
                    Image(systemName: "video")
                        .foregroundColor(.gray)
                )
        }

        // Play button overlay
        Circle()
            .fill(Color.black.opacity(0.6))
            .frame(width: 44, height: 44)
            .overlay(
                Image(systemName: "play.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.white)
                    .offset(x: 2)
            )
    }
    .frame(height: 160)
    .frame(maxWidth: .infinity)
    .cornerRadius(8)
}

/// External link card preview
func notificationExternalLink(external: PostPreviewExternal) -> some View {
    VStack(alignment: .leading, spacing: 0) {
        // Thumbnail
        if let thumbURL = external.thumb, let url = URL(string: thumbURL) {
            CachedAsyncImage(url: url) { phase in
                switch phase {
                case .empty:
                    Color.gray.opacity(0.2)
                        .frame(height: 120)
                case .success(let img):
                    img
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(height: 120)
                        .clipped()
                case .failure:
                    EmptyView()
                @unknown default:
                    EmptyView()
                }
            }
        }

        // Link metadata
        VStack(alignment: .leading, spacing: 2) {
            if let host = URL(string: external.uri)?.host?.replacingOccurrences(of: "^www\\.", with: "", options: .regularExpression) {
                Text(host)
                    .font(.system(size: 11))
                    .foregroundColor(Color(UIColor.tertiaryLabel))
                    .lineLimit(1)
            }

            if !external.title.isEmpty {
                Text(external.title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(Color(UIColor.label))
                    .lineLimit(2)
            }
        }
        .padding(8)
    }
    .background(Color(UIColor.tertiarySystemBackground))
    .cornerRadius(8)
    .overlay(
        RoundedRectangle(cornerRadius: 8)
            .stroke(Color.gray.opacity(0.2), lineWidth: 1)
    )
}

// MARK: - Avatar View

func avatarView(url: String?, size: CGFloat) -> some View {
    Group {
        if let urlString = url, let imageURL = URL(string: urlString) {
            CachedAsyncImage(url: imageURL) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Circle()
                    .fill(Color(UIColor.tertiarySystemFill))
            }
        } else {
            Circle()
                .fill(Color(UIColor.tertiarySystemFill))
                .overlay(
                    Image(systemName: "person.fill")
                        .foregroundColor(Color(UIColor.tertiaryLabel))
                        .font(.system(size: size * 0.4))
                )
        }
    }
    .frame(width: size, height: size)
    .clipShape(Circle())
}
