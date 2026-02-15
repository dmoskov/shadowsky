/**
 * Stale Content Indicator Component
 *
 * Displays a subtle indicator when viewing cached/stale content offline.
 * Shows at the top of feed/thread views to inform users they're viewing
 * older cached data.
 *
 * Features:
 * - Subtle gray background to not distract
 * - Shows time since last update
 * - Only visible when offline or viewing cached content
 * - Tap to retry connection (when available)
 */

import React from 'react';
import {StyleSheet, Text, View, TouchableOpacity} from 'react-native';
import {AlertTriangleIcon} from './icons';
import {colors} from '../constants/theme';

interface StaleContentIndicatorProps {
  isStale: boolean;
  lastCachedAt?: number | null;
  onRetry?: () => void;
  isOnline?: boolean;
}

export default function StaleContentIndicator({
  isStale,
  lastCachedAt,
  onRetry,
  isOnline = false,
}: StaleContentIndicatorProps) {
  if (!isStale) return null;

  const getTimeAgoText = () => {
    if (!lastCachedAt) return 'some time ago';

    const now = Date.now();
    const diff = now - lastCachedAt;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const content = (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <AlertTriangleIcon size={16} color={colors.textTertiary} />
      </View>
      <Text style={styles.text}>
        {isOnline
          ? `Viewing cached content from ${getTimeAgoText()}`
          : `Offline - Viewing cached content from ${getTimeAgoText()}`}
      </Text>
      {onRetry && isOnline && (
        <Text style={styles.retryText}>Tap to refresh</Text>
      )}
    </View>
  );

  if (onRetry && isOnline) {
    return (
      <TouchableOpacity onPress={onRetry} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.textMuted,
    borderBottomWidth: 1,
    borderBottomColor: colors.textMuted,
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontSize: 13,
    color: colors.textTertiary,
    fontWeight: '500',
    flex: 1,
  },
  retryText: {
    fontSize: 12,
    color: colors.info,
    fontWeight: '600',
    marginLeft: 8,
  },
});
