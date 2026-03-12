import SwiftUI
import Charts

// MARK: - Main Analytics View

struct AnalyticsView: View {
    @ObservedObject var viewModel: AnalyticsViewModel
    let onTimeRangeChange: (String) -> Void
    let onPostPress: (String, String, String) -> Void
    let onRefresh: () -> Void
    let onScroll: (CGFloat) -> Void

    @Environment(\.colorScheme) private var colorScheme

    private var bg: Color { colorScheme == .dark ? Color(white: 0.06) : Color(white: 0.96) }
    private var card: Color { colorScheme == .dark ? Color(white: 0.12) : .white }
    private var subtle: Color { colorScheme == .dark ? Color(white: 0.3) : Color(white: 0.6) }

    var body: some View {
        ScrollView {
            GeometryReader { geo in
                Color.clear.preference(
                    key: AnalyticsScrollOffsetKey.self,
                    value: -geo.frame(in: .named("analyticsScroll")).origin.y
                )
            }
            .frame(height: 0)

            VStack(spacing: 16) {
                timeRangeSelector
                metricsGrid
                engagementChart
                postingFrequencyChart
                bestTimesCard
                topPostsSection
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 100)
        }
        .coordinateSpace(name: "analyticsScroll")
        .onPreferenceChange(AnalyticsScrollOffsetKey.self) { offset in
            onScroll(offset)
        }
        .refreshable {
            onRefresh()
        }
        .background(bg)
        .overlay {
            if viewModel.isLoading && viewModel.dailyEngagement.isEmpty {
                ProgressView("Loading analytics...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(bg)
            }
        }
    }

    // MARK: - Time Range Selector

    private let timeRanges: [(label: String, value: String)] = [
        ("24h", "24h"), ("7d", "7d"), ("30d", "30d"), ("90d", "90d")
    ]

    private var timeRangeSelector: some View {
        HStack(spacing: 8) {
            ForEach(timeRanges, id: \.value) { range in
                Button {
                    onTimeRangeChange(range.value)
                } label: {
                    Text(range.label)
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(
                            viewModel.timeRange == range.value
                                ? Color.accentColor
                                : Color.secondary.opacity(0.15)
                        )
                        .foregroundColor(
                            viewModel.timeRange == range.value ? .white : .primary
                        )
                        .clipShape(Capsule())
                }
            }
            Spacer()
        }
        .padding(.top, 8)
    }

    // MARK: - Metrics Grid

    private var metricsGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 12),
            GridItem(.flexible(), spacing: 12),
            GridItem(.flexible(), spacing: 12),
        ], spacing: 12) {
            metricCard(title: "Followers", value: formatNumber(viewModel.metrics.followersCount), icon: "person.2.fill", color: .blue)
            metricCard(title: "Following", value: formatNumber(viewModel.metrics.followsCount), icon: "person.fill.checkmark", color: .cyan)
            metricCard(title: "Posts", value: formatNumber(viewModel.metrics.postsCount), icon: "text.bubble.fill", color: .indigo)
            metricCard(title: "Likes", value: formatNumber(viewModel.metrics.likesReceived), icon: "heart.fill", color: .red)
            metricCard(title: "Reposts", value: formatNumber(viewModel.metrics.repostsReceived), icon: "arrow.2.squarepath", color: .green)
            metricCard(title: "Replies", value: formatNumber(viewModel.metrics.repliesReceived), icon: "bubble.left.fill", color: .orange)
        }
    }

    private func metricCard(title: String, value: String, icon: String, color: Color) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(color)
            Text(value)
                .font(.title2.weight(.bold).monospacedDigit())
                .foregroundColor(.primary)
            Text(title)
                .font(.caption)
                .foregroundColor(subtle)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Engagement Chart (Swift Charts)

    private var engagementChart: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Engagement Over Time")
                .font(.headline)

            if viewModel.dailyEngagement.isEmpty {
                Text("No data for this period")
                    .foregroundColor(subtle)
                    .frame(height: 200)
                    .frame(maxWidth: .infinity)
            } else {
                Chart(viewModel.dailyEngagement) { day in
                    BarMark(
                        x: .value("Date", shortDate(day.date)),
                        y: .value("Likes", day.likes)
                    )
                    .foregroundStyle(.red.opacity(0.8))

                    BarMark(
                        x: .value("Date", shortDate(day.date)),
                        y: .value("Reposts", day.reposts)
                    )
                    .foregroundStyle(.green.opacity(0.8))

                    BarMark(
                        x: .value("Date", shortDate(day.date)),
                        y: .value("Replies", day.replies)
                    )
                    .foregroundStyle(.blue.opacity(0.8))
                }
                .chartForegroundStyleScale([
                    "Likes": .red.opacity(0.8),
                    "Reposts": .green.opacity(0.8),
                    "Replies": .blue.opacity(0.8),
                ])
                .chartYAxis {
                    AxisMarks(position: .leading)
                }
                .frame(height: 200)
            }
        }
        .padding(16)
        .background(card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Posting Frequency Chart

    private var postingFrequencyChart: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Posting Frequency")
                .font(.headline)

            if viewModel.dailyEngagement.isEmpty {
                Text("No data for this period")
                    .foregroundColor(subtle)
                    .frame(height: 180)
                    .frame(maxWidth: .infinity)
            } else {
                Chart(viewModel.dailyEngagement) { day in
                    LineMark(
                        x: .value("Date", shortDate(day.date)),
                        y: .value("Posts", day.posts)
                    )
                    .foregroundStyle(.indigo)
                    .interpolationMethod(.catmullRom)

                    AreaMark(
                        x: .value("Date", shortDate(day.date)),
                        y: .value("Posts", day.posts)
                    )
                    .foregroundStyle(.indigo.opacity(0.1))
                    .interpolationMethod(.catmullRom)
                }
                .chartYAxis {
                    AxisMarks(position: .leading)
                }
                .frame(height: 180)
            }
        }
        .padding(16)
        .background(card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Best Posting Times

    private var bestTimesCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Best Posting Times")
                .font(.headline)

            HStack(spacing: 16) {
                bestTimeItem(
                    title: "Most Active",
                    hour: viewModel.postingTimes.mostActiveHour,
                    icon: "clock.fill",
                    color: .blue
                )
                bestTimeItem(
                    title: "Best Engagement",
                    hour: viewModel.postingTimes.bestEngagementHour,
                    icon: "star.fill",
                    color: .orange
                )
            }

            // Hourly heatmap
            Chart(0..<24, id: \.self) { hour in
                BarMark(
                    x: .value("Hour", formatHour(hour)),
                    y: .value("Engagement", viewModel.postingTimes.hourEngagement[hour])
                )
                .foregroundStyle(
                    hour == viewModel.postingTimes.bestEngagementHour
                        ? Color.orange : Color.blue.opacity(0.6)
                )
            }
            .chartXAxis {
                AxisMarks(values: [0, 6, 12, 18].map { formatHour($0) })
            }
            .frame(height: 120)
        }
        .padding(16)
        .background(card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func bestTimeItem(title: String, hour: Int, icon: String, color: Color) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon)
                .foregroundColor(color)
            Text(formatHour(hour))
                .font(.title3.weight(.bold))
            Text(title)
                .font(.caption)
                .foregroundColor(subtle)
        }
        .frame(maxWidth: .infinity)
        .padding(12)
        .background(color.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Top Posts

    private var topPostsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Top Performing Posts")
                .font(.headline)

            if viewModel.topPosts.isEmpty {
                Text("No posts in this period")
                    .foregroundColor(subtle)
                    .padding(.vertical, 20)
                    .frame(maxWidth: .infinity)
            } else {
                ForEach(Array(viewModel.topPosts.enumerated()), id: \.element.id) { index, post in
                    Button {
                        onPostPress(post.uri, post.authorHandle, post.authorDid)
                    } label: {
                        topPostRow(post: post, rank: index + 1)
                    }
                    .buttonStyle(.plain)

                    if index < viewModel.topPosts.count - 1 {
                        Divider()
                    }
                }
            }
        }
        .padding(16)
        .background(card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func topPostRow(post: TopPostData, rank: Int) -> some View {
        HStack(alignment: .top, spacing: 12) {
            // Rank badge
            Text("\(rank)")
                .font(.caption.weight(.bold))
                .foregroundColor(.white)
                .frame(width: 24, height: 24)
                .background(rank <= 3 ? Color.accentColor : Color.secondary)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 6) {
                // Post text
                Text(post.text)
                    .font(.subheadline)
                    .lineLimit(3)
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.leading)

                // Engagement stats
                HStack(spacing: 16) {
                    Label(formatNumber(post.likeCount), systemImage: "heart.fill")
                        .foregroundColor(.red)
                    Label(formatNumber(post.repostCount), systemImage: "arrow.2.squarepath")
                        .foregroundColor(.green)
                    Label(formatNumber(post.replyCount), systemImage: "bubble.left.fill")
                        .foregroundColor(.blue)
                }
                .font(.caption)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(subtle)
        }
        .padding(.vertical, 4)
    }

    // MARK: - Helpers

    private func formatNumber(_ n: Int) -> String {
        if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1_000_000) }
        if n >= 1_000 { return String(format: "%.1fK", Double(n) / 1_000) }
        return "\(n)"
    }

    private func formatHour(_ hour: Int) -> String {
        if hour == 0 { return "12a" }
        if hour == 12 { return "12p" }
        return hour < 12 ? "\(hour)a" : "\(hour - 12)p"
    }

    private func shortDate(_ dateStr: String) -> String {
        // "2026-03-10" → "3/10"
        let parts = dateStr.split(separator: "-")
        guard parts.count == 3,
              let month = Int(parts[1]),
              let day = Int(parts[2]) else { return dateStr }
        return "\(month)/\(day)"
    }
}

// MARK: - Scroll Tracking

private struct AnalyticsScrollOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}
