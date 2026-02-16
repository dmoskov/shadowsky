import React, { useState, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { AppBskyFeedDefs } from "@atproto/api";
import { useTheme } from "../contexts/ThemeContext";
import { triggerHaptic } from "../utils/haptics";

interface ThreadNavigatorProps {
  posts: AppBskyFeedDefs.FeedViewPost[];
  currentIndex?: number;
  onNavigate?: (index: number) => void;
}

/**
 * ThreadNavigator - Simple navigation helper for threads
 * Shows a mini-map of the thread structure with quick jump navigation
 */
export function ThreadNavigator({
  posts,
  currentIndex = 0,
  onNavigate,
}: ThreadNavigatorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isExpanded, setIsExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const toggleExpanded = () => {
    triggerHaptic("light");
    const toValue = isExpanded ? 0 : 1;

    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();

    setIsExpanded(!isExpanded);
  };

  const handleNavigate = (index: number) => {
    if (onNavigate) {
      triggerHaptic("light");
      onNavigate(index);
    }
  };

  if (posts.length <= 1) {
    return null;
  }

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [100, 0],
  });

  return (
    <View style={styles.container}>
      {/* Toggle button */}
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={toggleExpanded}
        activeOpacity={0.8}
      >
        <Text style={styles.toggleIcon}>{isExpanded ? "\u2715" : "\uD83D\uDDFA"}</Text>
        {!isExpanded && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{posts.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Navigator panel */}
      <Animated.View
        style={[
          styles.panel,
          {
            transform: [{ translateX }],
            opacity: slideAnim,
          },
        ]}
        pointerEvents={isExpanded ? "auto" : "none"}
      >
        <View style={styles.header}>
          <Text style={styles.headerText}>Thread Navigation</Text>
          <Text style={styles.headerSubtext}>{posts.length} posts</Text>
        </View>

        <View style={styles.postList}>
          {posts.map((post, index) => {
            const isCurrent = index === currentIndex;
            const author = post.post.author;

            return (
              <TouchableOpacity
                key={post.post.uri}
                style={[
                  styles.postItem,
                  isCurrent && styles.postItemCurrent,
                ]}
                onPress={() => handleNavigate(index)}
                activeOpacity={0.7}
              >
                <View style={styles.postItemContent}>
                  <Text
                    style={[
                      styles.postItemAuthor,
                      isCurrent && styles.postItemAuthorCurrent,
                    ]}
                    numberOfLines={1}
                  >
                    @{author.handle.split(".")[0]}
                  </Text>
                  {isCurrent && (
                    <View style={styles.currentIndicator}>
                      <Text style={styles.currentIndicatorText}>&bull;</Text>
                    </View>
                  )}
                </View>
                <View
                  style={[
                    styles.postItemDot,
                    isCurrent && styles.postItemDotCurrent,
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const { width } = Dimensions.get("window");

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      right: 16,
      bottom: 100,
      zIndex: 100,
    },
    toggleButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      elevation: 4,
      shadowColor: colors.borderDark,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    toggleIcon: {
      fontSize: 20,
    },
    badge: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: colors.danger,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    badgeText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: "bold",
    },
    panel: {
      position: "absolute",
      right: 0,
      bottom: 60,
      width: width * 0.6,
      maxHeight: 300,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      elevation: 8,
      shadowColor: colors.borderDark,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
    },
    header: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    headerText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    headerSubtext: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    postList: {
      maxHeight: 240,
      paddingVertical: 4,
    },
    postItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    postItemCurrent: {
      backgroundColor: "rgba(59, 130, 246, 0.2)",
    },
    postItemContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    postItemAuthor: {
      color: colors.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    postItemAuthorCurrent: {
      color: colors.text,
      fontWeight: "600",
    },
    currentIndicator: {
      marginLeft: 8,
    },
    currentIndicatorText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "bold",
    },
    postItemDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.borderLight,
    },
    postItemDotCurrent: {
      backgroundColor: colors.primary,
    },
  });
}
