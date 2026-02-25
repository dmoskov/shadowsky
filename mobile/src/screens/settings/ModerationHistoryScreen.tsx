import React, {useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  RefreshControl,
} from 'react-native';
import {useTheme} from '../../contexts/ThemeContext';
import { ChevronLeftIcon, BanIcon, VolumeXIcon, FlagIcon, TrashIcon } from '../../../components/icons';
import {formatDistanceToNow} from 'date-fns';
import {
  getAllEntries,
  getStats,
  clearAll,
  ModerationHistoryEntry,
  ModerationActionType,
  ModerationHistoryStats,
} from '../../services/moderation-history';

interface ModerationHistoryScreenProps {
  navigation: {
    goBack: () => void;
  };
}

type TabType = 'all' | 'blocks' | 'mutes' | 'reports';

const TABS: Array<{key: TabType; label: string}> = [
  {key: 'all', label: 'All'},
  {key: 'blocks', label: 'Blocks'},
  {key: 'mutes', label: 'Mutes'},
  {key: 'reports', label: 'Reports'},
];

const TAB_TO_FILTER: Record<TabType, ModerationActionType | undefined> = {
  all: undefined,
  blocks: 'block',
  mutes: 'mute',
  reports: 'report',
};

export function ModerationHistoryScreen({
  navigation,
}: ModerationHistoryScreenProps) {
  const {colors} = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Read data synchronously from MMKV (fast, no async needed)
  const entries = useMemo(
    () => getAllEntries(TAB_TO_FILTER[activeTab]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab, refreshKey],
  );

  const stats: ModerationHistoryStats = useMemo(
    () => getStats(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [refreshKey],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setRefreshing(false);
  }, []);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear Moderation History',
      'This will permanently delete all moderation history records. This action cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            clearAll();
            setRefreshKey((k) => k + 1);
          },
        },
      ],
    );
  }, []);

  const hasEntries = entries.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <ChevronLeftIcon size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moderation History</Text>
        {hasEntries ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearAll}
            accessibilityRole="button"
            accessibilityLabel="Clear all history">
            <TrashIcon size={20} color={colors.danger} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  isSelected
                    ? {backgroundColor: colors.primary}
                    : {backgroundColor: colors.surface},
                ]}
                onPress={() => setActiveTab(tab.key)}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityState={{selected: isSelected}}>
                <Text
                  style={[
                    styles.tabText,
                    isSelected
                      ? {color: '#ffffff'}
                      : {color: colors.textSecondary},
                  ]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Blocked</Text>
            <Text style={styles.statCount}>{stats.activeBlocks}</Text>
            {stats.totalBlocks > stats.activeBlocks && (
              <Text style={styles.statSub}>{stats.totalBlocks} total</Text>
            )}
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Muted</Text>
            <Text style={styles.statCount}>{stats.activeMutes}</Text>
            {stats.totalMutes > stats.activeMutes && (
              <Text style={styles.statSub}>{stats.totalMutes} total</Text>
            )}
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Reports</Text>
            <Text style={styles.statCount}>{stats.totalReports}</Text>
            {stats.pendingReports > 0 && (
              <Text style={styles.statSub}>
                {stats.pendingReports} pending
              </Text>
            )}
          </View>
        </View>

        {!hasEntries ? (
          <>
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconPlaceholder}>
                <Text style={styles.emptyIcon}>---</Text>
              </View>
              <Text style={styles.emptyTitle}>No moderation history yet</Text>
              <Text style={styles.emptySubtext}>
                Your block, mute, and report actions will appear here
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Moderation actions help keep your experience safe. Blocked users
                can't see your posts or interact with you. Muted users' posts
                are hidden from your feeds.
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.entriesList}>
            {entries.map((entry) => (
              <HistoryEntryRow
                key={entry.id}
                entry={entry}
                colors={colors}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HistoryEntryRow({
  entry,
  colors,
}: {
  entry: ModerationHistoryEntry;
  colors: any;
}) {
  const styles = useMemo(() => createEntryStyles(colors), [colors]);

  const timeAgo = formatDistanceToNow(new Date(entry.createdAt), {
    addSuffix: true,
  });

  if (entry.type === 'block') {
    const isActive = entry.isActive;
    return (
      <View style={styles.row}>
        <View style={[styles.iconContainer, {backgroundColor: '#fee2e2'}]}>
          <BanIcon size={16} color="#dc2626" />
        </View>
        <View style={styles.entryContent}>
          <View style={styles.entryHeader}>
            <Text style={styles.entryAction}>
              {isActive ? 'Blocked' : 'Blocked (unblocked)'}
            </Text>
            <Text style={styles.entryTime}>{timeAgo}</Text>
          </View>
          <Text style={styles.entryTarget} numberOfLines={1}>
            {entry.subjectDisplayName || entry.subjectHandle || entry.subjectDid}
          </Text>
          {entry.subjectHandle && entry.subjectDisplayName && (
            <Text style={styles.entryHandle}>@{entry.subjectHandle}</Text>
          )}
          {!isActive && entry.unblockedAt && (
            <Text style={styles.entryMeta}>
              Unblocked{' '}
              {formatDistanceToNow(new Date(entry.unblockedAt), {
                addSuffix: true,
              })}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            isActive ? styles.statusActive : styles.statusInactive,
          ]}>
          <Text
            style={[
              styles.statusText,
              isActive ? styles.statusTextActive : styles.statusTextInactive,
            ]}>
            {isActive ? 'Active' : 'Unblocked'}
          </Text>
        </View>
      </View>
    );
  }

  if (entry.type === 'mute') {
    const isActive = entry.isActive;
    return (
      <View style={styles.row}>
        <View style={[styles.iconContainer, {backgroundColor: '#fef3c7'}]}>
          <VolumeXIcon size={16} color="#d97706" />
        </View>
        <View style={styles.entryContent}>
          <View style={styles.entryHeader}>
            <Text style={styles.entryAction}>
              {isActive ? 'Muted' : 'Muted (unmuted)'}
            </Text>
            <Text style={styles.entryTime}>{timeAgo}</Text>
          </View>
          <Text style={styles.entryTarget} numberOfLines={1}>
            {entry.subjectDisplayName || entry.subjectHandle || entry.subjectDid}
          </Text>
          {entry.subjectHandle && entry.subjectDisplayName && (
            <Text style={styles.entryHandle}>@{entry.subjectHandle}</Text>
          )}
          {!isActive && entry.unmutedAt && (
            <Text style={styles.entryMeta}>
              Unmuted{' '}
              {formatDistanceToNow(new Date(entry.unmutedAt), {
                addSuffix: true,
              })}
            </Text>
          )}
        </View>
        <View
          style={[
            styles.statusBadge,
            isActive ? styles.statusActive : styles.statusInactive,
          ]}>
          <Text
            style={[
              styles.statusText,
              isActive ? styles.statusTextActive : styles.statusTextInactive,
            ]}>
            {isActive ? 'Active' : 'Unmuted'}
          </Text>
        </View>
      </View>
    );
  }

  // Report
  return (
    <View style={styles.row}>
      <View style={[styles.iconContainer, {backgroundColor: '#dbeafe'}]}>
        <FlagIcon size={16} color="#2563eb" />
      </View>
      <View style={styles.entryContent}>
        <View style={styles.entryHeader}>
          <Text style={styles.entryAction}>
            Reported {entry.subjectType}
          </Text>
          <Text style={styles.entryTime}>{timeAgo}</Text>
        </View>
        <Text style={styles.entryTarget} numberOfLines={1}>
          {entry.subjectDisplayName ||
            entry.subjectHandle ||
            entry.subjectDid ||
            entry.subjectUri}
        </Text>
        {entry.subjectHandle && entry.subjectDisplayName && (
          <Text style={styles.entryHandle}>@{entry.subjectHandle}</Text>
        )}
        <Text style={styles.entryMeta}>Reason: {entry.reason}</Text>
      </View>
      <View style={[styles.statusBadge, styles.statusPending]}>
        <Text style={[styles.statusText, styles.statusTextPending]}>
          {entry.status}
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    backButton: {
      padding: 4,
      width: 60,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 60,
    },
    clearButton: {
      padding: 4,
      width: 60,
      alignItems: 'flex-end',
    },
    container: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    tabsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    tabText: {
      fontSize: 13,
      fontWeight: '600',
    },
    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 10,
      padding: 12,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    statCount: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
    statSub: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 2,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 48,
      paddingHorizontal: 32,
    },
    emptyIconPlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    emptyIcon: {
      fontSize: 24,
      color: colors.textSecondary,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
    infoBox: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    entriesList: {
      gap: 1,
    },
  });
}

function createEntryStyles(colors: any) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
      marginTop: 2,
    },
    entryContent: {
      flex: 1,
      marginRight: 8,
    },
    entryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 2,
    },
    entryAction: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    entryTime: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    entryTarget: {
      fontSize: 14,
      color: colors.text,
      marginBottom: 1,
    },
    entryHandle: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 2,
    },
    entryMeta: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      marginTop: 2,
    },
    statusActive: {
      backgroundColor: '#dcfce7',
    },
    statusInactive: {
      backgroundColor: '#f3f4f6',
    },
    statusPending: {
      backgroundColor: '#dbeafe',
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
    },
    statusTextActive: {
      color: '#16a34a',
    },
    statusTextInactive: {
      color: '#6b7280',
    },
    statusTextPending: {
      color: '#2563eb',
    },
  });
}
