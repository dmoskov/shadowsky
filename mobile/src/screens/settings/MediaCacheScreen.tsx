import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { ChevronLeft } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface MediaCacheScreenProps {
  navigation: {
    goBack: () => void;
  };
}

export function MediaCacheScreen({ navigation }: MediaCacheScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [cacheSize, setCacheSize] = useState("Calculating...");
  const [isLoading, setIsLoading] = useState(false);
  const [cacheSizeBytes, setCacheSizeBytes] = useState(0);

  useEffect(() => {
    calculateCacheSize();
  }, []);

  const calculateCacheSize = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }

      setCacheSizeBytes(totalSize);

      if (totalSize < 1024) {
        setCacheSize(`${totalSize} B`);
      } else if (totalSize < 1024 * 1024) {
        setCacheSize(`${(totalSize / 1024).toFixed(2)} KB`);
      } else {
        setCacheSize(`${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
      }
    } catch {
      setCacheSize("Unknown");
    }
  };

  const cacheUsagePercent = Math.min(
    (cacheSizeBytes / (50 * 1024 * 1024)) * 100,
    100,
  );

  const handleClearImageCache = () => {
    Alert.alert(
      "Clear Image Cache",
      "Are you sure you want to remove all cached images and thumbnails?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              const keys = await AsyncStorage.getAllKeys();
              const imageKeys = keys.filter(
                (key) =>
                  key.includes("image") ||
                  key.includes("thumbnail") ||
                  key.includes("avatar"),
              );
              if (imageKeys.length > 0) {
                await AsyncStorage.multiRemove(imageKeys);
              }
              await calculateCacheSize();
              Alert.alert("Success", "Image cache cleared successfully.");
            } catch {
              Alert.alert("Error", "Failed to clear image cache.");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleClearVideoCache = () => {
    Alert.alert(
      "Clear Video Cache",
      "Are you sure you want to remove all cached video data?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              const keys = await AsyncStorage.getAllKeys();
              const videoKeys = keys.filter(
                (key) =>
                  key.includes("video") || key.includes("media_playback"),
              );
              if (videoKeys.length > 0) {
                await AsyncStorage.multiRemove(videoKeys);
              }
              await calculateCacheSize();
              Alert.alert("Success", "Video cache cleared successfully.");
            } catch {
              Alert.alert("Error", "Failed to clear video cache.");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleClearAllCache = () => {
    Alert.alert(
      "Clear All Cache",
      "Are you sure you want to remove all cached media? This will not delete your posts or bookmarks.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter(
                (key) =>
                  key.includes("image") ||
                  key.includes("thumbnail") ||
                  key.includes("avatar") ||
                  key.includes("video") ||
                  key.includes("media") ||
                  key.includes("cache"),
              );
              if (cacheKeys.length > 0) {
                await AsyncStorage.multiRemove(cacheKeys);
              }
              await calculateCacheSize();
              Alert.alert("Success", "All cached media cleared successfully.");
            } catch {
              Alert.alert("Error", "Failed to clear cache.");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

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
        <Text style={styles.headerTitle}>Media Cache</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Manage cached media files to free up storage space
        </Text>

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cache Usage</Text>

          <View style={styles.card}>
            <View style={styles.cacheRow}>
              <Text style={styles.cardTitle}>Cache Size</Text>
              <Text style={styles.cacheValue}>{cacheSize}</Text>
            </View>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${cacheUsagePercent}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Clear Cache</Text>

          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Clear Image Cache</Text>
              <Text style={styles.cardDescription}>
                Remove cached images and thumbnails
              </Text>
            </View>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearImageCache}
              disabled={isLoading}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Clear Video Cache</Text>
              <Text style={styles.cardDescription}>
                Remove cached video data
              </Text>
            </View>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearVideoCache}
              disabled={isLoading}
            >
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dangerCard}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Clear All Cache</Text>
              <Text style={styles.cardDescription}>
                Remove all cached media
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={handleClearAllCache}
              disabled={isLoading}
            >
              <Text style={styles.dangerButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cache Settings</Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Cached media helps load content faster but uses device storage.
              Clearing cache won't delete your posts or bookmarks.
            </Text>
          </View>
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
    loadingOverlay: {
      alignItems: "center",
      marginBottom: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
    },
    dangerCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: colors.danger,
    },
    cardInfo: {
      flex: 1,
      marginRight: 12,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    cardDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    cacheRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      marginBottom: 12,
    },
    cacheValue: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.primary,
    },
    progressBarBackground: {
      width: "100%",
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.border,
      overflow: "hidden",
    },
    progressBarFill: {
      height: 8,
      borderRadius: 4,
    },
    clearButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
    },
    clearButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.primary,
    },
    dangerButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.danger,
    },
    dangerButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#ffffff",
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
