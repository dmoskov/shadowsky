//
//  NotificationSkeletonView.swift
//  NativeNotificationsList
//
//  Skeleton loading placeholder for notification items.
//  Matches the behavior of NotificationItemSkeleton.tsx
//

import SwiftUI

struct NotificationSkeletonView: View {
    @State private var isAnimating = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Icon placeholder
            skeletonRect(width: 16, height: 16)
                .clipShape(Circle())
                .padding(.top, 4)

            VStack(alignment: .leading, spacing: 8) {
                // Avatar + name row
                HStack(spacing: 8) {
                    skeletonRect(width: 32, height: 32)
                        .clipShape(Circle())

                    VStack(alignment: .leading, spacing: 4) {
                        skeletonRect(width: 120, height: 14)
                        skeletonRect(width: 100, height: 12)
                    }
                }

                // Content lines
                VStack(alignment: .leading, spacing: 4) {
                    skeletonRect(width: .infinity, height: 12)
                    skeletonRect(width: 200, height: 12)
                }

                // Timestamp
                skeletonRect(width: 80, height: 10)
            }
        }
        .padding(16)
        .background(Color(UIColor.systemBackground))
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 1.0).repeatForever(autoreverses: true)) {
                isAnimating = true
            }
        }
    }

    private func skeletonRect(width: CGFloat, height: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: height / 2)
            .fill(Color(UIColor.tertiarySystemFill))
            .frame(width: width == .infinity ? nil : width, height: height)
            .frame(maxWidth: width == .infinity ? .infinity : nil, alignment: .leading)
            .opacity(reduceMotion ? 0.6 : (isAnimating ? 0.4 : 0.8))
    }
}

struct NotificationSkeletonListView: View {
    var body: some View {
        VStack(spacing: 0) {
            ForEach(0..<6, id: \.self) { _ in
                NotificationSkeletonView()
                Divider()
            }
        }
    }
}
