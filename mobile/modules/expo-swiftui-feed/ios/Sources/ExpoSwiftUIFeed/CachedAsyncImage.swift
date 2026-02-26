//
//  CachedAsyncImage.swift
//  ExpoSwiftUIFeed
//
//  Drop-in replacement for SwiftUI AsyncImage that uses SDWebImage
//  for disk + memory caching. Eliminates redundant network fetches
//  during scroll reuse.
//

import SwiftUI
import SDWebImage

// MARK: - SDWebImage Cache Configuration

/// Configure SDWebImage memory cache to prevent unbounded growth during
/// sustained feed scrolling. Without this, decoded image bitmaps accumulate
/// until the OS sends a memory warning (see ISSUE-MEM-3 in profiling report).
private let _configureSDWebImageCache: Void = {
    // Cap memory cache at 100MB (prevents unbounded growth during long scroll sessions)
    SDImageCache.shared.config.maxMemoryCost = 100 * 1024 * 1024
    // Limit memory cache to 256 images max
    SDImageCache.shared.config.maxMemoryCount = 256
}()

/// A SwiftUI view that loads and caches remote images using SDWebImage.
///
/// Provides the same two API styles as AsyncImage:
/// 1. Content + placeholder closures (simple)
/// 2. Phase-based closure (advanced)
public struct CachedAsyncImage<Content: View>: View {
    private let url: URL?
    private let content: (AsyncImagePhase) -> Content

    @State private var phase: AsyncImagePhase = .empty

    /// Creates a cached image view with content and placeholder closures.
    public init<I: View, P: View>(
        url: URL?,
        @ViewBuilder content: @escaping (Image) -> I,
        @ViewBuilder placeholder: @escaping () -> P
    ) where Content == _ConditionalContent<I, P> {
        self.url = url
        self.content = { phase in
            if case .success(let image) = phase {
                return ViewBuilder.buildEither(first: content(image))
            } else {
                return ViewBuilder.buildEither(second: placeholder())
            }
        }
    }

    /// Creates a cached image view with a phase-based closure.
    public init(
        url: URL?,
        @ViewBuilder content: @escaping (AsyncImagePhase) -> Content
    ) {
        self.url = url
        self.content = content
    }

    public var body: some View {
        content(phase)
            .onAppear { loadImage() }
            .onChangeCompat(of: url) { newURL in
                phase = .empty
                loadImage(for: newURL)
            }
    }

    private func loadImage(for overrideURL: URL? = nil) {
        _ = _configureSDWebImageCache // Ensure cache limits are set (runs once)
        let targetURL = overrideURL ?? url
        guard let targetURL = targetURL else {
            phase = .empty
            return
        }

        // Check memory cache first (synchronous, no main-thread hitch)
        let cacheKey = SDWebImageManager.shared.cacheKey(for: targetURL)
        if let cachedImage = SDImageCache.shared.imageFromMemoryCache(forKey: cacheKey) {
            phase = .success(Image(uiImage: cachedImage))
            return
        }

        // Load from disk cache or network via SDWebImage
        SDWebImageManager.shared.loadImage(
            with: targetURL,
            options: [.retryFailed, .scaleDownLargeImages],
            progress: nil
        ) { uiImage, _, error, _, _, _ in
            DispatchQueue.main.async {
                if let uiImage = uiImage {
                    phase = .success(Image(uiImage: uiImage))
                } else if let error = error {
                    phase = .failure(error)
                } else {
                    phase = .failure(URLError(.unknown))
                }
            }
        }
    }
}
