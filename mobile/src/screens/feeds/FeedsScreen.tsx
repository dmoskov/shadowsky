import { useNavigation } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { FeedDiscoveryScreen } from "./FeedDiscoveryScreen";
import { SavedFeedsScreen } from "./SavedFeedsScreen";
import {fontSize} from '../../utils/typography';

type FeedsTab = "myFeeds" | "discover";

export function FeedsScreen() {
  const [activeTab, setActiveTab] = useState<FeedsTab>("myFeeds");
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Clear header right button when switching to Discover tab
  // (SavedFeedsScreen sets its own headerRight for the Reorder button)
  useEffect(() => {
    if (activeTab === "discover") {
      navigation.setOptions({ headerRight: undefined });
    }
  }, [activeTab, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "myFeeds" && styles.tabActive]}
          onPress={() => setActiveTab("myFeeds")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "myFeeds" && styles.tabTextActive,
            ]}
          >
            My Feeds
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "discover" && styles.tabActive]}
          onPress={() => setActiveTab("discover")}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "discover" && styles.tabTextActive,
            ]}
          >
            Discover
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {activeTab === "myFeeds" ? (
          <SavedFeedsScreen />
        ) : (
          <FeedDiscoveryScreen embedded />
        )}
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    tabs: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    },
    tab: {
      flex: 1,
      paddingVertical: 14,
      alignItems: "center",
    },
    tabActive: {
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
    },
    tabText: {
      fontSize: fontSize.callout,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    tabTextActive: {
      color: colors.primary,
    },
    content: {
      flex: 1,
    },
  });
}
