import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import {colors} from '../constants/theme';

export type NotificationFilter = 'all' | 'likes' | 'replies' | 'follows' | 'mentions' | 'quotes';

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
  const tabs: {key: NotificationFilter; label: string}[] = [
    {key: 'all', label: 'All'},
    {key: 'replies', label: 'Replies'},
    {key: 'mentions', label: 'Mentions'},
    {key: 'likes', label: 'Likes'},
    {key: 'follows', label: 'Follows'},
    {key: 'quotes', label: 'Quotes'},
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tab, activeFilter === tab.key && styles.activeTab]}
          onPress={() => onFilterChange(tab.key)}
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

const styles = StyleSheet.create({
  container: {
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
