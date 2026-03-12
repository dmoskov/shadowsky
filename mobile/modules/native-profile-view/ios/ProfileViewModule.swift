//
//  ProfileViewModule.swift
//  NativeProfileView
//
//  Created by Claude Code
//  Expo Module for native SwiftUI ProfileView
//

import ExpoModulesCore
import SwiftUI

// MARK: - Profile Props

/// ObservableObject for props passed from React Native.
/// Using an observable object allows SwiftUI to diff individual property
/// changes instead of replacing the entire rootView on every prop update.
class ProfileProps: ObservableObject {
    @Published var isOwnProfile: Bool = false
    @Published var isLoadingProfile: Bool = true  // Default true to show skeleton before React sets state
    @Published var isRefreshing: Bool = false
    @Published var isFollowPending: Bool = false
    @Published var isMessagePending: Bool = false
    @Published var error: String? = nil
    @Published var errorType: String? = nil
}

public class ProfileViewModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeProfileView")

        // View component that can be used in React Native
        View(ProfileViewWrapper.self) {
            // Props - update the shared ProfileProps object directly
            // instead of replacing the entire SwiftUI rootView
            Prop("isOwnProfile") { (view: ProfileViewWrapper, isOwnProfile: Bool) in
                view.profileProps.isOwnProfile = isOwnProfile
            }

            Prop("isLoadingProfile") { (view: ProfileViewWrapper, isLoadingProfile: Bool) in
                view.profileProps.isLoadingProfile = isLoadingProfile
            }

            Prop("isRefreshing") { (view: ProfileViewWrapper, isRefreshing: Bool) in
                view.profileProps.isRefreshing = isRefreshing
            }

            Prop("isFollowPending") { (view: ProfileViewWrapper, isFollowPending: Bool) in
                view.profileProps.isFollowPending = isFollowPending
            }

            Prop("isMessagePending") { (view: ProfileViewWrapper, isMessagePending: Bool) in
                view.profileProps.isMessagePending = isMessagePending
            }

            Prop("error") { (view: ProfileViewWrapper, error: String?) in
                view.profileProps.error = error
            }

            Prop("errorType") { (view: ProfileViewWrapper, errorType: String?) in
                view.profileProps.errorType = errorType
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
                "onEditProfile",
                "onAddToList",
                "onPinnedPostPress",
                "onStarterPackPress",
                "onSignOut",
                "onKnownFollowerPress",
                "onContentSizeChange"
            )
        }
    }
}

// MARK: - View Wrapper

/// UIKit wrapper for SwiftUI ProfileView.
/// Props are stored in a shared ProfileProps ObservableObject so that
/// SwiftUI can diff individual property changes without replacing the
/// entire rootView (which would destroy state and cause flickering).
class ProfileViewWrapper: ExpoView {
    // Shared props object - mutated by Expo prop setters, observed by SwiftUI
    let profileProps = ProfileProps()

    // Event handlers
    private let onRefresh = EventDispatcher()
    private let onTabChange = EventDispatcher()
    private let onFollowToggle = EventDispatcher()
    private let onMessagePress = EventDispatcher()
    private let onMenuPress = EventDispatcher()
    private let onFollowersPress = EventDispatcher()
    private let onFollowingPress = EventDispatcher()
    private let onEditProfile = EventDispatcher()
    private let onAddToList = EventDispatcher()
    private let onPinnedPostPress = EventDispatcher()
    private let onStarterPackPress = EventDispatcher()
    private let onSignOut = EventDispatcher()
    private let onKnownFollowerPress = EventDispatcher()
    private let onContentSizeChange = EventDispatcher()

    // SwiftUI hosting controller
    private var hostingController: UIHostingController<ProfileView>?

    // Track current measured height for self-sizing
    private var currentHeight: CGFloat = 400

    // Notification observers
    private var profileObserver: NSObjectProtocol?
    private var clearObserver: NSObjectProtocol?
    private var starterPacksObserver: NSObjectProtocol?
    private var pinnedPostObserver: NSObjectProtocol?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
        observeDataChanges()
    }

    deinit {
        [profileObserver, clearObserver, starterPacksObserver, pinnedPostObserver].forEach { observer in
            if let observer = observer {
                NotificationCenter.default.removeObserver(observer)
            }
        }
    }

    private func observeDataChanges() {
        profileObserver = NotificationCenter.default.addObserver(
            forName: ProfileBridgeModule.profileDataUpdatedNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.recalculateHeight()
        }

        clearObserver = NotificationCenter.default.addObserver(
            forName: ProfileBridgeModule.profileDataClearedNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.recalculateHeight()
        }

        starterPacksObserver = NotificationCenter.default.addObserver(
            forName: ProfileBridgeModule.starterPacksUpdatedNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.recalculateHeight()
        }

        pinnedPostObserver = NotificationCenter.default.addObserver(
            forName: ProfileBridgeModule.pinnedPostUpdatedNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.recalculateHeight()
        }
    }

    private func recalculateHeight() {
        guard let hostingController = hostingController else { return }

        // Force the SwiftUI view to re-layout with the new data
        hostingController.view.setNeedsLayout()
        hostingController.view.layoutIfNeeded()

        let width = bounds.width > 0 ? bounds.width : (window?.bounds.width ?? 390)
        let fittingSize = hostingController.sizeThatFits(in: CGSize(width: width, height: .greatestFiniteMagnitude))

        if fittingSize.height > 0 && abs(fittingSize.height - currentHeight) > 1 {
            currentHeight = fittingSize.height
            invalidateIntrinsicContentSize()
            // Tell React Native to re-measure this view
            superview?.setNeedsLayout()
            // Also emit event so RN wrapper can explicitly set height
            onContentSizeChange(["height": fittingSize.height, "width": width])
        }
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

    override func didMoveToWindow() {
        super.didMoveToWindow()
        // Retry parent VC attachment when the view moves to a window
        if let hostingController = hostingController,
           hostingController.parent == nil,
           let parentVC = findViewController() {
            parentVC.addChild(hostingController)
            hostingController.didMove(toParent: parentVC)
        }
        // Recalculate once we're in the view hierarchy
        DispatchQueue.main.async { [weak self] in
            self?.recalculateHeight()
        }
    }

    override var intrinsicContentSize: CGSize {
        let width = bounds.width > 0 ? bounds.width : (window?.bounds.width ?? 390)
        return CGSize(width: width, height: currentHeight)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        recalculateHeight()
    }

    private func findViewController() -> UIViewController? {
        var responder: UIResponder? = self
        while let next = responder?.next {
            if let vc = next as? UIViewController {
                return vc
            }
            responder = next
        }
        return nil
    }

    private func createProfileView() -> ProfileView {
        ProfileView(
            props: profileProps,
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
            },
            onAddToList: { [weak self] in
                self?.onAddToList([:])
            },
            onPinnedPostPress: { [weak self] uri in
                self?.onPinnedPostPress(["uri": uri])
            },
            onStarterPackPress: { [weak self] uri in
                self?.onStarterPackPress(["uri": uri])
            },
            onSignOut: { [weak self] in
                self?.onSignOut([:])
            },
            onKnownFollowerPress: { [weak self] handle in
                self?.onKnownFollowerPress(["handle": handle])
            }
        )
    }
}
