import WidgetKit
import SwiftUI

// MARK: - Timeline Provider

struct TrendingTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> TrendingEntry {
        TrendingEntry(date: Date(), data: .empty, isPlaceholder: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (TrendingEntry) -> Void) {
        let data = TrendingWidgetData.load()
        completion(TrendingEntry(date: Date(), data: data, isPlaceholder: false))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TrendingEntry>) -> Void) {
        let data = TrendingWidgetData.load()
        let entry = TrendingEntry(date: Date(), data: data, isPlaceholder: false)
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Entry

struct TrendingEntry: TimelineEntry {
    let date: Date
    let data: TrendingWidgetData
    let isPlaceholder: Bool
}

// MARK: - Widget View

struct TrendingTopicsWidgetView: View {
    var entry: TrendingEntry
    @Environment(\.widgetFamily) var widgetFamily

    private let brandGold = Color(red: 201/255, green: 168/255, blue: 76/255)
    private let darkBg = Color(red: 10/255, green: 10/255, blue: 15/255)

    var body: some View {
        ZStack {
            darkBg

            VStack(alignment: .leading, spacing: 8) {
                // Header
                HStack {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(brandGold)
                    Text("Trending")
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
                } else if entry.data.topics.isEmpty {
                    Spacer()
                    HStack {
                        Spacer()
                        VStack(spacing: 4) {
                            Image(systemName: "chart.line.uptrend.xyaxis")
                                .font(.title2)
                                .foregroundColor(.white.opacity(0.2))
                            Text("No trending topics")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.4))
                        }
                        Spacer()
                    }
                    Spacer()
                } else {
                    let displayTopics = Array(entry.data.topics.prefix(3))
                    ForEach(Array(displayTopics.enumerated()), id: \.element.id) { index, topic in
                        topicRow(topic: topic, index: index + 1)
                        if index < displayTopics.count - 1 {
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

    private var placeholderRow: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: 3)
                .fill(Color.white.opacity(0.1))
                .frame(width: 18, height: 18)
            RoundedRectangle(cornerRadius: 3)
                .fill(Color.white.opacity(0.1))
                .frame(height: 14)
        }
    }

    private func topicRow(topic: TrendingTopicItem, index: Int) -> some View {
        HStack(spacing: 8) {
            Text("\(index)")
                .font(.system(.subheadline, design: .rounded).weight(.bold))
                .foregroundColor(brandGold.opacity(0.8))
                .frame(width: 18, alignment: .center)

            VStack(alignment: .leading, spacing: 1) {
                Text(topic.topic)
                    .font(.footnote.weight(.medium))
                    .foregroundColor(.white)
                    .lineLimit(1)
                if let status = topic.status, !status.isEmpty {
                    Text(statusLabel(status))
                        .font(.caption2)
                        .foregroundColor(statusColor(status))
                }
            }

            Spacer()

            if let status = topic.status {
                Image(systemName: statusIcon(status))
                    .font(.caption2)
                    .foregroundColor(statusColor(status))
            }
        }
    }

    private func statusLabel(_ status: String) -> String {
        switch status {
        case "hot": return "Hot"
        case "rising": return "Rising"
        default: return "Trending"
        }
    }

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "hot": return "flame.fill"
        case "rising": return "arrow.up.right"
        default: return "chart.line.uptrend.xyaxis"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "hot": return Color.orange
        case "rising": return Color.green
        default: return Color.white.opacity(0.5)
        }
    }
}

// MARK: - Widget Declaration

struct TrendingTopicsWidget: Widget {
    let kind: String = "TrendingTopicsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TrendingTimelineProvider()) { entry in
            TrendingTopicsWidgetView(entry: entry)
                .widgetURL(URL(string: "shadowsky://search"))
        }
        .configurationDisplayName("Trending Topics")
        .description("See the top trending topics on Bluesky.")
        .supportedFamilies([.systemMedium])
    }
}
