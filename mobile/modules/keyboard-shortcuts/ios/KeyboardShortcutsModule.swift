//
// KeyboardShortcutsModule.swift
// Keyboard Shortcuts Module
//
// Expo Module for registering iPad hardware keyboard shortcuts via UIKeyCommand.
// Shortcuts appear in the iPadOS discoverability overlay (hold Cmd key).
//

import ExpoModulesCore
import UIKit

public class KeyboardShortcutsModule: Module {
    private var observer: NSObjectProtocol?

    public func definition() -> ModuleDefinition {
        Name("KeyboardShortcuts")

        Events("onKeyCommand")

        OnStartObserving {
            self.observer = NotificationCenter.default.addObserver(
                forName: .keyboardShortcutTriggered,
                object: nil,
                queue: .main
            ) { [weak self] notification in
                guard let command = notification.userInfo?["command"] as? String else { return }
                self?.sendEvent("onKeyCommand", ["command": command])
            }
            KeyCommandInstaller.shared.install()
        }

        OnStopObserving {
            if let observer = self.observer {
                NotificationCenter.default.removeObserver(observer)
            }
            self.observer = nil
            KeyCommandInstaller.shared.uninstall()
        }
    }
}

// MARK: - Notification name

extension Notification.Name {
    static let keyboardShortcutTriggered = Notification.Name("KeyboardShortcutTriggered")
}

// MARK: - Key command installer

/// Installs keyboard shortcuts by adding a child UIViewController to the root
/// view controller. The child overrides `keyCommands` to register shortcuts
/// through the standard UIResponder chain. This avoids method swizzling and
/// works reliably with Expo/React Native's view hierarchy.
final class KeyCommandInstaller {
    static let shared = KeyCommandInstaller()
    private var helperVC: KeyCommandViewController?
    private var installed = false

    func install() {
        guard !installed else { return }
        installed = true

        DispatchQueue.main.async { [weak self] in
            guard let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first,
                  let window = scene.windows.first,
                  let rootVC = window.rootViewController else {
                NSLog("[KeyboardShortcuts] Could not find root view controller")
                return
            }

            let helper = KeyCommandViewController()
            rootVC.addChild(helper)
            // The helper view is invisible -- zero frame, no interaction
            helper.view.frame = .zero
            helper.view.isUserInteractionEnabled = false
            rootVC.view.addSubview(helper.view)
            helper.didMove(toParent: rootVC)
            self?.helperVC = helper
        }
    }

    func uninstall() {
        guard installed else { return }
        installed = false

        DispatchQueue.main.async { [weak self] in
            guard let helper = self?.helperVC else { return }
            helper.willMove(toParent: nil)
            helper.view.removeFromSuperview()
            helper.removeFromParent()
            self?.helperVC = nil
        }
    }
}

// MARK: - Key command view controller

/// Invisible view controller that provides UIKeyCommand shortcuts to the
/// responder chain. Each shortcut fires a NotificationCenter notification
/// which the Expo module forwards to JavaScript as an event.
final class KeyCommandViewController: UIViewController {
    override var canBecomeFirstResponder: Bool { true }

    private struct Shortcut {
        let input: String
        let modifiers: UIKeyModifierFlags
        let command: String
        let title: String
    }

    private let shortcuts: [Shortcut] = [
        Shortcut(input: "n", modifiers: .command, command: "compose", title: "New Post"),
        Shortcut(input: "k", modifiers: .command, command: "search", title: "Search"),
        Shortcut(input: "1", modifiers: .command, command: "tab:home", title: "Home"),
        Shortcut(input: "2", modifiers: .command, command: "tab:search", title: "Search Tab"),
        Shortcut(input: "3", modifiers: .command, command: "tab:feeds", title: "Feeds Tab"),
        Shortcut(input: "4", modifiers: .command, command: "tab:notifications", title: "Notifications"),
        Shortcut(input: "5", modifiers: .command, command: "tab:profile", title: "Profile"),
        Shortcut(input: "r", modifiers: .command, command: "refresh", title: "Refresh"),
        Shortcut(input: "\r", modifiers: .command, command: "submit", title: "Submit"),
    ]

    override var keyCommands: [UIKeyCommand]? {
        return shortcuts.map { shortcut in
            let cmd = UIKeyCommand(
                input: shortcut.input,
                modifierFlags: shortcut.modifiers,
                action: #selector(handleKeyCommand(_:)),
                discoverabilityTitle: shortcut.title
            )
            return cmd
        }
    }

    @objc private func handleKeyCommand(_ sender: UIKeyCommand) {
        guard let input = sender.input else { return }
        let modifiers = sender.modifierFlags

        for shortcut in shortcuts {
            if shortcut.input == input && shortcut.modifiers == modifiers {
                NotificationCenter.default.post(
                    name: .keyboardShortcutTriggered,
                    object: nil,
                    userInfo: ["command": shortcut.command]
                )
                return
            }
        }
    }
}
