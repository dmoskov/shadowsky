import WidgetKit
import SwiftUI

// MARK: - Timeline Provider

struct DMTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> DMEntry {
        DMEntry(date: Date(), data: .empty, isPlaceholder: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (DMEntry) -> Void) {
        let data = DMWidgetData.load()
        completion(DMEntry(date: Date(), data: data, isPlaceholder: false))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DMEntry>) -> Void) {
        let data = DMWidgetData.load()
        let entry = DMEntry(date: Date(), data: data, isPlaceholder: false)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Entry

struct DMEntry: TimelineEntry {
    let date: Date
    let data: DMWidgetData
    let isPlaceholder: Bool
}

// MARK: - Widget View

struct RecentDMsWidgetView: View {
    var entry: DMEntry
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
                VStack(alignment: .leading, spacing: 8) {
                    // Header
                    HStack {
                        Image(systemName: "bubble.left.and.bubble.right.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(brandGold)
                        Text("Messages")
                            .font(.footnote.weight(.semibold))
                            .foregroundColor(.white)
                        Spacer()
                        if let updated = entry.data.lastUpdated {
                            Text(updated, style: .relative)
                                .font(.caption2)
                                .foregroundColor(.white.opacity(0.3))
                        }
                    }

                    if entry.isPlaceholder {
                        ForEach(0..<3, id: \.self) { _ in
                            placeholderRow
                        }
                    } else if entry.data.conversations.isEmpty {
                        Spacer()
                        HStack {
                            Spacer()
                            VStack(spacing: 4) {
                                Image(systemName: "bubble.left.and.bubble.right")
                                    .font(.title2)
                                    .foregroundColor(.white.opacity(0.2))
                                Text("No recent messages")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.4))
                            }
                            Spacer()
                        }
                        Spacer()
                    } else {
                        let displayConvos = Array(entry.data.conversations.prefix(3))
                        ForEach(Array(displayConvos.enumerated()), id: \.element.id) { index, convo in
                            dmRow(convo: convo)
                            if index < displayConvos.count - 1 {
                                Divider()
                                    .background(Color.white.opacity(0.1))
                            }
                        }
                        Spacer()
                    }
                }
                .padding(12)
            }
        }
        .containerBackground(darkBg, for: .widget)
    }

    private var staleOverlay: some View {
        VStack(spacing: 6) {
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.title2)
                .foregroundColor(brandGold.opacity(0.5))
            Text("Open app to refresh")
                .font(.caption)
                .foregroundColor(.white.opacity(0.5))
                .multilineTextAlignment(.center)
        }
        .padding(12)
    }

    private var placeholderRow: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(Color.white.opacity(0.1))
                .frame(width: 28, height: 28)
            VStack(alignment: .leading, spacing: 2) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.white.opacity(0.1))
                    .frame(width: 80, height: 12)
                RoundedRectangle(cornerRadius: 3)
                    .fill(Color.white.opacity(0.1))
                    .frame(height: 10)
            }
        }
    }

    private func dmRow(convo: DMConversationItem) -> some View {
        HStack(spacing: 8) {
            // Avatar placeholder with initial
            ZStack {
                Circle()
                    .fill(brandGold.opacity(0.2))
                    .frame(width: 28, height: 28)
                Text(String(convo.memberName.prefix(1)).uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundColor(brandGold)
            }

            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(convo.memberName)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                    Spacer()
                    if convo.unreadCount > 0 {
                        Text("\(convo.unreadCount)")
                            .font(.caption2.weight(.bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 5)
                            .padding(.vertical, 1)
                            .background(brandGold)
                            .clipShape(Capsule())
                    }
                    Text(relativeTime(from: convo.lastMessageTimestamp))
                        .font(.caption2)
                        .foregroundColor(.white.opacity(0.3))
                }
                Text(convo.lastMessageText)
                    .font(.caption2)
                    .foregroundColor(.white.opacity(0.5))
                    .lineLimit(1)
            }
        }
    }

    private func relativeTime(from timestamp: Double) -> String {
        guard timestamp > 0 else { return "" }
        let date = Date(timeIntervalSince1970: timestamp / 1000)
        let interval = Date().timeIntervalSince(date)
        if interval < 60 { return "now" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        if interval < 86400 { return "\(Int(interval / 3600))h" }
        return "\(Int(interval / 86400))d"
    }
}

// MARK: - Widget Declaration

struct RecentDMsWidget: Widget {
    let kind: String = "RecentDMsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DMTimelineProvider()) { entry in
            RecentDMsWidgetView(entry: entry)
                .widgetURL(URL(string: "shadowsky://messages"))
        }
        .configurationDisplayName("Recent Messages")
        .description("See your recent DM conversations.")
        .supportedFamilies([.systemMedium])
    }
}
