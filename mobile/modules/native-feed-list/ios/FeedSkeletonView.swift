//
//  FeedSkeletonView.swift
//  NativeFeedList
//
//  Skeleton loading placeholder for feed post cards.
//  Matches PostCardView layout so the transition from skeleton to real content is seamless.
//

import SwiftUI

// MARK: - Post Card Skeleton

struct PostCardSkeleton: View {
    @State private var isAnimating = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Author row — matches PostCardView HStack(spacing: 8)
            HStack(spacing: 8) {
                // Avatar placeholder (40x40 circle, same as PostCardView)
                skeletonRect(width: 40, height: 40)
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 2) {
                    // Display name
                    skeletonRect(width: 120, height: 14)
                    // Handle
                    skeletonRect(width: 80, height: 12)
                }

                Spacer()

                // Timestamp
                skeletonRect(width: 24, height: 12)
            }

            // Post text lines
            skeletonRect(width: .infinity, height: 14)
            skeletonRect(width: 200, height: 14)

            // Action bar — matches PostCardView HStack(spacing: 24)
            HStack(spacing: 24) {
                ForEach(0..<3, id: \.self) { _ in
                    skeletonRect(width: 30, height: 12)
                }
                Spacer()
                skeletonRect(width: 14, height: 12)
            }
            .padding(.top, 4)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }

        Divider()
            .padding(.leading, 64)
    }

    private func skeletonRect(width: CGFloat, height: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: height / 2)
            .fill(Color(UIColor.tertiarySystemFill))
            .frame(width: width == .infinity ? nil : width, height: height)
            .frame(maxWidth: width == .infinity ? .infinity : nil, alignment: .leading)
            .opacity(reduceMotion ? 0.6 : (isAnimating ? 0.4 : 0.8))
    }
}

// MARK: - Feed Skeleton View

struct FeedSkeletonView: View {
    var body: some View {
        LazyVStack(spacing: 0) {
            ForEach(0..<6, id: \.self) { _ in
                PostCardSkeleton()
            }
        }
    }
}
