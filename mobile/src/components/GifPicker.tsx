/**
 * GifPicker - GIF search and selection UI using Tenor
 *
 * Modal with search bar and grid of GIF previews
 * Uses Tenor API for GIF search and trending GIFs
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Image,
  ActivityIndicator,
  Dimensions,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SearchIcon, CloseIcon } from "./icons";
import type { TenorGif } from "../services/tenor";
import { getBestGifUrl } from "../services/tenor";
import { colors } from "../constants/theme";
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

const SCREEN_WIDTH = Dimensions.get("window").width;
const ITEM_WIDTH = (SCREEN_WIDTH - 48) / 2; // 2 columns with padding

export function GifPicker({
  visible,
  onSelectGif,
  onClose,
  gifs,
  loading,
  error,
  searchQuery,
  onSearch,
}: GifPickerProps) {
  const insets = useSafeAreaInsets();
  const searchInputRef = useRef<TextInput>(null);
  const [selectedGifId, setSelectedGifId] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
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
          resizeMode="cover"
        />
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <ActivityIndicator color="#ffffff" size="large" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <SearchIcon size={20} color="#6b7280" />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder="Search GIFs..."
          placeholderTextColor="#6b7280"
          value={localSearchQuery}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
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
            <CloseIcon size={24} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* GIF grid */}
        <FlatList
          data={gifs}
          renderItem={renderGifItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111116",
    borderWidth: 1,
    borderColor: "#1f2937",
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: "#ffffff",
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
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    marginBottom: 12,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#1f2937",
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
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center",
  },
  hintText: {
    color: "#6b7280",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
  noResultsText: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
  },
  trendingHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: "center",
  },
  trendingText: {
    color: "#9ca3af",
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
    color: "#6b7280",
    fontSize: 14,
    textAlign: "center",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    paddingHorizontal: 16,
    paddingTop: 12,
    alignItems: "center",
  },
  footerText: {
    color: "#6b7280",
    fontSize: 12,
    marginBottom: 4,
  },
  footerHint: {
    color: "#6b7280",
    fontSize: 10,
  },
});
