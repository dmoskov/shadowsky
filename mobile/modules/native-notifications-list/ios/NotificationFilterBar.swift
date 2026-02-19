//
//  NotificationFilterBar.swift
//  NativeNotificationsList
//
//  Horizontal filter tab bar for notification types.
//  Matches the behavior of NotificationTabBar.tsx
//

import SwiftUI

struct NotificationFilterBar: View {
    @Binding var activeFilter: NotificationListFilter
    let counts: [String: Int]
    let onFilterChange: (NotificationListFilter) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(NotificationListFilter.allCases, id: \.self) { filter in
                    filterTab(for: filter)
                }
            }
            .padding(.horizontal, 8)
        }
        .frame(height: 44)
        .background(Color(UIColor.systemBackground))
        .overlay(alignment: .bottom) {
            Divider()
        }
    }

    private func filterTab(for filter: NotificationListFilter) -> some View {
        let isActive = activeFilter == filter
        let count = counts[filter.rawValue] ?? 0

        return Button(action: {
            let generator = UIImpactFeedbackGenerator(style: .light)
            generator.impactOccurred()
            activeFilter = filter
            onFilterChange(filter)
        }) {
            VStack(spacing: 0) {
                Spacer()
                Text(filter.label + (count > 0 ? " (\(count))" : ""))
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(isActive
                        ? NotificationThemeColors.primary
                        : Color(UIColor.tertiaryLabel))
                    .padding(.horizontal, 16)
                Spacer()

                // Active indicator
                Rectangle()
                    .fill(isActive ? NotificationThemeColors.primary : Color.clear)
                    .frame(height: 2)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(filter.label) filter\(count > 0 ? ", \(count) notifications" : "")")
        .accessibilityAddTraits(isActive ? [.isSelected] : [])
    }
}
