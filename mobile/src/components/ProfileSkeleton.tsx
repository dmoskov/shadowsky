import React from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {SkeletonShimmer} from './SkeletonShimmer';
import {PostCardSkeleton} from './PostCardSkeleton';
import {colors} from '../constants/theme';

export function ProfileSkeleton() {
  return (
    <ScrollView style={styles.container}>
      {/* Banner */}
      <SkeletonShimmer width="100%" height={120} borderRadius={0} />

      {/* Profile info section */}
      <View style={styles.profileInfo}>
        {/* Avatar overlapping banner */}
        <View style={styles.avatarContainer}>
          <SkeletonShimmer width={80} height={80} borderRadius={40} />
        </View>

        {/* Action button */}
        <View style={styles.actionButton}>
          <SkeletonShimmer width={100} height={36} borderRadius={18} />
        </View>

        {/* Name and handle */}
        <View style={styles.nameSection}>
          <SkeletonShimmer width={150} height={20} />
          <View style={styles.spacer} />
          <SkeletonShimmer width={100} height={14} />
        </View>

        {/* Bio */}
        <View style={styles.bioSection}>
          <SkeletonShimmer width="100%" height={14} />
          <View style={styles.spacer} />
          <SkeletonShimmer width="90%" height={14} />
          <View style={styles.spacer} />
          <SkeletonShimmer width="60%" height={14} />
        </View>

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <SkeletonShimmer width={40} height={16} />
            <View style={styles.smallSpacer} />
            <SkeletonShimmer width={60} height={12} />
          </View>
          <View style={styles.stat}>
            <SkeletonShimmer width={40} height={16} />
            <View style={styles.smallSpacer} />
            <SkeletonShimmer width={60} height={12} />
          </View>
          <View style={styles.stat}>
            <SkeletonShimmer width={40} height={16} />
            <View style={styles.smallSpacer} />
            <SkeletonShimmer width={60} height={12} />
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <SkeletonShimmer width={60} height={12} />
        <SkeletonShimmer width={60} height={12} />
        <SkeletonShimmer width={60} height={12} />
        <SkeletonShimmer width={60} height={12} />
      </View>

      {/* Post list */}
      <PostCardSkeleton />
      <PostCardSkeleton />
      <PostCardSkeleton />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  profileInfo: {
    padding: 16,
  },
  avatarContainer: {
    marginTop: -40,
    marginBottom: 12,
  },
  actionButton: {
    position: 'absolute',
    top: 8,
    right: 16,
  },
  nameSection: {
    marginBottom: 12,
  },
  bioSection: {
    marginBottom: 16,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  stat: {
    alignItems: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  spacer: {
    height: 8,
  },
  smallSpacer: {
    height: 4,
  },
});
