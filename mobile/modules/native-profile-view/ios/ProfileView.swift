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
    let error: String?

    // Event handlers
    let onRefresh: (() -> Void)?
    let onTabChange: ((String) -> Void)?
    let onFollowToggle: (() -> Void)?
    let onMessagePress: (() -> Void)?
    let onMenuPress: (() -> Void)?
    let onFollowersPress: (() -> Void)?
    let onFollowingPress: (() -> Void)?
    let onEditProfile: (() -> Void)?

    // MARK: - Body

    var body: some View {
        ZStack {
            if isLoadingProfile && profileState.profile == nil {
                // Initial loading state
                loadingView
            } else if let error = error, profileState.profile == nil {
                // Error state
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
                onFollowToggle: onFollowToggle,
                onMessagePress: onMessagePress,
                onMenuPress: onMenuPress,
                onFollowersPress: onFollowersPress,
                onFollowingPress: onFollowingPress,
                onEditProfile: onEditProfile
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
                            .font(.system(size: 15, weight: activeTab == tab ? .semibold : .regular))
                            .foregroundColor(activeTab == tab ? .blue : .secondary)

                        Rectangle()
                            .fill(activeTab == tab ? Color.blue : Color.clear)
                            .frame(height: 3)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                }
                .buttonStyle(.plain)
            }
        }
        .background(Color(UIColor.systemBackground))
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack {
            Spacer()
            ProgressView()
                .scaleEffect(1.5)
            Spacer()
        }
    }

    // MARK: - Error View

    private func errorView(_ errorMessage: String) -> some View {
        VStack(spacing: 16) {
            Spacer()

            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(.red)

            Text("Failed to load profile")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(.primary)

            Text(errorMessage)
                .font(.system(size: 14))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Spacer()
        }
    }
}

// MARK: - Profile State Observer

/// Observable state for profile data
class ProfileState: ObservableObject {
    @Published var profile: SerializedProfile?

    private var observer: NSObjectProtocol?

    func startObserving() {
        observer = NotificationCenter.default.addObserver(
            forName: ProfileBridgeModule.profileDataUpdatedNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let profile = notification.userInfo?["profileData"] as? SerializedProfile {
                self?.profile = profile
            }
        }
    }

    func stopObserving() {
        if let observer = observer {
            NotificationCenter.default.removeObserver(observer)
            self.observer = nil
        }
    }
}

// MARK: - Preview

#if DEBUG
struct ProfileView_Previews: PreviewProvider {
    static var previews: some View {
        ProfileView(
            isOwnProfile: false,
            isLoadingProfile: false,
            isRefreshing: false,
            error: nil,
            onRefresh: {},
            onTabChange: { _ in },
            onFollowToggle: {},
            onMessagePress: {},
            onMenuPress: {},
            onFollowersPress: {},
            onFollowingPress: {},
            onEditProfile: {}
        )
    }
}
#endif
