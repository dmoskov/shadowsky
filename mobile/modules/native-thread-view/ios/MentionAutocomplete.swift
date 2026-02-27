//
//  MentionAutocomplete.swift
//  NativeThreadView
//
//  @mention autocomplete suggestion list that appears above the composer.
//  Receives suggestions from JS via NotificationCenter (bridge pushes search results).
//

import SwiftUI

// MARK: - Mention Suggestion Model

struct MentionSuggestion: Identifiable, Equatable {
    let id: String  // DID
    let handle: String
    let displayName: String?
    let avatar: String?

    static func parse(from dict: [String: Any]) -> MentionSuggestion? {
        guard let did = dict["did"] as? String,
              let handle = dict["handle"] as? String else {
            return nil
        }
        return MentionSuggestion(
            id: did,
            handle: handle,
            displayName: dict["displayName"] as? String,
            avatar: dict["avatar"] as? String
        )
    }
}

// MARK: - Mention Suggestions View

/// Dropdown list of mention suggestions shown above the composer
struct MentionSuggestionsView: View {
    let suggestions: [MentionSuggestion]
    let onSelect: (MentionSuggestion) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(suggestions.prefix(5)) { suggestion in
                Button(action: { onSelect(suggestion) }) {
                    HStack(spacing: 10) {
                        // Avatar
                        avatarView(suggestion: suggestion)

                        // Name and handle
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
                .accessibilityLabel(suggestion.displayName.orIfEmpty(suggestion.handle))
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
    private func avatarView(suggestion: MentionSuggestion) -> some View {
        if let avatarUrl = suggestion.avatar, let url = URL(string: avatarUrl) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 32, height: 32)
                        .clipShape(Circle())
                case .failure:
                    defaultAvatar
                case .empty:
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

/// Manages mention search results delivered from JS via NotificationCenter
class MentionManager: ObservableObject {
    @Published var suggestions: [MentionSuggestion] = []

    private var observer: NSObjectProtocol?

    static let mentionResultsNotification = NSNotification.Name("ThreadMentionSearchResults")

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
            self?.suggestions = results.compactMap { MentionSuggestion.parse(from: $0) }
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

// MARK: - Preview

#if DEBUG
struct MentionSuggestionsView_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            Spacer()
            MentionSuggestionsView(
                suggestions: [
                    MentionSuggestion(id: "did:1", handle: "alice.bsky.social", displayName: "Alice", avatar: nil),
                    MentionSuggestion(id: "did:2", handle: "bob.bsky.social", displayName: "Bob Smith", avatar: nil),
                    MentionSuggestion(id: "did:3", handle: "charlie.bsky.social", displayName: nil, avatar: nil),
                ],
                onSelect: { _ in }
            )
        }
        .background(Color(UIColor.systemBackground))
    }
}
#endif
