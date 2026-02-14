//
//  PostCardComponents.swift
//  Asphodel
//
//  Created by Claude Code
//

import SwiftUI

// MARK: - Theme Colors

struct PostCardTheme {
    static let background = Color(hex: "#0a0a0f")
    static let text = Color(hex: "#ffffff")
    static let textSecondary = Color(hex: "#9ca3af")
    static let textTertiary = Color(hex: "#6b7280")
    static let border = Color(hex: "#1f2937")
    static let primary = Color(hex: "#3b82f6")
    static let danger = Color(hex: "#ef4444")
    static let borderLight = Color(hex: "#374151")
}

// MARK: - Author Header Component

struct AuthorHeader: View {
    let author: PostAuthor
    let timestamp: String
    let isOwnPost: Bool
    let isOnline: Bool
    let onProfilePress: () -> Void
    let onMenuPress: () -> Void

    var body: some View {
        HStack(alignment: .center, spacing: 0) {
            // Author section (avatar + info)
            Button(action: onProfilePress) {
                HStack(spacing: 12) {
                    // Avatar
                    AsyncImage(url: URL(string: author.avatar ?? "")) { image in
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Circle()
                            .fill(PostCardTheme.border)
                    }
                    .frame(width: 44, height: 44)
                    .clipShape(Circle())

                    // Author info
                    VStack(alignment: .leading, spacing: 2) {
                        Text(author.displayName ?? author.handle)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(PostCardTheme.text)
                            .lineLimit(1)

                        Text("@\(author.handle)")
                            .font(.system(size: 14))
                            .foregroundColor(PostCardTheme.textSecondary)
                            .lineLimit(1)
                    }
                }
            }
            .buttonStyle(PlainButtonStyle())

            Spacer()

            // Timestamp and menu
            HStack(spacing: 8) {
                Text(timestamp)
                    .font(.system(size: 13))
                    .foregroundColor(PostCardTheme.textTertiary)

                if !isOwnPost && isOnline {
                    Button(action: onMenuPress) {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 20))
                            .foregroundColor(PostCardTheme.textSecondary)
                            .frame(width: 28, height: 28)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
        }
    }
}

// MARK: - Engagement Bar Component

struct EngagementBar: View {
    let replyCount: Int
    let repostCount: Int
    let likeCount: Int
    let isLiked: Bool
    let isBookmarked: Bool
    let isOnline: Bool
    let onReply: () -> Void
    let onRepost: () -> Void
    let onLike: () -> Void
    let onBookmark: () -> Void
    let onShare: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            // Reply button
            EngagementButton(
                icon: "bubble.left",
                count: replyCount,
                color: PostCardTheme.textSecondary,
                isActive: false,
                isEnabled: isOnline,
                action: onReply
            )

            Spacer()

            // Repost button
            EngagementButton(
                icon: "arrow.2.squarepath",
                count: repostCount,
                color: PostCardTheme.textSecondary,
                isActive: false,
                isEnabled: isOnline,
                action: onRepost
            )

            Spacer()

            // Like button
            EngagementButton(
                icon: isLiked ? "heart.fill" : "heart",
                count: likeCount,
                color: isLiked ? PostCardTheme.danger : PostCardTheme.textSecondary,
                isActive: isLiked,
                isEnabled: isOnline,
                action: onLike
            )

            Spacer()

            // Bookmark button (no count)
            Button(action: onBookmark) {
                Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
                    .font(.system(size: 18))
                    .foregroundColor(
                        isOnline
                            ? (isBookmarked ? PostCardTheme.primary : PostCardTheme.textSecondary)
                            : PostCardTheme.borderLight
                    )
                    .frame(width: 44, height: 32)
            }
            .disabled(!isOnline)
            .buttonStyle(PlainButtonStyle())

            Spacer()

            // Share button (no count)
            Button(action: onShare) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 18))
                    .foregroundColor(PostCardTheme.textSecondary)
                    .frame(width: 44, height: 32)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .padding(.top, 8)
    }
}

// MARK: - Engagement Button

struct EngagementButton: View {
    let icon: String
    let count: Int
    let color: Color
    let isActive: Bool
    let isEnabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundColor(isEnabled ? color : PostCardTheme.borderLight)

                Text("\(count)")
                    .font(.system(size: 13))
                    .foregroundColor(isEnabled ? PostCardTheme.textSecondary : PostCardTheme.borderLight)
            }
            .frame(height: 32)
        }
        .disabled(!isEnabled)
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Menu Modal

struct MenuModal: View {
    let author: PostAuthor
    let isPresented: Binding<Bool>
    let onMute: () -> Void
    let onBlock: () -> Void
    let onReport: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            // Mute option
            MenuButton(
                title: "Mute @\(author.handle)",
                isDestructive: false,
                action: {
                    isPresented.wrappedValue = false
                    onMute()
                }
            )

            Divider()
                .background(PostCardTheme.borderLight)

            // Block option
            MenuButton(
                title: "Block @\(author.handle)",
                isDestructive: true,
                action: {
                    isPresented.wrappedValue = false
                    onBlock()
                }
            )

            Divider()
                .background(PostCardTheme.borderLight)

            // Report option
            MenuButton(
                title: "Report Post",
                isDestructive: true,
                action: {
                    isPresented.wrappedValue = false
                    onReport()
                }
            )

            Divider()
                .background(PostCardTheme.borderLight)

            // Cancel option
            MenuButton(
                title: "Cancel",
                isDestructive: false,
                action: {
                    isPresented.wrappedValue = false
                }
            )
        }
        .background(PostCardTheme.border)
        .cornerRadius(12)
        .padding(.horizontal, 16)
    }
}

struct MenuButton: View {
    let title: String
    let isDestructive: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 16, weight: .medium))
                .foregroundColor(isDestructive ? PostCardTheme.danger : PostCardTheme.text)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - Content Warning Overlay

struct ContentWarningOverlay: View {
    let warningText: String
    let isRevealed: Binding<Bool>

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 32))
                .foregroundColor(PostCardTheme.textSecondary)

            Text(warningText)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(PostCardTheme.textSecondary)
                .multilineTextAlignment(.center)

            Button(action: {
                isRevealed.wrappedValue = true
            }) {
                Text("Show Content")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(PostCardTheme.primary)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)
                    .background(PostCardTheme.border)
                    .cornerRadius(8)
            }
            .buttonStyle(PlainButtonStyle())
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .background(PostCardTheme.background)
    }
}

// MARK: - Date Formatting Helper

extension Date {
    func timeAgoString() -> String {
        let calendar = Calendar.current
        let now = Date()
        let components = calendar.dateComponents([.second, .minute, .hour, .day, .weekOfYear, .month, .year], from: self, to: now)

        if let year = components.year, year >= 1 {
            return year == 1 ? "1 year ago" : "\(year) years ago"
        } else if let month = components.month, month >= 1 {
            return month == 1 ? "1 month ago" : "\(month) months ago"
        } else if let week = components.weekOfYear, week >= 1 {
            return week == 1 ? "1 week ago" : "\(week) weeks ago"
        } else if let day = components.day, day >= 1 {
            return day == 1 ? "1 day ago" : "\(day) days ago"
        } else if let hour = components.hour, hour >= 1 {
            return hour == 1 ? "1 hour ago" : "\(hour) hours ago"
        } else if let minute = components.minute, minute >= 1 {
            return minute == 1 ? "1 minute ago" : "\(minute) minutes ago"
        } else {
            return "just now"
        }
    }
}
