import WidgetKit
import SwiftUI

// MARK: - Timeline Provider

struct NotificationTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> NotificationEntry {
        NotificationEntry(date: Date(), data: .empty, isPlaceholder: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (NotificationEntry) -> Void) {
        let data = NotificationWidgetData.load()
        completion(NotificationEntry(date: Date(), data: data, isPlaceholder: false))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NotificationEntry>) -> Void) {
        let data = NotificationWidgetData.load()
        let entry = NotificationEntry(date: Date(), data: data, isPlaceholder: false)
        // Refresh every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Entry

struct NotificationEntry: TimelineEntry {
    let date: Date
    let data: NotificationWidgetData
    let isPlaceholder: Bool
}

// MARK: - Widget View

struct NotificationCountWidgetView: View {
    var entry: NotificationEntry
    @Environment(\.widgetFamily) var widgetFamily

    private let brandGold = Color(red: 201/255, green: 168/255, blue: 76/255)
    private let darkBg = Color(red: 10/255, green: 10/255, blue: 15/255)

    private var isStale: Bool {
        guard !entry.isPlaceholder else { return false }
        return SharedData.isDataStale
    }

    var body: some View {
        ZStack {
            darkBg

            if isStale {
                staleOverlay
            } else {
                VStack(alignment: .leading, spacing: 6) {
                    // Header row
                    HStack {
                        Image(systemName: "bell.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(brandGold)
                        Text("Notifications")
                            .font(.caption.weight(.medium))
                            .foregroundColor(.white.opacity(0.7))
                        Spacer()
                    }

                    // Unread count
                    if entry.isPlaceholder {
                        Text("--")
                            .font(.system(.largeTitle, design: .rounded).weight(.bold))
                            .foregroundColor(.white)
                    } else if entry.data.unreadCount > 0 {
                        Text("\(entry.data.unreadCount)")
                            .font(.system(.largeTitle, design: .rounded).weight(.bold))
                            .foregroundColor(brandGold)
                    } else {
                        Text("0")
                            .font(.system(.largeTitle, design: .rounded).weight(.bold))
                            .foregroundColor(.white.opacity(0.4))
                    }

                    Spacer()

                    // Last notification preview
                    if entry.isPlaceholder {
                        Text("Loading...")
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.5))
                            .lineLimit(2)
                    } else if !entry.data.lastNotificationText.isEmpty {
                        VStack(alignment: .leading, spacing: 2) {
                            if !entry.data.lastNotificationAuthor.isEmpty {
                                Text(entry.data.lastNotificationAuthor)
                                    .font(.caption2.weight(.semibold))
                                    .foregroundColor(.white.opacity(0.8))
                                    .lineLimit(1)
                            }
                            Text(entry.data.lastNotificationText)
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.5))
                                .lineLimit(2)
                        }
                    } else {
                        Text("No new notifications")
                            .font(.caption2)
                            .foregroundColor(.white.opacity(0.4))
                    }
                }
                .padding(12)
            }
        }
        .containerBackground(darkBg, for: .widget)
    }

    private var staleOverlay: some View {
        VStack(spacing: 6) {
            Image(systemName: "bell.fill")
                .font(.title2)
                .foregroundColor(brandGold.opacity(0.5))
            Text("Open app to refresh")
                .font(.caption)
                .foregroundColor(.white.opacity(0.5))
                .multilineTextAlignment(.center)
        }
        .padding(12)
    }
}

// MARK: - Widget Declaration

struct NotificationCountWidget: Widget {
    let kind: String = "NotificationCountWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NotificationTimelineProvider()) { entry in
            NotificationCountWidgetView(entry: entry)
                .widgetURL(URL(string: "shadowsky://notifications"))
        }
        .configurationDisplayName("Notifications")
        .description("See your unread notification count and latest notification.")
        .supportedFamilies([.systemSmall])
    }
}
