/**
 * Native Analytics View - SwiftUI analytics with Swift Charts
 *
 * Wraps the native SwiftUI AnalyticsView which uses Swift Charts
 * for engagement, posting frequency, and hourly heatmap charts.
 */

import React, { useMemo } from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import { Platform, View, ViewProps } from 'react-native';
import type { AnalyticsMetrics } from '../../../src/services/atproto/analytics';


const NativeAnalyticsNative = Platform.OS === 'ios'
  ? requireNativeViewManager('NativeAnalytics')
  : null;

export interface NativeAnalyticsViewProps extends ViewProps {
  metrics: AnalyticsMetrics | null;
  timeRange: string;
  isLoading: boolean;
  isRefreshing: boolean;
  onTimeRangeChange?: (event: { nativeEvent: { range: string } }) => void;
  onPostPress?: (event: { nativeEvent: { uri: string; handle: string; did: string } }) => void;
  onRefresh?: () => void;
  onScroll?: (event: { nativeEvent: { y: number } }) => void;
}

export function NativeAnalyticsView({
  metrics,
  timeRange,
  isLoading,
  isRefreshing,
  onTimeRangeChange,
  onPostPress,
  onRefresh,
  onScroll,
  style,
  ...viewProps
}: NativeAnalyticsViewProps) {
  // Serialize metrics to JSON for the native side
  const metricsJSON = useMemo(() => {
    if (!metrics) return '{}';
    return JSON.stringify({
      likesReceived: metrics.likesReceived,
      repostsReceived: metrics.repostsReceived,
      repliesReceived: metrics.repliesReceived,
      followersCount: metrics.followersCount,
      followsCount: metrics.followsCount,
      postsCount: metrics.postsCount,
      engagementRate: metrics.engagementRate,
      dailyEngagement: metrics.dailyEngagement,
      postingTimes: metrics.postingTimes,
    });
  }, [metrics]);

  const topPostsJSON = useMemo(() => {
    if (!metrics?.topPosts) return '[]';
    return JSON.stringify(metrics.topPosts);
  }, [metrics?.topPosts]);

  if (!NativeAnalyticsNative) {
    return <View style={style} {...viewProps} />;
  }

  return (
    <NativeAnalyticsNative
      metricsJSON={metricsJSON}
      topPostsJSON={topPostsJSON}
      timeRange={timeRange}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      onTimeRangeChange={onTimeRangeChange}
      onPostPress={onPostPress}
      onRefresh={onRefresh}
      onScroll={onScroll}
      style={[{ flex: 1 }, style]}
      {...viewProps}
    />
  );
}
