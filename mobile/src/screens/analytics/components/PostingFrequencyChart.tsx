import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import type { ThemeColors } from "../../../contexts/ThemeContext";
import type { DailyEngagement, TimeRange } from "../../../services/atproto/analytics";

const SMALL_SCREEN_WIDTH = 390;

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

interface PostingFrequencyChartProps {
  dailyEngagement: DailyEngagement[];
  colors: ThemeColors;
  chartHeight?: number;
  timeRange?: TimeRange;
}

function PostingFrequencyChartInner({
  dailyEngagement,
  colors,
  chartHeight = 180,
  timeRange,
}: PostingFrequencyChartProps) {
  const isHourly = timeRange === "today";
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Scale chart height for small screens (iPhone SE = 667pt)
  const FREQ_CHART_HEIGHT = windowHeight < 700 ? Math.min(chartHeight, 140) : chartHeight;

  const maxPostsPerDay = useMemo(() => {
    if (!dailyEngagement || dailyEngagement.length === 0) return 1;
    return Math.max(
      1,
      ...dailyEngagement.map((d) => d.posts),
    );
  }, [dailyEngagement]);

  if (dailyEngagement.length <= 1) return null;

  const len = dailyEngagement.length;
  const MIN_BAR_WIDTH = 16;
  const BAR_GAP = 2;
  const sectionPadding = 32;
  const yAxisWidth = 30;
  const screenWidth =
    windowWidth - 32 - sectionPadding - yAxisWidth;
  const fitsInline = len * (MIN_BAR_WIDTH + BAR_GAP) <= screenWidth;
  const chartWidth = fitsInline
    ? undefined
    : len * (MIN_BAR_WIDTH + BAR_GAP);

  const freqContent = (
    <View
      style={[
        styles.chartContainer,
        { height: FREQ_CHART_HEIGHT + 20 },
        chartWidth ? { width: chartWidth } : undefined,
      ]}
    >
      {dailyEngagement.map((day, index) => {
        const originalHeight =
          maxPostsPerDay > 0
            ? ((day.originalPosts || 0) / maxPostsPerDay) * FREQ_CHART_HEIGHT
            : 0;
        const replyHeight =
          maxPostsPerDay > 0
            ? ((day.replyPosts || 0) / maxPostsPerDay) * FREQ_CHART_HEIGHT
            : 0;

        const labelInterval = isHourly
          ? 3 // Every 3 hours for 24h view
          : len <= 7 ? 1 : len <= 14 ? 2 : len <= 30 ? 5 : 10;
        const showLabel = isHourly
          ? index % labelInterval === 0
          : index === 0 || index === len - 1 || index % labelInterval === 0;

        const dateParts = day.date.split("-");
        let dateLabel: string;
        if (isHourly && dateParts.length >= 4) {
          dateLabel = formatHourLabel(parseInt(dateParts[3]));
        } else {
          dateLabel = `${parseInt(dateParts[1])}/${parseInt(dateParts[2])}`;
        }

        return (
          <View
            key={day.date}
            style={[styles.barContainer, { minWidth: MIN_BAR_WIDTH }]}
          >
            <View style={[styles.barWrapper, { height: FREQ_CHART_HEIGHT }]}>
              {(day.replyPosts || 0) > 0 && (
                <View
                  style={[
                    styles.barSegment,
                    {
                      height: replyHeight,
                      backgroundColor: "#4ade80",
                      borderTopLeftRadius:
                        (day.originalPosts || 0) === 0 ? 3 : 0,
                      borderTopRightRadius:
                        (day.originalPosts || 0) === 0 ? 3 : 0,
                    },
                  ]}
                />
              )}
              {(day.originalPosts || 0) > 0 && (
                <View
                  style={[
                    styles.barSegment,
                    {
                      height: originalHeight,
                      backgroundColor: "#f97316",
                      borderTopLeftRadius:
                        (day.replyPosts || 0) === 0 ? 3 : 0,
                      borderTopRightRadius:
                        (day.replyPosts || 0) === 0 ? 3 : 0,
                    },
                  ]}
                />
              )}
              {day.posts === 0 && (
                <View
                  style={[
                    styles.barSegment,
                    {
                      height: 4,
                      backgroundColor: colors.textTertiary,
                      borderRadius: 2,
                      opacity: 0.3,
                    },
                  ]}
                />
              )}
            </View>
            <Text
              style={[
                styles.barLabel,
                { color: colors.textTertiary },
                !showLabel && { opacity: 0 },
              ]}
            >
              {showLabel ? dateLabel : " "}
            </Text>
          </View>
        );
      })}
    </View>
  );

  const isNarrow = windowWidth < SMALL_SCREEN_WIDTH;

  return (
    <View style={[styles.section, { backgroundColor: colors.surfaceElevated }]}>
      <View style={[styles.freqHeader, isNarrow && styles.freqHeaderNarrow]}>
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.text, marginBottom: 0 },
          ]}
        >
          {isHourly ? "Hourly Posts" : "Posting Frequency"}
        </Text>
        <View style={[styles.chartLegend, isNarrow && styles.chartLegendNarrow]}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#f97316" }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>
              Posts
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#4ade80" }]} />
            <Text style={[styles.legendText, { color: colors.textSecondary }]}>
              Replies
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.chartWithAxis, { marginTop: 12 }]}>
        <View
          style={[styles.yAxis, { height: FREQ_CHART_HEIGHT, width: 30 }]}
        >
          <Text style={[styles.yAxisLabel, { color: colors.textTertiary }]}>
            {maxPostsPerDay}
          </Text>
          <Text style={[styles.yAxisLabel, { color: colors.textTertiary }]}>
            {Math.round(maxPostsPerDay * 0.75)}
          </Text>
          <Text style={[styles.yAxisLabel, { color: colors.textTertiary }]}>
            {Math.round(maxPostsPerDay * 0.5)}
          </Text>
          <Text style={[styles.yAxisLabel, { color: colors.textTertiary }]}>
            {Math.round(maxPostsPerDay * 0.25)}
          </Text>
          <Text style={[styles.yAxisLabel, { color: colors.textTertiary }]}>
            0
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.gridLines, { height: FREQ_CHART_HEIGHT }]}>
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
              <View
                key={fraction}
                style={[
                  styles.gridLine,
                  {
                    bottom: `${fraction * 100}%` as any,
                    borderBottomColor: colors.border,
                    opacity: fraction === 0 ? 0.5 : 0.15,
                  },
                ]}
              />
            ))}
          </View>
          {!fitsInline ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartScrollContent}
            >
              {freqContent}
            </ScrollView>
          ) : (
            freqContent
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  freqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  freqHeaderNarrow: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 6,
  },
  chartLegend: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  chartLegendNarrow: {
    marginBottom: 0,
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
  },
  chartWithAxis: {
    flexDirection: "row",
  },
  yAxis: {
    width: 36,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: 4,
  },
  yAxisLabel: {
    fontSize: 10,
  },
  gridLines: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderBottomWidth: 1,
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  chartScrollContent: {
    paddingRight: 8,
  },
  barContainer: {
    flex: 1,
    alignItems: "center",
  },
  barWrapper: {
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  barSegment: {
    width: "80%",
  },
  barLabel: {
    fontSize: 9,
    marginTop: 4,
  },
});

export const PostingFrequencyChart = React.memo(PostingFrequencyChartInner);
