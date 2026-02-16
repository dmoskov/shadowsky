import SwiftUI

/// Model for image embed data
public struct ImageEmbedData: Identifiable {
    public let id = UUID()
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

    // Single image: 300h
    private var singleImageLayout: some View {
        ImageTile(
            imageData: images[0],
            blurImage: blurImages,
            index: 0,
            onPress: handleImagePress
        )
        .frame(maxWidth: .infinity)
        .frame(height: 300)
        .cornerRadius(12)
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

/// Individual image tile with ALT badge
struct ImageTile: View {
    let imageData: ImageEmbedData
    let blurImage: Bool
    let index: Int
    let onPress: (Int) -> Void

    var body: some View {
        Button(action: { onPress(index) }) {
            ZStack(alignment: .bottomLeading) {
                AsyncImage(url: URL(string: imageData.thumb)) { phase in
                    switch phase {
                    case .empty:
                        Color.gray.opacity(0.3)
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
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
                .clipped()

                // ALT badge
                if let alt = imageData.alt, !alt.isEmpty {
                    Text("ALT")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.black.opacity(0.7))
                        .cornerRadius(4)
                        .padding(8)
                }
            }
        }
        .buttonStyle(PlainButtonStyle())
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
