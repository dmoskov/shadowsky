import React, { useMemo } from 'react';
import {Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import { useTheme } from "../contexts/ThemeContext";
import { triggerHaptic } from "../utils/haptics";

export type NotificationFilter = 'all' | 'likes' | 'reposts' | 'replies' | 'follows' | 'mentions' | 'quotes';

interface NotificationTabBarProps {
  activeFilter: NotificationFilter;
  onFilterChange: (filter: NotificationFilter) => void;
  counts?: Partial<Record<NotificationFilter, number>>;
}

export function NotificationTabBar({
  activeFilter,
  onFilterChange,
  counts,
}: NotificationTabBarProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const tabs: {key: NotificationFilter; label: string}[] = [
    {key: 'all', label: 'All'},
    {key: 'likes', label: 'Likes'},
    {key: 'reposts', label: 'Reposts'},
    {key: 'replies', label: 'Replies'},
    {key: 'mentions', label: 'Mentions'},
    {key: 'follows', label: 'Follows'},
    {key: 'quotes', label: 'Quotes'},
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeFilter === tab.key && styles.activeTab]}
          onPress={() => { triggerHaptic("light"); onFilterChange(tab.key); }}
          activeOpacity={0.7}>
          <Text
            style={[
              styles.tabText,
              activeFilter === tab.key && styles.activeTabText,
            ]}>
            {tab.label}
            {counts?.[tab.key] ? ` (${counts[tab.key]})` : ''}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flexGrow: 0,
      flexShrink: 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
      backgroundColor: colors.background,
    },
    contentContainer: {
      paddingHorizontal: 8,
    },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginHorizontal: 4,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    activeTab: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textTertiary,
    },
    activeTabText: {
      color: colors.primary,
    },
  });
}
