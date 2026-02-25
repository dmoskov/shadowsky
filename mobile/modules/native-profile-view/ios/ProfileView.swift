//
//  ProfileView.swift
//  NativeProfileView
//
//  Created by Claude Code
//  Main SwiftUI profile view with header and feed integration
//

import SwiftUI

// MARK: - ProfileView

/// Complete native SwiftUI profile view with header and tab switching
/// The feed list should be handled by the existing NativeFeedList component
struct ProfileView: View {
    // MARK: - Properties

    // Profile data
    @StateObject private var profileState = ProfileState()

    // Configuration
    let isOwnProfile: Bool

    // Current tab
    @State private var activeTab: ProfileTab = .posts

    // Loading states
    let isLoadingProfile: Bool
    let isRefreshing: Bool
    let isFollowPending: Bool
    let isMessagePending: Bool
    let error: String?
    let errorType: String?  // "deleted", "suspended", "blocked", or nil for generic

    // Event handlers
    let onRefresh: (() -> Void)?
    let onTabChange: ((String) -> Void)?
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
        ZStack {
            if isLoadingProfile && profileState.profile == nil {
                // Loading skeleton
                profileSkeleton
            } else if let errorType = errorType, profileState.profile == nil {
                // Typed error states (deleted, suspended, blocked)
                typedErrorView(errorType)
            } else if let error = error, profileState.profile == nil {
                // Generic error state
                errorView(error)
            } else if let profile = profileState.profile {
                // Profile content
                profileContent(profile: profile)
            }
        }
        .background(Color(UIColor.systemBackground))
        .onAppear {
            profileState.startObserving()
        }
        .onDisappear {
            profileState.stopObserving()
        }
    }

    // MARK: - Profile Content

    @ViewBuilder
    private func profileContent(profile: SerializedProfile) -> some View {
        VStack(spacing: 0) {
            // Profile Header
            ProfileHeaderView(
                profile: profile,
                isOwnProfile: isOwnProfile,
                isFollowing: profile.viewer?.following != nil,
                isBlocked: profile.viewer?.blocking != nil,
                isMuted: profile.viewer?.muted ?? false,
                isBlockedBy: profile.viewer?.blockedBy ?? false,
                starterPacks: profileState.starterPacks,
                pinnedPost: profileState.pinnedPost,
                isFollowPending: isFollowPending,
                isMessagePending: isMessagePending,
                onFollowToggle: onFollowToggle,
                onMessagePress: onMessagePress,
                onMenuPress: onMenuPress,
                onFollowersPress: onFollowersPress,
                onFollowingPress: onFollowingPress,
                onEditProfile: onEditProfile,
                onAddToList: onAddToList,
                onPinnedPostPress: onPinnedPostPress,
                onStarterPackPress: onStarterPackPress,
                onSignOut: onSignOut,
                onKnownFollowerPress: onKnownFollowerPress
            )

            // Tab Bar
            tabBar

            Divider()

            // Note: The feed content is rendered by the parent NativeFeedList component
            // This view only provides the header and tab switching
        }
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(ProfileTab.allCases, id: \.self) { tab in
                Button(action: {
                    activeTab = tab
                    onTabChange?(tab.rawValue)
                }) {
                    VStack(spacing: 8) {
                        Text(tab.title)
                            .font(.subheadline.weight(activeTab == tab ? .semibold : .regular))
                            .foregroundColor(activeTab == tab ? .blue : .secondary)

                        Rectangle()
                            .fill(activeTab == tab ? Color.blue : Color.clear)
                            .frame(height: 3)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("profile-tab-\(tab.rawValue)")
                .accessibilityLabel("\(tab.title) tab")
                .accessibilityAddTraits(activeTab == tab ? [.isSelected] : [])
                .accessibilityHint("Double tap to show \(tab.title.lowercased())")
            }
        }
        .background(Color(UIColor.systemBackground))
        .accessibilityIdentifier("profile-tab-bar")
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Profile content tabs")
    }

    // MARK: - Loading Skeleton

    private var profileSkeleton: some View {
        VStack(spacing: 0) {
            // Banner skeleton
            SkeletonRect(height: 150)

            VStack(spacing: 16) {
                // Avatar skeleton
                SkeletonCircle(size: 80)
                    .offset(y: -40)
                    .padding(.bottom, -40)

                // Name skeleton
                SkeletonRect(width: 150, height: 24)

                // Handle skeleton
                SkeletonRect(width: 120, height: 16)

                // Bio skeleton
                VStack(spacing: 6) {
                    SkeletonRect(height: 14)
                    SkeletonRect(width: 250, height: 14)
                    SkeletonRect(width: 180, height: 14)
                }

                // Stats skeleton
                HStack(spacing: 32) {
                    VStack(spacing: 4) {
                        SkeletonRect(width: 40, height: 20)
                        SkeletonRect(width: 60, height: 14)
                    }
                    VStack(spacing: 4) {
                        SkeletonRect(width: 40, height: 20)
                        SkeletonRect(width: 60, height: 14)
                    }
                    VStack(spacing: 4) {
                        SkeletonRect(width: 40, height: 20)
                        SkeletonRect(width: 60, height: 14)
                    }
                }

                // Action button skeleton
                SkeletonRect(height: 44, cornerRadius: 22)
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 16)

            // Tab bar skeleton
            HStack(spacing: 0) {
                ForEach(0..<4, id: \.self) { _ in
                    SkeletonRect(width: 60, height: 14)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                }
            }

            Divider()

            // Post list skeleton
            ForEach(0..<3, id: \.self) { _ in
                postCardSkeleton
            }
        }
        .accessibilityLabel("Loading profile")
    }

    private var postCardSkeleton: some View {
        HStack(alignment: .top, spacing: 12) {
            SkeletonCircle(size: 44)

            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    SkeletonRect(width: 100, height: 14)
                    SkeletonRect(width: 80, height: 12)
                }
                SkeletonRect(height: 14)
                SkeletonRect(width: 250, height: 14)
                SkeletonRect(width: 180, height: 14)
            }
        }
        .padding(16)
    }

    // MARK: - Error Views

    private func typedErrorView(_ type: String) -> some View {
        VStack(spacing: 16) {
            Spacer()

            switch type {
            case "deleted":
                Image(systemName: "person.slash")
                    .font(.largeTitle)
                    .foregroundColor(.gray)
                    .accessibilityHidden(true)

                Text("Account Deleted")
                    .font(.title3.weight(.semibold))
                    .foregroundColor(.primary)

                Text("This account has been deleted and is no longer available.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

            case "suspended":
                Image(systemName: "exclamationmark.shield")
                    .font(.largeTitle)
                    .foregroundColor(.orange)
                    .accessibilityHidden(true)

                Text("Account Suspended")
                    .font(.title3.weight(.semibold))
                    .foregroundColor(.primary)

                Text("This account has been suspended for violating community guidelines.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

            case "blocked":
                Image(systemName: "hand.raised")
                    .font(.largeTitle)
                    .foregroundColor(.red)
                    .accessibilityHidden(true)

                Text("Blocked Account")
                    .font(.title3.weight(.semibold))
                    .foregroundColor(.primary)

                Text("You have blocked this account.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)

            default:
                errorViewContent(errorMessage: "Something went wrong")
            }

            Spacer()
        }
        .accessibilityElement(children: .combine)
    }

    private func errorView(_ errorMessage: String) -> some View {
        VStack(spacing: 16) {
            Spacer()
            errorViewContent(errorMessage: errorMessage)
            Spacer()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Error loading profile: \(errorMessage)")
    }

    private func errorViewContent(errorMessage: String) -> some View {
        Group {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundColor(.red)
                .accessibilityHidden(true)

            Text("Failed to load profile")
                .font(.title3.weight(.semibold))
                .foregroundColor(.primary)

            Text(errorMessage)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }
}

// MARK: - Skeleton Components

private struct SkeletonRect: View {
    var width: CGFloat? = nil
    var height: CGFloat
    var cornerRadius: CGFloat = 4

    @State private var isAnimating = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(
                reduceMotion
                    ? LinearGradient(
                        colors: [Color.gray.opacity(0.2)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    : LinearGradient(
                        colors: [
                            Color.gray.opacity(0.15),
                            Color.gray.opacity(0.25),
                            Color.gray.opacity(0.15)
                        ],
                        startPoint: isAnimating ? .trailing : .leading,
                        endPoint: isAnimating ? .init(x: 2, y: 0) : .trailing
                    )
            )
            .frame(width: width, height: height)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(
                    .linear(duration: 1.5)
                    .repeatForever(autoreverses: false)
                ) {
                    isAnimating = true
                }
            }
    }
}

private struct SkeletonCircle: View {
    let size: CGFloat

    @State private var isAnimating = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Circle()
            .fill(
                reduceMotion
                    ? LinearGradient(
                        colors: [Color.gray.opacity(0.2)],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    : LinearGradient(
                        colors: [
                            Color.gray.opacity(0.15),
                            Color.gray.opacity(0.25),
                            Color.gray.opacity(0.15)
                        ],
                        startPoint: isAnimating ? .trailing : .leading,
                        endPoint: isAnimating ? .init(x: 2, y: 0) : .trailing
                    )
            )
            .frame(width: size, height: size)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(
                    .linear(duration: 1.5)
                    .repeatForever(autoreverses: false)
                ) {
                    isAnimating = true
                }
            }
    }
}

// MARK: - Profile State Observer

/// Observable state for profile data, starter packs, and pinned post
class ProfileState: ObservableObject {
    @Published var profile: SerializedProfile?
    @Published var starterPacks: [SerializedStarterPack] = []
    @Published var pinnedPost: SerializedPinnedPost?

    private var profileObserver: NSObjectProtocol?
    private var clearObserver: NSObjectProtocol?
    private var starterPacksObserver: NSObjectProtocol?
    private var pinnedPostObserver: NSObjectProtocol?

    func startObserving() {
        profileObserver = NotificationCenter.default.addObserver(
            forName: ProfileBridgeModule.profileDataUpdatedNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let profile = notification.userInfo?["profileData"] as? SerializedProfile {
                self?.profile = profile
            }
        }

        clearObserver = NotificationCenter.default.addObserver(
            forName: ProfileBridgeModule.profileDataClearedNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.profile = nil
            self?.starterPacks = []
            self?.pinnedPost = nil
        }

        starterPacksObserver = NotificationCenter.default.addObserver(
            forName: ProfileBridgeModule.starterPacksUpdatedNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let packs = notification.userInfo?["starterPacks"] as? [SerializedStarterPack] {
                self?.starterPacks = packs
            }
        }

        pinnedPostObserver = NotificationCenter.default.addObserver(
            forName: ProfileBridgeModule.pinnedPostUpdatedNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let pinnedPost = notification.userInfo?["pinnedPost"] as? SerializedPinnedPost {
                self?.pinnedPost = pinnedPost
            }
        }
    }

    deinit {
        stopObserving()
    }

    func stopObserving() {
        [profileObserver, clearObserver, starterPacksObserver, pinnedPostObserver].forEach { observer in
            if let observer = observer {
                NotificationCenter.default.removeObserver(observer)
            }
        }
        profileObserver = nil
        clearObserver = nil
        starterPacksObserver = nil
        pinnedPostObserver = nil
    }
}

// MARK: - Preview

#if DEBUG
struct ProfileView_Previews: PreviewProvider {
    static var previews: some View {
        Group {
            // Loading state
            ProfileView(
                isOwnProfile: false,
                isLoadingProfile: true,
                isRefreshing: false,
                isFollowPending: false,
                isMessagePending: false,
                error: nil,
                errorType: nil,
                onRefresh: {},
                onTabChange: { _ in },
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
            .previewDisplayName("Loading")

            // Deleted account
            ProfileView(
                isOwnProfile: false,
                isLoadingProfile: false,
                isRefreshing: false,
                isFollowPending: false,
                isMessagePending: false,
                error: "Account deleted",
                errorType: "deleted",
                onRefresh: {},
                onTabChange: { _ in },
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
            .previewDisplayName("Deleted Account")

            // Suspended account
            ProfileView(
                isOwnProfile: false,
                isLoadingProfile: false,
                isRefreshing: false,
                isFollowPending: false,
                isMessagePending: false,
                error: "Account suspended",
                errorType: "suspended",
                onRefresh: {},
                onTabChange: { _ in },
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
            .previewDisplayName("Suspended Account")
        }
    }
}
#endif
