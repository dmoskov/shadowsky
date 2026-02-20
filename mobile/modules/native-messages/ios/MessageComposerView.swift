//
//  MessageComposerView.swift
//  NativeMessages
//
//  SwiftUI message input composer with text field and send button.
//  Handles keyboard avoidance natively.
//

import SwiftUI

// MARK: - Composer State

class MessageComposerState: ObservableObject {
    @Published var text: String = ""
    @Published var isSending: Bool = false

    func reset() {
        text = ""
        isSending = false
    }
}

// MARK: - Message Composer View

struct MessageComposerView: View {
    @ObservedObject var composerState: MessageComposerState

    let onSendMessage: ((String) -> Void)?

    private var canSend: Bool {
        !composerState.isSending && !composerState.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        VStack(spacing: 0) {
            Divider()

            // Input row
            HStack(alignment: .bottom, spacing: 8) {
                // Text input
                if #available(iOS 16.0, *) {
                    TextField("Type a message...", text: $composerState.text, axis: .vertical)
                        .textFieldStyle(.plain)
                        .font(.body)
                        .lineLimit(1...5)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(20)
                } else {
                    TextField("Type a message...", text: $composerState.text)
                        .textFieldStyle(.plain)
                        .font(.body)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(20)
                }

                // Send button
                Button(action: {
                    guard canSend else { return }
                    let text = composerState.text.trimmingCharacters(in: .whitespacesAndNewlines)
                    composerState.isSending = true
                    onSendMessage?(text)
                }) {
                    if composerState.isSending {
                        ProgressView()
                            .frame(width: 36, height: 36)
                    } else {
                        Text("Send")
                            .font(.body.weight(.semibold))
                            .foregroundColor(canSend ? .white : Color(UIColor.tertiaryLabel))
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(canSend ? MessagesThemeColors.primary : Color(UIColor.secondarySystemBackground))
                            .cornerRadius(20)
                    }
                }
                .disabled(!canSend)
                .padding(.bottom, 2)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
    }
}
