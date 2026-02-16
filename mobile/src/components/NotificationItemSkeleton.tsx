import React, { useMemo } from 'react';
import {View, StyleSheet} from 'react-native';
import {SkeletonShimmer} from './SkeletonShimmer';
import { useTheme } from "../contexts/ThemeContext";

export function NotificationItemSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {/* Icon */}
      <View style={styles.iconContainer}>
        <SkeletonShimmer width={16} height={16} borderRadius={8} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Avatar + Name + Action */}
        <View style={styles.header}>
          <SkeletonShimmer width={32} height={32} borderRadius={16} />
          <View style={styles.headerText}>
            <SkeletonShimmer width={120} height={14} />
            <View style={styles.smallSpacer} />
            <SkeletonShimmer width={100} height={12} />
          </View>
        </View>

        {/* Notification text/content (optional) */}
        <View style={styles.notificationContent}>
          <SkeletonShimmer width="90%" height={12} />
          <View style={styles.smallSpacer} />
          <SkeletonShimmer width="60%" height={12} />
        </View>

        {/* Timestamp */}
        <View style={styles.timestamp}>
          <SkeletonShimmer width={80} height={10} />
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      padding: 16,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconContainer: {
      width: 24,
      alignItems: 'center',
      marginRight: 12,
    },
    content: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    headerText: {
      marginLeft: 8,
      flex: 1,
    },
    notificationContent: {
      marginTop: 8,
      marginBottom: 8,
    },
    timestamp: {
      marginTop: 4,
    },
    smallSpacer: {
      height: 4,
    },
  });
}
