//
//  MessageComposerView.swift
//  NativeMessages
//
//  SwiftUI message input composer with text field, image attachment button,
//  image preview strip, and send button. Handles keyboard avoidance natively.
//

import SwiftUI

// MARK: - Composer State

class MessageComposerState: ObservableObject {
    @Published var text: String = ""
    @Published var isSending: Bool = false
    @Published var imagePreviewUrls: [String] = []

    func reset() {
        text = ""
        isSending = false
        imagePreviewUrls = []
    }
}

// MARK: - Message Composer View

struct MessageComposerView: View {
    @ObservedObject var composerState: MessageComposerState

    let onSendMessage: ((String) -> Void)?
    let onPickImage: (() -> Void)?

    private var canSend: Bool {
        !composerState.isSending && (!composerState.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !composerState.imagePreviewUrls.isEmpty)
    }

    var body: some View {
        VStack(spacing: 0) {
            Divider()

            // Image previews
            if !composerState.imagePreviewUrls.isEmpty {
                imagePreviewStrip
            }

            // Input row
            HStack(alignment: .bottom, spacing: 8) {
                // Attach button
                Button(action: { onPickImage?() }) {
                    Image(systemName: "photo")
                        .font(.system(size: 22))
                        .foregroundColor(
                            composerState.imagePreviewUrls.count >= 4
                                ? Color(UIColor.tertiaryLabel)
                                : MessagesThemeColors.primary
                        )
                }
                .disabled(composerState.imagePreviewUrls.count >= 4)
                .padding(.bottom, 6)

                // Text input
                TextField("Type a message...", text: $composerState.text, axis: .vertical)
                    .textFieldStyle(.plain)
                    .font(.system(size: 16))
                    .lineLimit(1...5)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(Color(UIColor.secondarySystemBackground))
                    .cornerRadius(20)

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
                            .font(.system(size: 16, weight: .semibold))
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

    // MARK: - Image Preview Strip

    private var imagePreviewStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Array(composerState.imagePreviewUrls.enumerated()), id: \.offset) { index, urlString in
                    ZStack(alignment: .topTrailing) {
                        if let url = URL(string: urlString) {
                            AsyncImage(url: url) { phase in
                                switch phase {
                                case .success(let image):
                                    image
                                        .resizable()
                                        .aspectRatio(contentMode: .fill)
                                        .frame(width: 80, height: 80)
                                        .clipped()
                                        .cornerRadius(8)
                                default:
                                    RoundedRectangle(cornerRadius: 8)
                                        .fill(Color(UIColor.tertiarySystemBackground))
                                        .frame(width: 80, height: 80)
                                        .overlay(ProgressView())
                                }
                            }
                        }

                        // Remove button
                        Button(action: {
                            composerState.imagePreviewUrls.remove(at: index)
                        }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 20))
                                .foregroundColor(.white)
                                .shadow(radius: 2)
                        }
                        .offset(x: 4, y: -4)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .frame(height: 96)
    }
}
