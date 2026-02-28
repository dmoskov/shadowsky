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

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

interface EngagementChartProps {
  dailyEngagement: DailyEngagement[];
  colors: ThemeColors;
  chartHeight?: number;
  timeRange?: TimeRange;
}

function EngagementChartInner({
  dailyEngagement,
  colors,
  chartHeight = 200,
  timeRange,
}: EngagementChartProps) {
  const isHourly = timeRange === "today";
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Scale chart height for small screens (iPhone SE = 667pt)
  const CHART_HEIGHT = windowHeight < 700 ? Math.min(chartHeight, 160) : chartHeight;

  const maxDailyEngagement = useMemo(() => {
    if (!dailyEngagement || dailyEngagement.length === 0) return 1;
    return Math.max(
      1,
      ...dailyEngagement.map((d) => d.likes + d.reposts + d.replies),
    );
  }, [dailyEngagement]);

  if (dailyEngagement.length <= 1) return null;

  const len = dailyEngagement.length;
  const MIN_BAR_WIDTH = 16;
  const BAR_GAP = 2;
  const sectionPadding = 32;
  const yAxisWidth = 36;
  const screenWidth =
    windowWidth - 32 - sectionPadding - yAxisWidth;
  const fitsInline = len * (MIN_BAR_WIDTH + BAR_GAP) <= screenWidth;
  const chartWidth = fitsInline
    ? undefined
    : len * (MIN_BAR_WIDTH + BAR_GAP);

  const chartContent = (
    <View
      style={[
        styles.chartContainer,
        { height: CHART_HEIGHT + 20 },
        chartWidth ? { width: chartWidth } : undefined,
      ]}
    >
      {dailyEngagement.map((day, index) => {
        const total = day.likes + day.reposts + day.replies;
        const likesHeight =
          maxDailyEngagement > 0
            ? (day.likes / maxDailyEngagement) * CHART_HEIGHT
            : 0;
        const repostsHeight =
          maxDailyEngagement > 0
            ? (day.reposts / maxDailyEngagement) * CHART_HEIGHT
            : 0;
        const repliesHeight =
          maxDailyEngagement > 0
            ? (day.replies / maxDailyEngagement) * CHART_HEIGHT
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
          const hour = parseInt(dateParts[3]);
          dateLabel = formatHourLabel(hour);
        } else {
          const month = parseInt(dateParts[1]);
          const dayNum = parseInt(dateParts[2]);
          // Show month/day on first label of each month, day-only otherwise
          const prevDateParts =
            index > 0 ? dailyEngagement[index - 1].date.split("-") : null;
          const isNewMonth =
            !prevDateParts || parseInt(prevDateParts[1]) !== month;
          dateLabel =
            isNewMonth || index === 0 ? `${month}/${dayNum}` : `${dayNum}`;
        }

        return (
          <View
            key={day.date}
            style={[styles.barContainer, { minWidth: MIN_BAR_WIDTH }]}
          >
            <View style={[styles.barWrapper, { height: CHART_HEIGHT }]}>
              {day.replies > 0 && (
                <View
                  style={[
                    styles.barSegment,
                    {
                      height: repliesHeight,
                      backgroundColor: "#4ade80",
                      borderTopLeftRadius:
                        day.reposts === 0 && day.likes === 0 ? 3 : 0,
                      borderTopRightRadius:
                        day.reposts === 0 && day.likes === 0 ? 3 : 0,
                    },
                  ]}
                />
              )}
              {day.reposts > 0 && (
                <View
                  style={[
                    styles.barSegment,
                    {
                      height: repostsHeight,
                      backgroundColor: "#3b82f6",
                      borderTopLeftRadius: day.likes === 0 ? 3 : 0,
                      borderTopRightRadius: day.likes === 0 ? 3 : 0,
                    },
                  ]}
                />
              )}
              {day.likes > 0 && (
                <View
                  style={[
                    styles.barSegment,
                    {
                      height: likesHeight,
                      backgroundColor: "#ef4444",
                      borderTopLeftRadius: 3,
                      borderTopRightRadius: 3,
                    },
                  ]}
                />
              )}
              {total === 0 && (
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
              numberOfLines={1}
              allowFontScaling={false}
            >
              {showLabel ? dateLabel : " "}
            </Text>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.section, { backgroundColor: colors.surfaceElevated }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        {isHourly ? "Hourly Engagement" : "Engagement Over Time"}
      </Text>
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#ef4444" }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            Likes
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#3b82f6" }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            Reposts
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: "#4ade80" }]} />
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>
            Replies
          </Text>
        </View>
      </View>
      <View style={styles.chartWithAxis}>
        {/* Y-axis labels */}
        <View style={[styles.yAxis, { height: CHART_HEIGHT }]}>
          <Text style={[styles.yAxisLabel, { color: colors.textTertiary }]}>
            {maxDailyEngagement}
          </Text>
          <Text style={[styles.yAxisLabel, { color: colors.textTertiary }]}>
            {Math.round(maxDailyEngagement * 0.75)}
          </Text>
          <Text style={[styles.yAxisLabel, { color: colors.textTertiary }]}>
            {Math.round(maxDailyEngagement * 0.5)}
          </Text>
          <Text style={[styles.yAxisLabel, { color: colors.textTertiary }]}>
            {Math.round(maxDailyEngagement * 0.25)}
          </Text>
          <Text style={[styles.yAxisLabel, { color: colors.textTertiary }]}>
            0
          </Text>
        </View>
        {/* Chart area with grid lines */}
        <View style={{ flex: 1 }}>
          {/* Grid lines */}
          <View style={[styles.gridLines, { height: CHART_HEIGHT }]}>
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
              {chartContent}
            </ScrollView>
          ) : (
            chartContent
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
  chartLegend: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
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
    overflow: "visible",
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
    textAlign: "center",
  },
});

export const EngagementChart = React.memo(EngagementChartInner);
