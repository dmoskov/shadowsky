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
                Button(action: { onSelect(suggestion) }) {
                    HStack(spacing: 10) {
                        avatarView(suggestion: suggestion)

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
                }
                .buttonStyle(.plain)
                .accessibilityLabel(suggestion.displayName ?? suggestion.handle)
                .accessibilityHint("Double tap to mention @\(suggestion.handle)")

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

    // MARK: - Avatar

    @ViewBuilder
    private func avatarView(suggestion: ComposeMentionSuggestion) -> some View {
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
