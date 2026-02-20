//
//  ComposeMediaGrid.swift
//  NativeCompose
//
//  Grid view showing attached media (images/video/GIF) with remove and alt text buttons.
//

import SwiftUI

// MARK: - Media Grid

struct ComposeMediaGrid: View {
    let attachments: [MediaAttachment]
    let isUploading: Bool
    let onRemove: (Int) -> Void
    let onEditAltText: (Int) -> Void

    var body: some View {
        if attachments.isEmpty { return AnyView(EmptyView()) }

        return AnyView(
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(Array(attachments.enumerated()), id: \.element.id) { index, attachment in
                        mediaCard(attachment: attachment, index: index)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
        )
    }

    // MARK: - Media Card

    @ViewBuilder
    private func mediaCard(attachment: MediaAttachment, index: Int) -> some View {
        ZStack(alignment: .topTrailing) {
            // Image thumbnail
            AsyncImage(url: URL(string: attachment.uri)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 80, height: 80)
                        .clipped()
                case .failure:
                    placeholderView(isVideo: attachment.isVideo)
                case .empty:
                    if isUploading {
                        ZStack {
                            placeholderView(isVideo: attachment.isVideo)
                            ProgressView()
                        }
                    } else {
                        placeholderView(isVideo: attachment.isVideo)
                    }
                @unknown default:
                    placeholderView(isVideo: attachment.isVideo)
                }
            }
            .frame(width: 80, height: 80)
            .cornerRadius(8)

            // Video indicator
            if attachment.isVideo {
                VStack {
                    Spacer()
                    HStack {
                        Image(systemName: "play.fill")
                            .font(.caption2)
                            .foregroundColor(.white)
                        if let duration = attachment.duration {
                            Text(formatDuration(duration))
                                .font(.caption2)
                                .foregroundColor(.white)
                        }
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.black.opacity(0.7))
                    .cornerRadius(4)
                    .padding(4)
                }
                .frame(width: 80, height: 80, alignment: .bottomLeading)
            }

            // Remove button
            Button(action: { onRemove(index) }) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundColor(.white)
                    .shadow(color: .black.opacity(0.3), radius: 2, x: 0, y: 1)
            }
            .disabled(isUploading)
            .offset(x: 6, y: -6)

            // Alt text badge (images only)
            if !attachment.isVideo {
                VStack {
                    Spacer()
                    HStack {
                        Button(action: { onEditAltText(index) }) {
                            Text(attachment.altText.isEmpty ? "ALT" : "ALT")
                                .font(.caption2.weight(.bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(attachment.altText.isEmpty ? Color.black.opacity(0.7) : Color.green.opacity(0.8))
                                .cornerRadius(4)
                        }
                        .disabled(isUploading)
                        Spacer()
                    }
                    .padding(4)
                }
                .frame(width: 80, height: 80)
            }

            // Uploading overlay
            if isUploading {
                Color.black.opacity(0.4)
                    .frame(width: 80, height: 80)
                    .cornerRadius(8)
                    .overlay(
                        ProgressView()
                            .tint(.white)
                    )
            }
        }
    }

    // MARK: - Helpers

    private func placeholderView(isVideo: Bool) -> some View {
        RoundedRectangle(cornerRadius: 8)
            .fill(Color(UIColor.tertiarySystemGroupedBackground))
            .frame(width: 80, height: 80)
            .overlay(
                Image(systemName: isVideo ? "video.fill" : "photo")
                    .foregroundColor(.secondary)
                    .font(.title3)
            )
    }

    private func formatDuration(_ seconds: Double) -> String {
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }
}

// MARK: - Preview

#if DEBUG
struct ComposeMediaGrid_Previews: PreviewProvider {
    static var previews: some View {
        ComposeMediaGrid(
            attachments: [
                MediaAttachment(id: "1", uri: "https://example.com/1.jpg", mimeType: "image/jpeg", altText: "", width: 100, height: 100, isVideo: false),
                MediaAttachment(id: "2", uri: "https://example.com/2.jpg", mimeType: "image/jpeg", altText: "A cat", width: 100, height: 100, isVideo: false),
            ],
            isUploading: false,
            onRemove: { _ in },
            onEditAltText: { _ in }
        )
        .previewLayout(.sizeThatFits)
    }
}
#endif
