import React, {useMemo, useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useTheme} from '../../contexts/ThemeContext';
import {fontSize} from '../../utils/typography';
import {FeedDiscoveryScreen} from '../feeds/FeedDiscoveryScreen';
import {DiscoverLabelers} from './DiscoverLabelers';
import {DiscoverLists} from './DiscoverLists';

type DiscoverTab = 'feeds' | 'lists' | 'labelers';

export function DiscoverScreen() {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<DiscoverTab>('feeds');

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feeds' && styles.tabActive]}
          onPress={() => setActiveTab('feeds')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{selected: activeTab === 'feeds'}}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'feeds' && styles.tabTextActive,
            ]}>
            Feeds
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'lists' && styles.tabActive]}
          onPress={() => setActiveTab('lists')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{selected: activeTab === 'lists'}}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'lists' && styles.tabTextActive,
            ]}>
            Lists
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'labelers' && styles.tabActive]}
          onPress={() => setActiveTab('labelers')}
          activeOpacity={0.7}
          accessibilityRole="tab"
          accessibilityState={{selected: activeTab === 'labelers'}}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'labelers' && styles.tabTextActive,
            ]}>
            Labelers
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'feeds' && <FeedDiscoveryScreen embedded />}
      {activeTab === 'lists' && <DiscoverLists />}
      {activeTab === 'labelers' && <DiscoverLabelers />}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    tabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
      backgroundColor: colors.surface,
    },
    tab: {
      flex: 1,
      paddingVertical: 14,
      alignItems: 'center',
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: fontSize.callout,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primary,
    },
  });
}
