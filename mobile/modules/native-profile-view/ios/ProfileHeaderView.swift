//
//  ProfileHeaderView.swift
//  NativeProfileView
//
//  Created by Claude Code
//  SwiftUI component for displaying profile header with avatar, stats, bio
//

import SwiftUI
import ExpoSwiftUIFeed

// MARK: - ProfileHeaderView

/// Native SwiftUI profile header with avatar, display name, stats, and actions
struct ProfileHeaderView: View {
    // MARK: - Properties

    let profile: SerializedProfile
    let isOwnProfile: Bool
    let isFollowing: Bool
    let isBlocked: Bool
    let isMuted: Bool
    let isBlockedBy: Bool
    let starterPacks: [SerializedStarterPack]
    let pinnedPost: SerializedPinnedPost?
    let isFollowPending: Bool
    let isMessagePending: Bool

    // Event handlers
    let onFollowToggle: (() -> Void)?
    let onMessagePress: (() -> Void)?
    let onMenuPress: (() -> Void)?
    let onFollowersPress: (() -> Void)?
    let onFollowingPress: (() -> Void)?
    let onEditProfile: (() -> Void)?
    let onAddToList: (() -> Void)?
    let onPinnedPostPress: ((String) -> Void)?
    let onStarterPackPress: ((String) -> Void)?
    let onSignOut: (() -> Void)?
    let onKnownFollowerPress: ((String) -> Void)?

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Banner
            bannerSection

            // Profile content below banner
            VStack(spacing: 16) {
                // Avatar + Name + Handle + Status badges
                identitySection

                // Labels/badges
                if let labels = profile.labels, !labels.isEmpty {
                    labelsSection(labels: labels)
                }

                // Bio
                if let description = profile.description, !description.isEmpty {
                    bioSection(description: description)
                }

                // Known followers
                if let knownFollowers = profile.knownFollowers,
                   knownFollowers.count > 0,
                   !knownFollowers.followers.isEmpty,
                   !isOwnProfile {
                    knownFollowersSection(knownFollowers: knownFollowers)
                }

                // Stats
                statsSection

                // Starter Packs
                if !starterPacks.isEmpty {
                    starterPacksSection
                }

                // Action buttons
                actionsSection

                // Pinned post
                if let pinnedPost = pinnedPost {
                    pinnedPostSection(pinnedPost: pinnedPost)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .background(Color(UIColor.systemBackground))
    }

    // MARK: - Banner Section

    private var bannerSection: some View {
        ZStack(alignment: .topTrailing) {
            if let bannerURL = profile.banner.flatMap({ URL(string: $0) }) {
                CachedAsyncImage(url: bannerURL) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Color.gray.opacity(0.2)
                }
                .frame(height: 150)
                .clipped()
                .accessibilityLabel("Profile banner image")
            } else {
                Rectangle()
                    .fill(Color.gray.opacity(0.2))
                    .frame(height: 150)
                    .accessibilityHidden(true)
            }

            // Menu button overlay on banner (for non-own profiles)
            if !isOwnProfile {
                Button(action: {
                    onMenuPress?()
                }) {
                    Image(systemName: "ellipsis")
                        .font(.body.weight(.semibold))
                        .foregroundColor(.white)
                        .frame(width: 36, height: 36)
                        .background(
                            Circle()
                                .fill(Color.black.opacity(0.4))
                        )
                }
                .accessibilityLabel("Profile actions menu")
                .accessibilityHint("Double tap to open mute, block, and report options")
                .padding(.top, 12)
                .padding(.trailing, 12)
            }
        }
    }

    // MARK: - Identity Section (Avatar + Name + Handle + Badges)

    private var identitySection: some View {
        VStack(spacing: 12) {
            // Avatar with background ring
            avatarView
                .offset(y: -40)
                .padding(.bottom, -40)

            // Display Name and Handle
            VStack(spacing: 4) {
                HStack(spacing: 6) {
                    Text(profile.displayName.orIfEmpty(profile.handle))
                        .font(.title2.weight(.bold))
                        .foregroundColor(.primary)
                        .accessibilityIdentifier("profile-display-name")
                        .accessibilityAddTraits(.isHeader)
                        .accessibilityLabel("Display name: \(profile.displayName.orIfEmpty(profile.handle))")

                    if profile.isVerified == true {
                        VerifiedBadge(size: .large)
                    }
                }

                Text("@\(profile.handle)")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .accessibilityIdentifier("profile-handle")
                    .accessibilityLabel("Handle: @\(profile.handle)")
            }

            // Follows you badge
            if let followedBy = profile.viewer?.followedBy, !followedBy.isEmpty, !isOwnProfile {
                Text("Follows you")
                    .font(.caption.weight(.medium))
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color.gray.opacity(0.15))
                    )
                    .accessibilityLabel("This user follows you")
            }

            // Status badges (blocked, muted, etc.)
            if isBlocked {
                statusBadge(text: "Blocked", color: .red)
                    .accessibilityLabel("You have blocked this user")
            } else if isMuted {
                statusBadge(text: "Muted", color: .orange)
                    .accessibilityLabel("You have muted this user")
            } else if isBlockedBy {
                statusBadge(text: "Blocks you", color: .gray)
                    .accessibilityLabel("This user has blocked you")
            }
        }
    }

    private var avatarView: some View {
        Group {
            if let avatarURL = profile.avatar.flatMap({ URL(string: $0) }) {
                CachedAsyncImage(url: avatarURL) { image in
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                } placeholder: {
                    Circle()
                        .fill(Color.gray.opacity(0.3))
                }
                .frame(width: 80, height: 80)
                .clipShape(Circle())
            } else {
                Circle()
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 80, height: 80)
                    .overlay(
                        Image(systemName: "person.fill")
                            .font(.title)
                            .foregroundColor(.gray.opacity(0.6))
                    )
            }
        }
        .overlay(
            Circle()
                .stroke(Color(UIColor.systemBackground), lineWidth: 3)
        )
        .accessibilityLabel("Profile photo for \(profile.displayName.orIfEmpty(profile.handle))")
    }

    // MARK: - Labels Section

    private func labelsSection(labels: [SerializedLabel]) -> some View {
        let displayLabels = labels.filter { label in
            // Filter out system labels, only show user-facing ones
            !label.val.hasPrefix("!") && label.val != "no-unauthenticated"
        }

        return Group {
            if !displayLabels.isEmpty {
                HStack(spacing: 8) {
                    ForEach(displayLabels, id: \.val) { label in
                        Text(formattedLabelText(label.val))
                            .font(.caption2.weight(.medium))
                            .foregroundColor(.orange)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(
                                Capsule()
                                    .fill(Color.orange.opacity(0.15))
                            )
                            .accessibilityLabel("Content label: \(formattedLabelText(label.val))")
                    }
                }
            }
        }
    }

    private func formattedLabelText(_ val: String) -> String {
        val.replacingOccurrences(of: "-", with: " ").capitalized
    }

    // MARK: - Bio Section

    private func bioSection(description: String) -> some View {
        Text(description)
            .font(.subheadline)
            .foregroundColor(.primary)
            .multilineTextAlignment(.center)
            .lineLimit(nil)
            .frame(maxWidth: .infinity, alignment: .center)
            .accessibilityLabel("Bio: \(description)")
    }

    // MARK: - Known Followers Section

    private func knownFollowersSection(knownFollowers: SerializedKnownFollowers) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: -8) {
                ForEach(Array(knownFollowers.followers.prefix(3).enumerated()), id: \.element.did) { index, follower in
                    Group {
                        if let avatarURL = follower.avatar.flatMap({ URL(string: $0) }) {
                            CachedAsyncImage(url: avatarURL) { image in
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                            } placeholder: {
                                Circle()
                                    .fill(Color.gray.opacity(0.3))
                            }
                            .frame(width: 24, height: 24)
                            .clipShape(Circle())
                        } else {
                            Circle()
                                .fill(Color.gray.opacity(0.3))
                                .frame(width: 24, height: 24)
                        }
                    }
                    .overlay(
                        Circle()
                            .stroke(Color(UIColor.systemBackground), lineWidth: 1.5)
                    )
                    .zIndex(Double(3 - index))
                    .onTapGesture {
                        onKnownFollowerPress?(follower.handle)
                    }
                }
            }

            let names = knownFollowers.followers.prefix(3).compactMap { $0.displayName.orIfEmpty($0.handle) }
            let remaining = knownFollowers.count - names.count

            Text(knownFollowersText(names: Array(names), remaining: remaining))
                .font(.footnote)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .accessibilityLabel("Followed by \(knownFollowers.count) people you follow")
        }
        .padding(.vertical, 4)
    }

    private func knownFollowersText(names: [String], remaining: Int) -> String {
        if names.isEmpty {
            return "Followed by \(remaining) people you follow"
        } else if names.count == 1 && remaining <= 0 {
            return "Followed by \(names[0])"
        } else if names.count == 1 && remaining > 0 {
            return "Followed by \(names[0]) and \(remaining) other\(remaining == 1 ? "" : "s") you follow"
        } else if names.count == 2 && remaining <= 0 {
            return "Followed by \(names[0]) and \(names[1])"
        } else if names.count == 2 && remaining > 0 {
            return "Followed by \(names[0]), \(names[1]), and \(remaining) other\(remaining == 1 ? "" : "s") you follow"
        } else if remaining <= 0 {
            return "Followed by \(names.joined(separator: ", "))"
        } else {
            return "Followed by \(names.joined(separator: ", ")), and \(remaining) other\(remaining == 1 ? "" : "s") you follow"
        }
    }

    // MARK: - Stats Section

    private var statsSection: some View {
        HStack(spacing: 32) {
            // Posts
            statView(
                value: profile.postsCount ?? 0,
                label: "Posts"
            )
            .accessibilityIdentifier("profile-posts-count")
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(profile.postsCount ?? 0) posts")

            // Followers
            Button(action: {
                onFollowersPress?()
            }) {
                statView(
                    value: profile.followersCount ?? 0,
                    label: "Followers"
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("profile-followers-count")
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(profile.followersCount ?? 0) followers")
            .accessibilityHint("Double tap to view followers")

            // Following
            Button(action: {
                onFollowingPress?()
            }) {
                statView(
                    value: profile.followsCount ?? 0,
                    label: "Following"
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("profile-following-count")
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(profile.followsCount ?? 0) following")
            .accessibilityHint("Double tap to view following")
        }
        .accessibilityIdentifier("profile-stats")
    }

    // MARK: - Starter Packs Section

    private var starterPacksSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(isOwnProfile ? "My Starter Packs" : "Starter Packs")
                .font(.title3.weight(.bold))
                .foregroundColor(.primary)
                .accessibilityAddTraits(.isHeader)

            ForEach(starterPacks, id: \.uri) { pack in
                Button(action: {
                    onStarterPackPress?(pack.uri)
                }) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(pack.name)
                                .font(.body.weight(.semibold))
                                .foregroundColor(.primary)

                            HStack(spacing: 12) {
                                if let memberCount = pack.listItemCount {
                                    Text("\(memberCount) members")
                                        .font(.subheadline)
                                        .foregroundColor(.secondary)
                                }
                                if let joinedCount = pack.joinedAllTimeCount {
                                    Text("\(joinedCount) joined")
                                        .font(.subheadline)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }

                        Spacer()

                        Text("\u{203A}")
                            .font(.title2.weight(.light))
                            .foregroundColor(.blue)
                    }
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color(UIColor.secondarySystemBackground))
                    )
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Starter pack: \(pack.name). \(pack.listItemCount.map { "\($0) members" } ?? "")")
                .accessibilityHint("Double tap to view starter pack")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Actions Section

    private var actionsSection: some View {
        Group {
            if isOwnProfile {
                ownProfileActions
            } else {
                otherProfileActions
            }
        }
    }

    private var ownProfileActions: some View {
        VStack(spacing: 12) {
            Button(action: {
                onEditProfile?()
            }) {
                Text("Edit Profile")
                    .font(.body.weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 24)
                            .fill(Color.blue)
                    )
            }
            .accessibilityIdentifier("edit-profile-button")
            .accessibilityLabel("Edit Profile")
            .accessibilityHint("Double tap to edit your profile")

            Button(action: {
                onSignOut?()
            }) {
                Text("Sign Out")
                    .font(.body.weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 24)
                            .fill(Color.red)
                    )
            }
            .accessibilityIdentifier("sign-out-button")
            .accessibilityLabel("Sign Out")
            .accessibilityHint("Double tap to sign out of your account")
        }
    }

    private var otherProfileActions: some View {
        HStack(spacing: 12) {
            // Follow/Unfollow button
            Button(action: {
                onFollowToggle?()
            }) {
                Group {
                    if isFollowPending {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(
                                tint: isFollowing ? .blue : .white
                            ))
                    } else {
                        Text(isFollowing ? "Following" : "Follow")
                            .font(.body.weight(.semibold))
                    }
                }
                .foregroundColor(isFollowing ? Color.blue : Color.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 24)
                        .fill(isFollowing ? Color.clear : Color.blue)
                        .overlay(
                            RoundedRectangle(cornerRadius: 24)
                                .stroke(Color.blue, lineWidth: isFollowing ? 1 : 0)
                        )
                )
            }
            .disabled(isFollowPending)
            .accessibilityLabel(isFollowing ? "Following. Double tap to unfollow" : "Follow. Double tap to follow")
            .accessibilityAddTraits(.isButton)

            // Message button
            Button(action: {
                onMessagePress?()
            }) {
                Group {
                    if isMessagePending {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .blue))
                    } else {
                        Image(systemName: "paperplane.fill")
                            .font(.title3)
                            .foregroundColor(.blue)
                    }
                }
                .frame(width: 56, height: 44)
                .background(
                    RoundedRectangle(cornerRadius: 24)
                        .stroke(Color.blue, lineWidth: 1)
                )
            }
            .disabled(isMessagePending)
            .accessibilityLabel("Send direct message")
            .accessibilityHint("Double tap to start a conversation")

            // Add to List button
            Button(action: {
                onAddToList?()
            }) {
                Text("Add to List")
                    .font(.body.weight(.semibold))
                    .foregroundColor(.blue)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 24)
                            .stroke(Color.blue, lineWidth: 1)
                    )
            }
            .accessibilityLabel("Add to List")
            .accessibilityHint("Double tap to add this user to a list")
        }
    }

    // MARK: - Pinned Post Section

    private func pinnedPostSection(pinnedPost: SerializedPinnedPost) -> some View {
        Button(action: {
            onPinnedPostPress?(pinnedPost.uri)
        }) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "pin.fill")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text("Pinned")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.secondary)
                }

                if let text = pinnedPost.text, !text.isEmpty {
                    Text(text)
                        .font(.subheadline)
                        .foregroundColor(.primary)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)
                }

                HStack(spacing: 16) {
                    if let replies = pinnedPost.replyCount, replies > 0 {
                        Label("\(replies)", systemImage: "bubble.right")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                    if let reposts = pinnedPost.repostCount, reposts > 0 {
                        Label("\(reposts)", systemImage: "arrow.2.squarepath")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                    if let likes = pinnedPost.likeCount, likes > 0 {
                        Label("\(likes)", systemImage: "heart")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(UIColor.secondarySystemBackground))
            )
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Pinned post: \(pinnedPost.text.orIfEmpty("No text"))")
        .accessibilityHint("Double tap to view pinned post")
    }

    // MARK: - Helper Views

    private func statView(value: Int, label: String) -> some View {
        VStack(spacing: 4) {
            Text(formattedCount(value))
                .font(.title3.weight(.bold))
                .foregroundColor(.primary)

            Text(label)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }

    private func formattedCount(_ count: Int) -> String {
        if count >= 1_000_000 {
            let millions = Double(count) / 1_000_000.0
            return String(format: "%.1fM", millions)
        } else if count >= 10_000 {
            let thousands = Double(count) / 1_000.0
            return String(format: "%.1fK", thousands)
        }
        return "\(count)"
    }

    private func statusBadge(text: String, color: Color) -> some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundColor(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(
                Capsule()
                    .fill(color)
            )
    }
}

// MARK: - Preview

#if DEBUG
struct ProfileHeaderView_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            ProfileHeaderView(
                profile: SerializedProfile(
                    did: "did:plc:example",
                    handle: "alice.bsky.social",
                    displayName: "Alice Example",
                    description: "Just a demo profile for testing the native SwiftUI component. This is a longer bio to test multiline text wrapping.",
                    avatar: nil,
                    banner: nil,
                    followersCount: 1234,
                    followsCount: 567,
                    postsCount: 890,
                    indexedAt: nil,
                    viewer: SerializedProfileViewer(
                        muted: false,
                        blockedBy: false,
                        blocking: nil,
                        blockingByList: nil,
                        following: nil,
                        followedBy: "at://did:plc:other/app.bsky.graph.follow/abc"
                    ),
                    labels: [
                        SerializedLabel(src: nil, uri: nil, cid: nil, val: "porn", cts: nil)
                    ],
                    pinnedPost: SerializedPinnedPostRef(uri: "at://did:plc:example/app.bsky.feed.post/123"),
                    associated: nil,
                    knownFollowers: SerializedKnownFollowers(
                        count: 5,
                        followers: [
                            SerializedKnownFollower(did: "did:plc:f1", handle: "bob.bsky.social", displayName: "Bob", avatar: nil),
                            SerializedKnownFollower(did: "did:plc:f2", handle: "carol.bsky.social", displayName: "Carol", avatar: nil),
                        ]
                    )
                ),
                isOwnProfile: false,
                isFollowing: false,
                isBlocked: false,
                isMuted: false,
                isBlockedBy: false,
                starterPacks: [
                    SerializedStarterPack(uri: "at://test/1", cid: nil, name: "Cool People Pack", listItemCount: 25, joinedAllTimeCount: 100)
                ],
                pinnedPost: SerializedPinnedPost(
                    uri: "at://did:plc:example/app.bsky.feed.post/123",
                    authorHandle: "alice.bsky.social",
                    authorDisplayName: "Alice Example",
                    authorAvatar: nil,
                    text: "This is my pinned post about something interesting!",
                    indexedAt: nil,
                    likeCount: 42,
                    repostCount: 7,
                    replyCount: 3
                ),
                isFollowPending: false,
                isMessagePending: false,
                onFollowToggle: {},
                onMessagePress: {},
                onMenuPress: {},
                onFollowersPress: {},
                onFollowingPress: {},
                onEditProfile: {},
                onAddToList: {},
                onPinnedPostPress: { _ in },
                onStarterPackPress: { _ in },
                onSignOut: {},
                onKnownFollowerPress: { _ in }
            )
        }
        .previewLayout(.sizeThatFits)
    }
}
#endif
