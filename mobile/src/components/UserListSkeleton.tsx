import React, {useMemo} from 'react';
import {View, StyleSheet} from 'react-native';
import {SkeletonShimmer} from './SkeletonShimmer';
import {useTheme} from '../contexts/ThemeContext';

function UserItemSkeleton({colors}: {colors: any}) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.item}>
      <SkeletonShimmer width={44} height={44} borderRadius={22} />
      <View style={styles.textArea}>
        <SkeletonShimmer width={130} height={14} />
        <View style={styles.spacer} />
        <SkeletonShimmer width={90} height={12} />
      </View>
      <SkeletonShimmer width={72} height={32} borderRadius={16} />
    </View>
  );
}

export function UserListSkeleton({count = 8}: {count?: number}) {
  const {colors} = useTheme();

  return (
    <View>
      {Array.from({length: count}).map((_, i) => (
        <UserItemSkeleton key={i} colors={colors} />
      ))}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    textArea: {
      flex: 1,
      marginLeft: 12,
    },
    spacer: {
      height: 6,
    },
  });
}
