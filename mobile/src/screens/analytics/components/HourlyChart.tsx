import React, { useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { ThemeColors } from "../../../contexts/ThemeContext";
import type { PostingTimeData } from "../../../services/atproto/analytics";

interface HourlyChartProps {
  postingTimes: PostingTimeData;
  colors: ThemeColors;
}

function formatHour(hour: number): string {
  if (hour === 0) return "12AM";
  if (hour === 12) return "12PM";
  return hour < 12 ? `${hour}AM` : `${hour - 12}PM`;
}

function HourlyChartInner({ postingTimes, colors }: HourlyChartProps) {
  const maxHourlyEngagement = useMemo(() => {
    if (!postingTimes) return 1;
    return Math.max(1, ...postingTimes.hourEngagement);
  }, [postingTimes]);

  return (
    <View style={[styles.section, { backgroundColor: colors.surfaceElevated }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Best Posting Times
      </Text>
      <View style={styles.postingTimesCards}>
        <View
          style={[
            styles.postingTimeCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.primary,
              borderWidth: 1,
            },
          ]}
        >
          <Text
            style={[
              styles.postingTimeLabel,
              { color: colors.textSecondary },
            ]}
          >
            Highest Engagement
          </Text>
          <Text
            style={[styles.postingTimeValue, { color: colors.primary }]}
          >
            {formatHour(postingTimes.bestEngagementHour)}
          </Text>
          <Text
            style={[
              styles.postingTimeDetail,
              { color: colors.textTertiary },
            ]}
          >
            Avg{" "}
            {postingTimes.hourEngagement[
              postingTimes.bestEngagementHour
            ]?.toFixed(1) || "0"}{" "}
            interactions
          </Text>
        </View>
        <View
          style={[
            styles.postingTimeCard,
            { backgroundColor: colors.surface },
          ]}
        >
          <Text
            style={[
              styles.postingTimeLabel,
              { color: colors.textSecondary },
            ]}
          >
            Most Active Hour
          </Text>
          <Text
            style={[
              styles.postingTimeValue,
              { color: colors.accentPurple },
            ]}
          >
            {formatHour(postingTimes.mostActiveHour)}
          </Text>
          <Text
            style={[
              styles.postingTimeDetail,
              { color: colors.textTertiary },
            ]}
          >
            {postingTimes.hourCounts[postingTimes.mostActiveHour]} posts
          </Text>
        </View>
      </View>

      {/* Hourly engagement chart */}
      <View style={styles.hourlyChartContainer}>
        {postingTimes.hourEngagement.map((avg, hour) => {
          const barHeight =
            maxHourlyEngagement > 0
              ? (avg / maxHourlyEngagement) * 60
              : 0;
          const isBest = hour === postingTimes.bestEngagementHour;
          return (
            <View key={hour} style={styles.hourlyBarContainer}>
              <View style={styles.hourlyBarWrapper}>
                <View
                  style={[
                    styles.hourlyBar,
                    {
                      height: Math.max(barHeight, 2),
                      backgroundColor: isBest
                        ? colors.primary
                        : colors.accentPurple,
                      opacity: isBest ? 1 : 0.4,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.hourlyLabel,
                  { color: colors.textTertiary },
                  hour % 6 !== 0 && { opacity: 0 },
                ]}
              >
                {hour % 6 === 0 ? hour : " "}
              </Text>
            </View>
          );
        })}
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
  postingTimesCards: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  postingTimeCard: {
    flex: 1,
    borderRadius: 10,
    padding: 14,
  },
  postingTimeLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  postingTimeValue: {
    fontSize: 22,
    fontWeight: "bold",
  },
  postingTimeDetail: {
    fontSize: 11,
    marginTop: 4,
  },
  hourlyChartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 80,
    gap: 1,
  },
  hourlyBarContainer: {
    flex: 1,
    alignItems: "center",
  },
  hourlyBarWrapper: {
    width: "100%",
    height: 60,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  hourlyBar: {
    width: "70%",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  hourlyLabel: {
    fontSize: 9,
    marginTop: 3,
  },
});

export const HourlyChart = React.memo(HourlyChartInner);
