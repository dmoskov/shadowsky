//
//  ProfileViewModule.swift
//  NativeProfileView
//
//  Created by Claude Code
//  Expo Module for native SwiftUI ProfileView
//

import ExpoModulesCore
import SwiftUI

public class ProfileViewModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeProfileView")

        // View component that can be used in React Native
        View(ProfileViewWrapper.self) {
            // Props
            Prop("isOwnProfile") { (view: ProfileViewWrapper, isOwnProfile: Bool) in
                view.isOwnProfile = isOwnProfile
            }

            Prop("isLoadingProfile") { (view: ProfileViewWrapper, isLoadingProfile: Bool) in
                view.isLoadingProfile = isLoadingProfile
            }

            Prop("isRefreshing") { (view: ProfileViewWrapper, isRefreshing: Bool) in
                view.isRefreshing = isRefreshing
            }


            Prop("error") { (view: ProfileViewWrapper, error: String?) in
                view.error = error
            }

            // Events
            Events(
                "onRefresh",
                "onTabChange",
                "onFollowToggle",
                "onMessagePress",
                "onMenuPress",
                "onFollowersPress",
                "onFollowingPress",
                "onEditProfile"
            )
        }
    }
}

// MARK: - View Wrapper

/// UIKit wrapper for SwiftUI ProfileView
class ProfileViewWrapper: ExpoView {
    // Props
    var isOwnProfile: Bool = false {
        didSet { updateView() }
    }

    var isLoadingProfile: Bool = false {
        didSet { updateView() }
    }

    var isRefreshing: Bool = false {
        didSet { updateView() }
    }

    var error: String? = nil {
        didSet { updateView() }
    }

    // Event handlers
    private let onRefresh = EventDispatcher()
    private let onTabChange = EventDispatcher()
    private let onFollowToggle = EventDispatcher()
    private let onMessagePress = EventDispatcher()
    private let onMenuPress = EventDispatcher()
    private let onFollowersPress = EventDispatcher()
    private let onFollowingPress = EventDispatcher()
    private let onEditProfile = EventDispatcher()

    // SwiftUI hosting controller
    private var hostingController: UIHostingController<ProfileView>?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
    }

    private func setupView() {
        let profileView = createProfileView()
        let hostingController = UIHostingController(rootView: profileView)

        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        hostingController.view.backgroundColor = .clear

        addSubview(hostingController.view)

        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])

        self.hostingController = hostingController
    }

    private func updateView() {
        guard let hostingController = hostingController else { return }
        hostingController.rootView = createProfileView()
    }

    private func createProfileView() -> ProfileView {
        ProfileView(
            isOwnProfile: isOwnProfile,
            isLoadingProfile: isLoadingProfile,
            isRefreshing: isRefreshing,
            error: error,
            onRefresh: { [weak self] in
                self?.onRefresh([:])
            },
            onTabChange: { [weak self] tab in
                self?.onTabChange(["tab": tab])
            },
            onFollowToggle: { [weak self] in
                self?.onFollowToggle([:])
            },
            onMessagePress: { [weak self] in
                self?.onMessagePress([:])
            },
            onMenuPress: { [weak self] in
                self?.onMenuPress([:])
            },
            onFollowersPress: { [weak self] in
                self?.onFollowersPress([:])
            },
            onFollowingPress: { [weak self] in
                self?.onFollowingPress([:])
            },
            onEditProfile: { [weak self] in
                self?.onEditProfile([:])
            }
        )
    }
}
