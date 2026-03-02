/**
 * GifPicker - GIF search and selection UI using Tenor
 *
 * Modal with search bar and grid of GIF previews
 * Uses Tenor API for GIF search and trending GIFs
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchIcon, CloseIcon } from "./icons";
import type { TenorGif } from "../services/tenor";
import { getBestGifUrl } from "../services/tenor";
import { useTheme } from "../contexts/ThemeContext";
import Constants from "expo-constants";

interface GifPickerProps {
  visible: boolean;
  onSelectGif: (gif: TenorGif) => void;
  onClose: () => void;
  gifs: TenorGif[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSearch: (query: string) => void;
}

function GifPickerInner({
  visible,
  onSelectGif,
  onClose,
  gifs,
  loading,
  error,
  searchQuery,
  onSearch,
}: GifPickerProps) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const itemWidth = (screenWidth - 48) / 2; // 2 columns with padding
  const styles = useMemo(() => createStyles(colors, itemWidth), [colors, itemWidth]);
  const insets = useSafeAreaInsets();
  const searchInputRef = useRef<TextInput>(null);
  const [selectedGifId, setSelectedGifId] = useState<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Focus search input when modal opens
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearchQuery(value);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce search by 500ms
      debounceTimerRef.current = setTimeout(() => {
        onSearch(value);
      }, 500);
    },
    [onSearch],
  );

  const handleSelectGif = useCallback(
    (gif: TenorGif) => {
      setSelectedGifId(gif.id);
      onSelectGif(gif);
      // Don't close immediately - let parent handle it
      setTimeout(() => {
        onClose();
        setSelectedGifId(null);
      }, 300);
    },
    [onSelectGif, onClose],
  );

  const hasApiKey = !!Constants.expoConfig?.extra?.tenorApiKey;

  const renderGifItem = ({ item }: { item: TenorGif }) => {
    const gifUrl = getBestGifUrl(item);
    const isSelected = selectedGifId === item.id;

    return (
      <TouchableOpacity
        style={styles.gifItem}
        onPress={() => handleSelectGif(item)}
        disabled={selectedGifId !== null}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: gifUrl }}
          style={styles.gifImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={gifUrl}
        />
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <ActivityIndicator color={colors.text} size="large" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <SearchIcon size={20} color={colors.textTertiary} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search GIFs..."
          placeholderTextColor={colors.textTertiary}
          value={localSearchQuery}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="search"
          accessibilityLabel="Search GIFs"
        />
        {localSearchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setLocalSearchQuery("");
              onSearch("");
              if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
              }
            }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
            accessibilityLabel="Clear search"
            accessibilityRole="button"
          >
            <CloseIcon size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Error message */}
      {!hasApiKey && (
        <View style={styles.messageContainer}>
          <Text style={styles.errorText}>
            Tenor API key not configured. Add it to your app.config.js file.
          </Text>
          <Text style={styles.hintText}>
            Get a free API key at developers.google.com/tenor
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.messageContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* No results message */}
      {!loading && !error && gifs.length === 0 && searchQuery && (
        <View style={styles.messageContainer}>
          <Text style={styles.noResultsText}>
            No GIFs found for "{searchQuery}"
          </Text>
        </View>
      )}

      {/* Trending header */}
      {!loading && !error && gifs.length > 0 && !searchQuery && (
        <View style={styles.trendingHeader}>
          <Text style={styles.trendingText}>Trending GIFs</Text>
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      );
    }
    return null;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Search GIFs</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <CloseIcon size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* GIF grid */}
        <FlatList
          data={gifs}
          keyboardDismissMode="on-drag"
          renderItem={renderGifItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          removeClippedSubviews={true}
          windowSize={5}
          maxToRenderPerBatch={8}
          initialNumToRender={8}
          updateCellsBatchingPeriod={50}
          ListEmptyComponent={
            !loading && !error && !searchQuery ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  Start typing to search for GIFs
                </Text>
              </View>
            ) : null
          }
        />

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Text style={styles.footerText}>Powered by Tenor</Text>
          <Text style={styles.footerHint}>
            GIFs will be attached as animated images
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: any, itemWidth: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "600",
    },
    closeButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.surfaceElevated,
      borderRadius: 8,
      marginHorizontal: 16,
      marginVertical: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      marginLeft: 8,
    },
    listContent: {
      paddingBottom: 16,
    },
    row: {
      paddingHorizontal: 16,
      justifyContent: "space-between",
    },
    gifItem: {
      width: itemWidth,
      height: itemWidth,
      marginBottom: 12,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: colors.surfaceElevated,
    },
    gifImage: {
      width: "100%",
      height: "100%",
    },
    selectedOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    messageContainer: {
      paddingHorizontal: 16,
      paddingVertical: 24,
      alignItems: "center",
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
      textAlign: "center",
    },
    hintText: {
      color: colors.textTertiary,
      fontSize: 12,
      textAlign: "center",
      marginTop: 8,
    },
    noResultsText: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
    },
    trendingHeader: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      alignItems: "center",
    },
    trendingText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    loadingContainer: {
      paddingVertical: 24,
      alignItems: "center",
    },
    emptyContainer: {
      paddingVertical: 48,
      paddingHorizontal: 16,
      alignItems: "center",
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: 14,
      textAlign: "center",
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.surfaceElevated,
      paddingHorizontal: 16,
      paddingTop: 12,
      alignItems: "center",
    },
    footerText: {
      color: colors.textTertiary,
      fontSize: 12,
      marginBottom: 4,
    },
    footerHint: {
      color: colors.textTertiary,
      fontSize: 10,
    },
  });
}

export const GifPicker = React.memo(GifPickerInner, (prevProps, nextProps) => {
  if (prevProps.visible !== nextProps.visible) return false;
  if (prevProps.loading !== nextProps.loading) return false;
  if (prevProps.error !== nextProps.error) return false;
  if (prevProps.searchQuery !== nextProps.searchQuery) return false;
  if (prevProps.onSelectGif !== nextProps.onSelectGif) return false;
  if (prevProps.onClose !== nextProps.onClose) return false;
  if (prevProps.onSearch !== nextProps.onSearch) return false;
  if (prevProps.gifs !== nextProps.gifs) {
    if (prevProps.gifs.length !== nextProps.gifs.length) return false;
    for (let i = 0; i < prevProps.gifs.length; i++) {
      if (prevProps.gifs[i].id !== nextProps.gifs[i].id) return false;
    }
  }
  return true;
});
