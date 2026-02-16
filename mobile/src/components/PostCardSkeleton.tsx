import React, {useMemo} from 'react';
import {View, StyleSheet} from 'react-native';
import {SkeletonShimmer} from './SkeletonShimmer';
import {useTheme} from '../contexts/ThemeContext';

export function PostCardSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {/* Header: Avatar + Name + Handle */}
      <View style={styles.header}>
        <SkeletonShimmer width={40} height={40} borderRadius={20} />
        <View style={styles.headerText}>
          <SkeletonShimmer width={120} height={14} />
          <View style={styles.spacer} />
          <SkeletonShimmer width={80} height={12} />
        </View>
      </View>

      {/* Post content */}
      <View style={styles.content}>
        <SkeletonShimmer width="95%" height={14} />
        <View style={styles.spacer} />
        <SkeletonShimmer width="85%" height={14} />
        <View style={styles.spacer} />
        <SkeletonShimmer width="70%" height={14} />
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <SkeletonShimmer width={60} height={12} />
        <SkeletonShimmer width={60} height={12} />
        <SkeletonShimmer width={60} height={12} />
        <SkeletonShimmer width={60} height={12} />
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      padding: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerText: {
      marginLeft: 12,
      flex: 1,
    },
    content: {
      marginBottom: 12,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: 8,
    },
    spacer: {
      height: 8,
    },
  });
}
