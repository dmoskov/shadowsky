/**
 * Native Analytics View - SwiftUI analytics with Swift Charts
 *
 * Wraps the native SwiftUI AnalyticsView which uses Swift Charts
 * for engagement, posting frequency, and hourly heatmap charts.
 * Includes AI content analysis panel with full results rendering.
 */

import React, { useMemo } from 'react';
import { requireNativeViewManager } from 'expo-modules-core';
import { Platform, View, ViewProps } from 'react-native';
import type { AnalyticsMetrics } from '../../../src/services/atproto/analytics';
import type { PostAnalysisResult } from '../../../src/services/ai-service';

const NativeAnalyticsNative = Platform.OS === 'ios'
  ? requireNativeViewManager('NativeAnalytics')
  : null;

export interface NativeAnalyticsViewProps extends ViewProps {
  metrics: AnalyticsMetrics | null;
  timeRange: string;
  isLoading: boolean;
  isRefreshing: boolean;
  analysisRequested: boolean;
  isLoadingAnalysis: boolean;
  analysisData: PostAnalysisResult | undefined;
  onTimeRangeChange?: (event: { nativeEvent: { range: string } }) => void;
  onPostPress?: (event: { nativeEvent: { uri: string; handle: string; did: string } }) => void;
  onRefresh?: () => void;
  onScroll?: (event: { nativeEvent: { y: number } }) => void;
  onAnalyzeRequest?: () => void;
}

export function NativeAnalyticsView({
  metrics,
  timeRange,
  isLoading,
  isRefreshing,
  analysisRequested,
  isLoadingAnalysis,
  analysisData,
  onTimeRangeChange,
  onPostPress,
  onRefresh,
  onScroll,
  onAnalyzeRequest,
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
      impressions: metrics.impressions,
      engagementRate: metrics.engagementRate,
      dailyEngagement: metrics.dailyEngagement,
      postingTimes: metrics.postingTimes,
    });
  }, [metrics]);

  const topPostsJSON = useMemo(() => {
    if (!metrics?.topPosts) return '[]';
    return JSON.stringify(metrics.topPosts);
  }, [metrics?.topPosts]);

  const analysisJSON = useMemo(() => {
    if (!analysisData) return '';
    return JSON.stringify(analysisData);
  }, [analysisData]);

  if (!NativeAnalyticsNative) {
    return <View style={style} {...viewProps} />;
  }

  return (
    <NativeAnalyticsNative
      metricsJSON={metricsJSON}
      topPostsJSON={topPostsJSON}
      analysisJSON={analysisJSON}
      timeRange={timeRange}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      isLoadingAnalysis={isLoadingAnalysis}
      analysisRequested={analysisRequested}
      onTimeRangeChange={onTimeRangeChange}
      onPostPress={onPostPress}
      onRefresh={onRefresh}
      onScroll={onScroll}
      onAnalyzeRequest={onAnalyzeRequest}
      style={[{ flex: 1 }, style]}
      {...viewProps}
    />
  );
}
