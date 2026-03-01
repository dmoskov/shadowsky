import SwiftUI
import AVKit

/// Model for video embed data
public struct VideoEmbedData: Equatable {
    public let playlist: String
    public let thumbnail: String?
    public let alt: String?
    public let aspectRatio: Double?
    public init(playlist: String, thumbnail: String?, alt: String?, aspectRatio: Double?) {
        self.playlist = playlist
        self.thumbnail = thumbnail
        self.alt = alt
        self.aspectRatio = aspectRatio
    }
}

/// SwiftUI view for video embeds with thumbnail and player
struct VideoEmbed: View {
    let video: VideoEmbedData
    let onPress: ((String) -> Void)?

    @State private var isPlaying = false
    @State private var isLoading = false
    @State private var showThumbnail = true
    @State private var player: AVPlayer?
    @State private var endObserver: NSObjectProtocol?

    init(video: VideoEmbedData, onPress: ((String) -> Void)? = nil) {
        self.video = video
        self.onPress = onPress
    }

    var body: some View {
        VStack(spacing: 0) {
            GeometryReader { geo in
                ZStack {
                    if showThumbnail {
                        thumbnailView
                            .frame(width: geo.size.width, height: geo.size.height)
                    } else {
                        videoPlayerView
                            .frame(width: geo.size.width, height: geo.size.height)
                    }
                }
                .frame(width: geo.size.width, height: geo.size.height)
                .clipped()
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 240)
        .background(Color.gray.opacity(0.2))
        .cornerRadius(12)
        .clipped()
        .padding(.vertical, 8)
        .onAppear {
            setupPlayer()
        }
        .onDisappear {
            cleanupPlayer()
        }
    }

    private var thumbnailView: some View {
        Button(action: handlePlayPress) {
            ZStack {
                // Thumbnail image
                if let thumbnailURL = video.thumbnail, let url = URL(string: thumbnailURL) {
                    GeometryReader { geo in
                        CachedAsyncImage(url: url) { phase in
                            switch phase {
                            case .empty:
                                Color.gray.opacity(0.3)
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: geo.size.width, height: geo.size.height)
                            case .failure:
                                Color.gray.opacity(0.3)
                                    .overlay(
                                        Image(systemName: "video")
                                            .foregroundColor(.gray)
                                    )
                            @unknown default:
                                Color.gray.opacity(0.3)
                            }
                        }
                        .frame(width: geo.size.width, height: geo.size.height)
                        .clipped()
                    }
                } else {
                    Color.gray.opacity(0.3)
                        .overlay(
                            Image(systemName: "video")
                                .foregroundColor(.gray)
                        )
                }

                // Play button overlay
                ZStack {
                    if isLoading {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(1.5)
                    } else {
                        Circle()
                            .fill(Color.black.opacity(0.7))
                            .frame(width: 64, height: 64)
                            .overlay(
                                // Play icon triangle
                                Image(systemName: "play.fill")
                                    .font(.title2)
                                    .foregroundColor(.white)
                                    .offset(x: 2) // Slight offset for visual centering
                            )
                    }
                }

                // ALT text overlay
                if let alt = video.alt, !alt.isEmpty {
                    VStack {
                        Spacer()
                        HStack {
                            Text(alt)
                                .font(.caption)
                                .foregroundColor(.white)
                                .padding(8)
                                .background(Color.black.opacity(0.7))
                                .cornerRadius(6)
                                .padding(8)
                            Spacer()
                        }
                    }
                }
            }
        }
        .buttonStyle(PlainButtonStyle())
    }

    private var videoPlayerView: some View {
        ZStack {
            if let player = player {
                VideoPlayer(player: player)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                Color.black
                    .overlay(
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                    )
            }
        }
        .onTapGesture {
            handlePlayPress()
        }
    }

    private func setupPlayer() {
        guard let url = URL(string: video.playlist) else { return }
        player = AVPlayer(url: url)

        endObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: player?.currentItem,
            queue: .main
        ) { _ in
            handleVideoEnd()
        }
    }

    private func cleanupPlayer() {
        player?.pause()
        if let observer = endObserver {
            NotificationCenter.default.removeObserver(observer)
            endObserver = nil
        }
        player = nil
    }

    private func handlePlayPress() {
        if !isPlaying {
            isLoading = true
            showThumbnail = false

            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                player?.play()
                isPlaying = true
                isLoading = false
            }
        } else {
            player?.pause()
            isPlaying = false
        }
    }

    private func handleVideoEnd() {
        showThumbnail = true
        isPlaying = false
        player?.seek(to: .zero)
    }
}

#if DEBUG
struct VideoEmbed_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            VideoEmbed(
                video: VideoEmbedData(
                    playlist: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                    thumbnail: "https://picsum.photos/400/240",
                    alt: "Sample video",
                    aspectRatio: 1.78
                )
            )

            VideoEmbed(
                video: VideoEmbedData(
                    playlist: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
                    thumbnail: nil,
                    alt: nil,
                    aspectRatio: 1.78
                )
            )
        }
        .padding()
    }
}
#endif
