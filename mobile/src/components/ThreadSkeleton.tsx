import React, {useMemo} from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {SkeletonShimmer} from './SkeletonShimmer';
import {useTheme} from '../contexts/ThemeContext';

function ThreadPostSkeleton({isParent = false, isReply = false, styles}: {isParent?: boolean; isReply?: boolean; styles: any}) {
  return (
    <View style={[styles.post, isParent && styles.parentPost, isReply && styles.replyPost]}>
      {/* Connector line for replies */}
      {isReply && <View style={styles.connector} />}

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

export function ThreadSkeleton() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView style={styles.container}>
      {/* Parent posts in thread */}
      <ThreadPostSkeleton isParent styles={styles} />
      <ThreadPostSkeleton isParent styles={styles} />

      {/* Main post (highlighted) */}
      <View style={styles.mainPost}>
        <ThreadPostSkeleton styles={styles} />
      </View>

      {/* Reply posts */}
      <ThreadPostSkeleton isReply styles={styles} />
      <ThreadPostSkeleton isReply styles={styles} />
      <ThreadPostSkeleton isReply styles={styles} />
    </ScrollView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    post: {
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    parentPost: {
      backgroundColor: colors.background,
    },
    mainPost: {
      backgroundColor: colors.surface,
      borderTopWidth: 2,
      borderBottomWidth: 2,
      borderColor: colors.borderLight,
    },
    replyPost: {
      paddingLeft: 32,
    },
    connector: {
      position: 'absolute',
      left: 36,
      top: 0,
      width: 2,
      height: '100%',
      backgroundColor: colors.border,
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
