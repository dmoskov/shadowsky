import SwiftUI
import Charts

// MARK: - Main Analytics View

@available(iOS 16.0, *)
struct AnalyticsView: View {
    @ObservedObject var viewModel: AnalyticsViewModel
    let onTimeRangeChange: (String) -> Void
    let onPostPress: (String, String, String) -> Void
    let onRefresh: () -> Void
    let onScroll: (CGFloat) -> Void
    let onAnalyzeRequest: () -> Void

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
                summaryBar
                aiAnalysisSection
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
            metricCard(title: "Engagement", value: String(format: "%.1f", viewModel.metrics.engagementRate), icon: "chart.line.uptrend.xyaxis", color: .purple)
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
            Text("\(rank)")
                .font(.caption.weight(.bold))
                .foregroundColor(.white)
                .frame(width: 24, height: 24)
                .background(rank <= 3 ? Color.accentColor : Color.secondary)
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: 6) {
                Text(post.text)
                    .font(.subheadline)
                    .lineLimit(3)
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.leading)

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

    // MARK: - Summary Bar

    private var summaryBar: some View {
        Group {
            if viewModel.metrics.postsCount > 0 {
                VStack(spacing: 10) {
                    Text(summaryText)
                        .font(.footnote)
                        .foregroundColor(subtle)

                    HStack(spacing: 24) {
                        VStack(spacing: 2) {
                            Text(formatNumber(viewModel.metrics.totalEngagement))
                                .font(.title3.weight(.bold).monospacedDigit())
                                .foregroundColor(.primary)
                            Text("total engagement")
                                .font(.caption2)
                                .foregroundColor(subtle)
                        }
                        VStack(spacing: 2) {
                            Text(String(format: "%.1f", viewModel.metrics.engagementRate))
                                .font(.title3.weight(.bold).monospacedDigit())
                                .foregroundColor(.primary)
                            Text("avg per post")
                                .font(.caption2)
                                .foregroundColor(subtle)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(16)
                .background(card)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private var summaryText: String {
        let count = viewModel.metrics.postsCount
        switch viewModel.timeRange {
        case "24h": return "Showing \(count) posts from the last 24 hours"
        case "7d": return "Showing \(count) posts from the last 7 days"
        case "30d": return "Showing \(count) posts from the last 30 days"
        case "90d": return "Showing \(count) posts from the last 90 days"
        default: return "Showing \(count) posts"
        }
    }

    // MARK: - AI Content Analysis

    private var aiAnalysisSection: some View {
        Group {
            if viewModel.metrics.postsCount > 0 {
                VStack(alignment: .leading, spacing: 12) {
                    // Header with Analyze button
                    HStack {
                        Text("AI Content Analysis")
                            .font(.headline)
                        Spacer()
                        if !viewModel.analysisRequested {
                            Button {
                                onAnalyzeRequest()
                            } label: {
                                Text("Analyze")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(Color.accentColor)
                                    .clipShape(Capsule())
                            }
                        }
                    }

                    if !viewModel.analysisRequested {
                        // Placeholder
                        VStack(spacing: 8) {
                            Image(systemName: "sparkles")
                                .font(.largeTitle)
                                .foregroundColor(.purple.opacity(0.6))
                            Text("Get AI-Powered Insights")
                                .font(.callout.weight(.semibold))
                            Text("Discover content themes, writing style patterns, and engagement insights from your posts")
                                .font(.footnote)
                                .foregroundColor(subtle)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                        .background(card.opacity(0.5))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    } else if viewModel.isLoadingAnalysis {
                        // Loading
                        VStack(spacing: 12) {
                            ProgressView()
                            Text("Analyzing your posts...")
                                .font(.subheadline.weight(.medium))
                            Text("This may take a moment")
                                .font(.caption)
                                .foregroundColor(subtle)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 32)
                        .background(card.opacity(0.5))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    } else if let analysis = viewModel.aiAnalysis {
                        // Results
                        aiResultsView(analysis)
                    }
                }
                .padding(16)
                .background(card)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    @ViewBuilder
    private func aiResultsView(_ analysis: AIAnalysisData) -> some View {
        // Summary
        aiCard(title: "Summary") {
            Text(analysis.summary)
                .font(.footnote)
                .foregroundColor(.secondary)
                .lineSpacing(4)
        }

        // Content Themes
        aiCard(title: "Content Themes") {
            ForEach(analysis.contentThemes, id: \.theme) { theme in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(theme.theme)
                            .font(.subheadline.weight(.semibold))
                        Spacer()
                        Text(theme.frequency)
                            .font(.caption2.weight(.medium))
                            .foregroundColor(.white)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(frequencyColor(theme.frequency))
                            .clipShape(Capsule())
                    }
                    Text(theme.description)
                        .font(.footnote)
                        .foregroundColor(.secondary)
                    ForEach(theme.examples, id: \.self) { example in
                        Text("\u{201C}\(example)\u{201D}")
                            .font(.caption)
                            .foregroundColor(subtle)
                            .italic()
                            .lineLimit(2)
                            .padding(.leading, 12)
                    }
                }
                .padding(.bottom, 8)
            }
        }

        // Writing Style
        aiCard(title: "Writing Style") {
            labeledSection("TONE", content: analysis.writingStyle.tone)
            labeledSection("CHARACTERISTICS") {
                ForEach(analysis.writingStyle.characteristics, id: \.self) { char in
                    HStack(alignment: .top, spacing: 6) {
                        Text("•").foregroundColor(.green)
                        Text(char).font(.footnote).foregroundColor(.secondary)
                    }
                }
            }
            labeledSection("VOICE", content: analysis.writingStyle.voiceDescription)
        }

        // Engagement Insights
        aiCard(title: "Engagement Insights") {
            if !analysis.engagementPatterns.topPerformers.isEmpty {
                labeledSection("TOP PERFORMERS") {
                    ForEach(analysis.engagementPatterns.topPerformers, id: \.self) { item in
                        HStack(alignment: .top, spacing: 6) {
                            Text("★").foregroundColor(.orange)
                            Text(item).font(.footnote).foregroundColor(.secondary)
                        }
                    }
                }
            }
            if !analysis.engagementPatterns.strengths.isEmpty {
                labeledSection("YOUR STRENGTHS") {
                    ForEach(analysis.engagementPatterns.strengths, id: \.self) { item in
                        HStack(alignment: .top, spacing: 6) {
                            Text("✓").foregroundColor(.green)
                            Text(item).font(.footnote).foregroundColor(.secondary)
                        }
                    }
                }
            }
            if !analysis.engagementPatterns.observations.isEmpty {
                labeledSection("OBSERVATIONS") {
                    ForEach(analysis.engagementPatterns.observations, id: \.self) { item in
                        HStack(alignment: .top, spacing: 6) {
                            Text("•").foregroundColor(.purple)
                            Text(item).font(.footnote).foregroundColor(.secondary)
                        }
                    }
                }
            }
        }

        // Optimal Posting Times
        if !analysis.optimalTimes.isEmpty {
            aiCard(title: "AI-Recommended Posting Times") {
                ForEach(Array(analysis.optimalTimes.enumerated()), id: \.offset) { index, rec in
                    optimalTimeRow(rec: rec, index: index)
                }
            }
        }

        // Hide button
        Button {
            viewModel.analysisRequested = false
        } label: {
            Text("Hide Analysis")
                .font(.subheadline)
                .foregroundColor(subtle)
                .frame(maxWidth: .infinity)
                .padding(12)
                .background(card.opacity(0.5))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
    }

    private func aiCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(colorScheme == .dark ? Color(white: 0.08) : Color(white: 0.97))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func labeledSection(_ label: String, content: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2.weight(.medium))
                .foregroundColor(subtle)
                .tracking(0.5)
            Text(content)
                .font(.footnote)
                .foregroundColor(.secondary)
                .lineSpacing(3)
        }
        .padding(.bottom, 4)
    }

    @ViewBuilder
    private func labeledSection<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption2.weight(.medium))
                .foregroundColor(subtle)
                .tracking(0.5)
            content()
        }
        .padding(.bottom, 4)
    }

    private func optimalTimeRow(rec: OptimalTimeRec, index: Int) -> some View {
        let dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
        let hourStr = rec.hour == 0 ? "12:00 AM" : rec.hour == 12 ? "12:00 PM" : rec.hour < 12 ? "\(rec.hour):00 AM" : "\(rec.hour - 12):00 PM"
        let confidenceColor: Color = rec.confidence == "high" ? .green : rec.confidence == "medium" ? .yellow : .secondary

        return HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(index == 0 ? "Best Time" : "#\(index + 1)")
                    .font(.caption)
                    .foregroundColor(subtle)
                Text(hourStr)
                    .font(.headline.weight(.bold))
                Text(rec.dayOfWeek == -1 ? "Any day" : dayNames[rec.dayOfWeek])
                    .font(.footnote)
                    .foregroundColor(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(rec.confidence)
                    .font(.caption2.weight(.medium))
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(confidenceColor)
                    .clipShape(Capsule())
                Text("~\(rec.avgEngagement) avg")
                    .font(.caption)
                    .foregroundColor(.accentColor)
            }
        }
        .padding(12)
        .background(
            index == 0
                ? Color.accentColor.opacity(0.08)
                : Color.clear
        )
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(index == 0 ? Color.accentColor : Color.clear, lineWidth: 1)
        )
    }

    private func frequencyColor(_ freq: String) -> Color {
        switch freq {
        case "primary": return .blue
        case "regular": return .purple
        default: return .secondary
        }
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
