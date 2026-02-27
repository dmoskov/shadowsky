//
//  ComposeMentionSuggestions.swift
//  NativeCompose
//
//  Mention autocomplete suggestions dropdown for the compose screen.
//

import SwiftUI

// MARK: - Mention Suggestions View

struct ComposeMentionSuggestionsView: View {
    let suggestions: [ComposeMentionSuggestion]
    let onSelect: (ComposeMentionSuggestion) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(suggestions.prefix(5)) { suggestion in
                MentionSuggestionRow(
                    suggestion: suggestion,
                    onSelect: onSelect
                )

                if suggestion.id != suggestions.prefix(5).last?.id {
                    Divider()
                        .padding(.leading, 52)
                }
            }
        }
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: -4)
        .padding(.horizontal, 8)
        .padding(.bottom, 4)
    }
}

// MARK: - Mention Suggestion Row

/// Individual suggestion row that uses a UIKit-backed tap handler to ensure
/// taps register reliably even when the keyboard is showing. Standard SwiftUI
/// Buttons can have their taps swallowed by the keyboard dismissal gesture
/// recognizer on iOS.
private struct MentionSuggestionRow: View {
    let suggestion: ComposeMentionSuggestion
    let onSelect: (ComposeMentionSuggestion) -> Void

    @State private var isPressed = false

    var body: some View {
        HStack(spacing: 10) {
            avatarView

            VStack(alignment: .leading, spacing: 2) {
                if let displayName = suggestion.displayName, !displayName.isEmpty {
                    Text(displayName)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)
                        .lineLimit(1)
                }
                Text("@\(suggestion.handle)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .contentShape(Rectangle())
        .opacity(isPressed ? 0.7 : 1.0)
        .background(
            // Use a UIKit-backed tap target that won't be blocked by
            // the keyboard dismissal gesture recognizer
            KeyboardSafeTapView {
                onSelect(suggestion)
            }
        )
        .accessibilityLabel(suggestion.displayName?.isEmpty == false ? suggestion.displayName! : suggestion.handle)
        .accessibilityHint("Double tap to mention @\(suggestion.handle)")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Avatar

    @ViewBuilder
    private var avatarView: some View {
        if let avatarUrl = suggestion.avatar, let url = URL(string: avatarUrl) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 32, height: 32)
                        .clipShape(Circle())
                case .failure, .empty:
                    defaultAvatar
                @unknown default:
                    defaultAvatar
                }
            }
            .frame(width: 32, height: 32)
        } else {
            defaultAvatar
        }
    }

    private var defaultAvatar: some View {
        Image(systemName: "person.circle.fill")
            .resizable()
            .frame(width: 32, height: 32)
            .foregroundColor(.secondary)
    }
}

// MARK: - KeyboardSafeTapView

/// A UIKit-backed view that handles taps without being blocked by the keyboard
/// dismissal gesture. On iOS, when a UITextView (TextEditor) has focus, the
/// system adds a gesture recognizer that can prevent other tappable views from
/// receiving touches. This UIView-based approach ensures taps always register.
private struct KeyboardSafeTapView: UIViewRepresentable {
    let onTap: () -> Void

    func makeUIView(context: Context) -> KeyboardSafeTapUIView {
        let view = KeyboardSafeTapUIView()
        view.onTap = onTap
        view.backgroundColor = .clear
        return view
    }

    func updateUIView(_ uiView: KeyboardSafeTapUIView, context: Context) {
        uiView.onTap = onTap
    }
}

/// UIView that handles touch events directly, bypassing SwiftUI's gesture
/// system which can conflict with keyboard dismissal.
private class KeyboardSafeTapUIView: UIView {
    var onTap: (() -> Void)?

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        super.touchesEnded(touches, with: event)
        guard let touch = touches.first else { return }
        let location = touch.location(in: self)
        if bounds.contains(location) {
            onTap?()
        }
    }
}

// MARK: - Mention Manager

class ComposeMentionManager: ObservableObject {
    @Published var suggestions: [ComposeMentionSuggestion] = []

    private var observer: NSObjectProtocol?

    static let mentionResultsNotification = NSNotification.Name("ComposeMentionSearchResults")

    func startObserving() {
        observer = NotificationCenter.default.addObserver(
            forName: Self.mentionResultsNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let results = notification.userInfo?["results"] as? [[String: Any]] else {
                self?.suggestions = []
                return
            }
            self?.suggestions = results.compactMap { ComposeMentionSuggestion.parse(from: $0) }
        }
    }

    func stopObserving() {
        if let observer = observer {
            NotificationCenter.default.removeObserver(observer)
        }
        observer = nil
    }

    deinit {
        stopObserving()
    }
}
