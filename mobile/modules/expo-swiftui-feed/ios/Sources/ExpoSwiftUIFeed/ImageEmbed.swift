import SwiftUI

/// Model for image embed data
///
/// Uses `fullsize` URL as stable identity so SwiftUI's `ForEach` can diff
/// correctly across data updates. The previous `UUID()` default caused every
/// data refresh to mint new IDs, defeating identity-based diffing and
/// triggering unnecessary image reloads during feed scrolling.
public struct ImageEmbedData: Identifiable, Equatable {
    public var id: String { fullsize }
    public let thumb: String
    public let fullsize: String
    public let alt: String?
    public let aspectRatio: Double?
    public init(thumb: String, fullsize: String, alt: String?, aspectRatio: Double?) {
        self.thumb = thumb
        self.fullsize = fullsize
        self.alt = alt
        self.aspectRatio = aspectRatio
    }
}

/// SwiftUI view for image embeds with 1-4 image grid layouts
struct ImageEmbed: View {
    let images: [ImageEmbedData]
    let blurImages: Bool
    let onImagePress: (([ImageEmbedData], Int) -> Void)?

    @State private var showCarousel = false
    @State private var currentImageIndex = 0

    init(images: [ImageEmbedData], blurImages: Bool = false, onImagePress: (([ImageEmbedData], Int) -> Void)? = nil) {
        self.images = images
        self.blurImages = blurImages
        self.onImagePress = onImagePress
    }

    var body: some View {
        VStack(spacing: 0) {
            imageLayout
        }
        .padding(.vertical, 8)
    }

    @ViewBuilder
    private var imageLayout: some View {
        let imageCount = images.count

        if imageCount == 1 {
            singleImageLayout
        } else if imageCount == 2 {
            doubleImageLayout
        } else if imageCount == 3 {
            tripleImageLayout
        } else if imageCount >= 4 {
            quadImageLayout
        }
    }

    // Single image: height derived from aspect ratio, constrained by width
    private var singleImageLayout: some View {
        GeometryReader { geometry in
            let ratio = max(0.8, images[0].aspectRatio ?? 1.0)
            let height = min(max(geometry.size.width / ratio, 150), 600)
            ImageTile(
                imageData: images[0],
                blurImage: blurImages,
                index: 0,
                onPress: handleImagePress
            )
            .frame(width: geometry.size.width, height: height)
            .cornerRadius(12)
        }
        .frame(maxWidth: .infinity)
        .frame(height: singleImageHeight)
    }

    private var singleImageHeight: CGFloat {
        let screenWidth = UIScreen.main.bounds.width - 32
        let ratio = max(0.8, images[0].aspectRatio ?? 1.0)
        return min(max(screenWidth / ratio, 150), 600)
    }

    // Double image: 200h side-by-side
    private var doubleImageLayout: some View {
        HStack(spacing: 4) {
            ForEach(Array(images.prefix(2).enumerated()), id: \.element.id) { index, image in
                ImageTile(
                    imageData: image,
                    blurImage: blurImages,
                    index: index,
                    onPress: handleImagePress
                )
                .frame(height: 200)
                .cornerRadius(12)
            }
        }
    }

    // Triple image: First large (240h, 2/3 width) + two small stacked (118h each, 1/3 width)
    private var tripleImageLayout: some View {
        GeometryReader { geometry in
            HStack(spacing: 4) {
                // First image takes 2/3 width
                ImageTile(
                    imageData: images[0],
                    blurImage: blurImages,
                    index: 0,
                    onPress: handleImagePress
                )
                .frame(width: (geometry.size.width - 4) * 0.66, height: 240)
                .cornerRadius(12)

                // Remaining images stacked vertically
                VStack(spacing: 4) {
                    ForEach(Array(images.dropFirst().prefix(2).enumerated()), id: \.element.id) { offset, image in
                        let index = offset + 1
                        ImageTile(
                            imageData: image,
                            blurImage: blurImages,
                            index: index,
                            onPress: handleImagePress
                        )
                        .frame(height: 118)
                        .cornerRadius(12)
                    }
                }
            }
        }
        .frame(height: 240)
    }

    // Quad image: 2x2 grid, 150h each
    private var quadImageLayout: some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                ForEach(Array(images.prefix(2).enumerated()), id: \.element.id) { index, image in
                    ImageTile(
                        imageData: image,
                        blurImage: blurImages,
                        index: index,
                        onPress: handleImagePress
                    )
                    .frame(height: 150)
                    .cornerRadius(12)
                }
            }

            HStack(spacing: 4) {
                ForEach(Array(images.dropFirst(2).prefix(2).enumerated()), id: \.element.id) { offset, image in
                    let index = offset + 2
                    ImageTile(
                        imageData: image,
                        blurImage: blurImages,
                        index: index,
                        onPress: handleImagePress
                    )
                    .frame(height: 150)
                    .cornerRadius(12)
                }
            }
        }
    }

    private func handleImagePress(index: Int) {
        if let onImagePress = onImagePress {
            onImagePress(images, index)
        } else {
            currentImageIndex = index
            showCarousel = true
        }
    }
}

/// Individual image tile with ALT badge and VoiceOver support
struct ImageTile: View {
    let imageData: ImageEmbedData
    let blurImage: Bool
    let index: Int
    let onPress: (Int) -> Void

    @State private var showingAltText = false

    var body: some View {
        Button(action: { onPress(index) }) {
            ZStack(alignment: .bottomLeading) {
                GeometryReader { geo in
                    CachedAsyncImage(url: URL(string: imageData.thumb)) { phase in
                        switch phase {
                        case .empty:
                            Color.gray.opacity(0.3)
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: geo.size.width, height: geo.size.height)
                                .blur(radius: blurImage ? 20 : 0)
                                .opacity(blurImage ? 0.8 : 1.0)
                        case .failure:
                            Color.gray.opacity(0.3)
                                .overlay(
                                    Image(systemName: "photo")
                                        .foregroundColor(.gray)
                                )
                        @unknown default:
                            Color.gray.opacity(0.3)
                        }
                    }
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()
                }

                // ALT badge / expanded alt text
                if let alt = imageData.alt, !alt.isEmpty {
                    if showingAltText {
                        // Expanded alt text overlay
                        Text(alt)
                            .font(.caption)
                            .foregroundColor(.white)
                            .padding(8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.black.opacity(0.8))
                            .cornerRadius(8)
                            .padding(4)
                            .onTapGesture {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    showingAltText = false
                                }
                            }
                    } else {
                        // Compact ALT badge
                        Text("ALT")
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.black.opacity(0.7))
                            .cornerRadius(4)
                            .padding(8)
                            .onTapGesture {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    showingAltText = true
                                }
                            }
                    }
                }
            }
        }
        .buttonStyle(PlainButtonStyle())
        .accessibilityLabel(imageData.alt ?? "Image")
        .accessibilityAddTraits(.isImage)
    }
}

#if DEBUG
struct ImageEmbed_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            // Single image preview
            ImageEmbed(images: [
                ImageEmbedData(thumb: "https://picsum.photos/400/300", fullsize: "https://picsum.photos/1200/900", alt: "Sample image", aspectRatio: 1.33)
            ])

            // Double image preview
            ImageEmbed(images: [
                ImageEmbedData(thumb: "https://picsum.photos/400/300", fullsize: "https://picsum.photos/1200/900", alt: nil, aspectRatio: 1.33),
                ImageEmbedData(thumb: "https://picsum.photos/400/300", fullsize: "https://picsum.photos/1200/900", alt: "With ALT", aspectRatio: 1.33)
            ])

            // Triple image preview
            ImageEmbed(images: [
                ImageEmbedData(thumb: "https://picsum.photos/400/300", fullsize: "https://picsum.photos/1200/900", alt: nil, aspectRatio: 1.33),
                ImageEmbedData(thumb: "https://picsum.photos/400/300", fullsize: "https://picsum.photos/1200/900", alt: nil, aspectRatio: 1.33),
                ImageEmbedData(thumb: "https://picsum.photos/400/300", fullsize: "https://picsum.photos/1200/900", alt: "Third", aspectRatio: 1.33)
            ])
        }
        .padding()
    }
}
#endif
