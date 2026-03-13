import SwiftUI
import SDWebImage
import ExpoSwiftUIFeed

/// A UIViewRepresentable that wraps SDAnimatedImageView to render animated GIFs in SwiftUI.
///
/// Uses SDWebImage's native animated image support which handles frame decoding
/// and playback without converting to static frames.
struct NativeFeedAnimatedGifView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> SDAnimatedImageView {
        let imageView = SDAnimatedImageView()
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.autoPlayAnimatedImage = true
        imageView.sd_setImage(with: url)
        return imageView
    }

    func updateUIView(_ uiView: SDAnimatedImageView, context: Context) {
        if uiView.sd_imageURL != url {
            uiView.sd_setImage(with: url)
        }
    }
}

/// SwiftUI wrapper that displays an animated GIF with a "GIF" badge overlay.
struct NativeFeedAnimatedGifEmbed: View {
    let url: URL
    let aspectRatio: CGFloat?
    let onPress: ((String) -> Void)?

    init(url: URL, aspectRatio: CGFloat? = nil, onPress: ((String) -> Void)? = nil) {
        self.url = url
        self.aspectRatio = aspectRatio
        self.onPress = onPress
    }

    var body: some View {
        Button(action: handlePress) {
            ZStack(alignment: .bottomLeading) {
                GeometryReader { geo in
                    NativeFeedAnimatedGifView(url: url)
                        .frame(width: geo.size.width, height: geo.size.height)
                }

                // GIF badge
                Text("GIF")
                    .font(.caption2.weight(.bold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.black.opacity(0.7))
                    .cornerRadius(4)
                    .padding(8)
            }
        }
        .buttonStyle(PlainButtonStyle())
        .frame(maxWidth: .infinity)
        .frame(height: gifHeight)
        .cornerRadius(12)
        .clipped()
        .padding(.vertical, 8)
    }

    private var gifHeight: CGFloat {
        guard let ratio = aspectRatio, ratio > 0 else {
            return 300
        }
        let availableWidth = min(UIScreen.main.bounds.width - 32, LayoutConstants.maxContentWidth)
        return min(max(availableWidth / ratio, 150), 600)
    }

    private func handlePress() {
        onPress?(url.absoluteString)
    }
}

// MARK: - GIF URL Detection

/// Detects whether a URL points to an animated GIF from known GIF providers.
func isGifURL(_ uri: String) -> Bool {
    uri.contains("media.tenor.com") || uri.contains("t.gifs.bsky.app")
}

/// Parse width/height from Tenor-style URL query parameters (?hh=HEIGHT&ww=WIDTH)
/// and return the aspect ratio (width / height).
func parseGifAspectRatio(from urlString: String) -> CGFloat? {
    guard let components = URLComponents(string: urlString),
          let queryItems = components.queryItems else {
        return nil
    }
    let hh = queryItems.first(where: { $0.name == "hh" })?.value.flatMap { Double($0) }
    let ww = queryItems.first(where: { $0.name == "ww" })?.value.flatMap { Double($0) }
    guard let width = ww, let height = hh, height > 0 else {
        return nil
    }
    return CGFloat(width / height)
}
