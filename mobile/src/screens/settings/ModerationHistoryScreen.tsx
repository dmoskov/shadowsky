import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useModeration } from "../../contexts/ModerationContext";
import { ChevronLeft } from "lucide-react-native";

interface ModerationHistoryScreenProps {
  navigation: {
    goBack: () => void;
  };
}

type TabType = "all" | "blocks" | "mutes" | "reports";

const TABS: Array<{ key: TabType; label: string }> = [
  { key: "all", label: "All" },
  { key: "blocks", label: "Blocks" },
  { key: "mutes", label: "Mutes" },
  { key: "reports", label: "Reports" },
];

export function ModerationHistoryScreen({
  navigation,
}: ModerationHistoryScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const _moderation = useModeration();
  const [activeTab, setActiveTab] = useState<TabType>("all");

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Moderation History</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          View and manage your moderation actions
        </Text>

        <View style={styles.tabsRow}>
          {TABS.map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  isSelected
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.surface },
                ]}
                onPress={() => setActiveTab(tab.key)}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isSelected }}
              >
                <Text
                  style={[
                    styles.tabText,
                    isSelected
                      ? { color: "#ffffff" }
                      : { color: colors.textSecondary },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Blocked</Text>
            <Text style={styles.statCount}>0</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Muted</Text>
            <Text style={styles.statCount}>0</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Reports</Text>
            <Text style={styles.statCount}>0</Text>
          </View>
        </View>

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
            can't see your posts or interact with you. Muted users' posts are
            hidden from your feeds.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
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
      fontWeight: "600",
      color: colors.text,
      flex: 1,
      textAlign: "center",
    },
    headerSpacer: {
      width: 60,
    },
    container: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    tabsRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 24,
    },
    tab: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      alignItems: "center",
    },
    tabText: {
      fontSize: 13,
      fontWeight: "600",
    },
    statsRow: {
      flexDirection: "row",
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
      fontWeight: "700",
      color: colors.text,
    },
    emptyContainer: {
      alignItems: "center",
      paddingVertical: 48,
      paddingHorizontal: 32,
    },
    emptyIconPlaceholder: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    emptyIcon: {
      fontSize: 24,
      color: colors.textSecondary,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
      textAlign: "center",
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
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
  });
}
