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

    // Event handlers
    let onFollowToggle: (() -> Void)?
    let onMessagePress: (() -> Void)?
    let onMenuPress: (() -> Void)?
    let onFollowersPress: (() -> Void)?
    let onFollowingPress: (() -> Void)?
    let onEditProfile: (() -> Void)?

    // MARK: - Body

    var body: some View {
        VStack(spacing: 0) {
            // Banner
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
                } else {
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 150)
                }

                // Menu button overlay on banner (for non-own profiles)
                if !isOwnProfile {
                    Button(action: {
                        onMenuPress?()
                    }) {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 36, height: 36)
                            .background(
                                Circle()
                                    .fill(Color.black.opacity(0.4))
                            )
                    }
                    .padding(.top, 12)
                    .padding(.trailing, 12)
                }
            }

            // Avatar overlapping banner
            VStack(spacing: 16) {
                VStack(spacing: 12) {
                    // Avatar with background ring
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
                        }
                    }
                    .overlay(
                        Circle()
                            .stroke(Color(UIColor.systemBackground), lineWidth: 3)
                    )
                    .offset(y: -40)
                    .padding(.bottom, -40)

                    // Display Name and Handle
                    VStack(spacing: 4) {
                        Text(profile.displayName ?? profile.handle)
                            .font(.system(size: 24, weight: .bold))
                            .foregroundColor(.primary)

                        Text("@\(profile.handle)")
                            .font(.system(size: 16))
                            .foregroundColor(.secondary)
                    }

                    // Status badges (blocked, muted, etc.)
                    if isBlocked {
                        statusBadge(text: "Blocked", color: .red)
                    } else if isMuted {
                        statusBadge(text: "Muted", color: .orange)
                    } else if isBlockedBy {
                        statusBadge(text: "Blocks you", color: .gray)
                    }
                }

                // Bio
                if let description = profile.description, !description.isEmpty {
                    Text(description)
                        .font(.system(size: 15))
                        .foregroundColor(.primary)
                        .multilineTextAlignment(.center)
                        .lineLimit(nil)
                }

                // Stats
                HStack(spacing: 32) {
                    // Posts
                    statView(
                        value: profile.postsCount ?? 0,
                        label: "Posts"
                    )

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
                }

                // Actions
                if isOwnProfile {
                    // Edit Profile button (for own profile)
                    Button(action: {
                        onEditProfile?()
                    }) {
                        Text("Edit Profile")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(
                                RoundedRectangle(cornerRadius: 24)
                                    .fill(Color.blue)
                            )
                    }
                } else {
                    // Actions for other users' profiles
                    HStack(spacing: 12) {
                        // Follow/Unfollow button
                        Button(action: {
                            onFollowToggle?()
                        }) {
                            Text(isFollowing ? "Following" : "Follow")
                                .font(.system(size: 16, weight: .semibold))
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

                        // Message button
                        Button(action: {
                            onMessagePress?()
                        }) {
                            Image(systemName: "paperplane.fill")
                                .font(.system(size: 20))
                                .foregroundColor(.blue)
                                .frame(width: 56, height: 44)
                                .background(
                                    RoundedRectangle(cornerRadius: 24)
                                        .stroke(Color.blue, lineWidth: 1)
                                )
                        }

                        // Menu button
                        Button(action: {
                            onMenuPress?()
                        }) {
                            Image(systemName: "ellipsis")
                                .font(.system(size: 20))
                                .foregroundColor(.blue)
                                .frame(width: 56, height: 44)
                                .background(
                                    RoundedRectangle(cornerRadius: 24)
                                        .stroke(Color.blue, lineWidth: 1)
                                )
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
        }
        .background(Color(UIColor.systemBackground))
    }

    // MARK: - Helper Views

    private func statView(value: Int, label: String) -> some View {
        VStack(spacing: 4) {
            Text("\(value)")
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(.primary)

            Text(label)
                .font(.system(size: 14))
                .foregroundColor(.secondary)
        }
    }

    private func statusBadge(text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .semibold))
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
        ProfileHeaderView(
            profile: SerializedProfile(
                did: "did:plc:example",
                handle: "alice.bsky.social",
                displayName: "Alice Example",
                description: "Just a demo profile for testing the native SwiftUI component.",
                avatar: nil,
                banner: nil,
                followersCount: 1234,
                followsCount: 567,
                postsCount: 890,
                indexedAt: nil,
                viewer: nil,
                labels: nil
            ),
            isOwnProfile: false,
            isFollowing: false,
            isBlocked: false,
            isMuted: false,
            isBlockedBy: false,
            onFollowToggle: {},
            onMessagePress: {},
            onMenuPress: {},
            onFollowersPress: {},
            onFollowingPress: {},
            onEditProfile: {}
        )
        .previewLayout(.sizeThatFits)
    }
}
#endif
