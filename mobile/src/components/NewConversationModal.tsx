import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
} from "react-native";
import { AppBskyActorDefs } from "@atproto/api";
import { searchActors } from "../services/atproto/profiles";
import { CloseIcon, SearchIcon } from "./icons";
import { useTheme } from "../contexts/ThemeContext";


import { createLogger } from '../utils/logger';

const logger = createLogger('Newconversationmodalx');
interface NewConversationModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectUser: (did: string) => void;
}

function NewConversationModalInner({
  visible,
  onClose,
  onSelectUser,
}: NewConversationModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    AppBskyActorDefs.ProfileView[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchActors(query.trim(), 20);
      setSearchResults(results);
    } catch (error) {
      logger.error('Failed to search users:', error);
      setSearchError("Failed to search users. Please try again.");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchError(null);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    debounceTimer.current = setTimeout(() => {
      performSearch(query);
    }, 250);
  }, [performSearch]);

  const handleSelectUser = (user: AppBskyActorDefs.ProfileView) => {
    onSelectUser(user.did);
    // Reset state
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
  };

  const handleClose = () => {
    // Reset state
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    onClose();
  };

  const renderUserItem = ({ item }: { item: AppBskyActorDefs.ProfileView }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleSelectUser(item)}
    >
      {item.avatar ? (
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {(item.displayName || item.handle || "U")[0].toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.userDetails}>
        <Text style={styles.displayName} numberOfLines={1}>
          {item.displayName || item.handle}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          @{item.handle}
        </Text>
        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (isSearching) {
      return null;
    }

    if (searchError) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>{searchError}</Text>
        </View>
      );
    }

    if (searchQuery.trim() && searchResults.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No users found</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <SearchIcon size={48} color={colors.textSecondary} />
        <Text style={styles.emptyText}>
          Search for a user to start a conversation
        </Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Message</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <CloseIcon size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <SearchIcon size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Search users..."
            placeholderTextColor={colors.textTertiary}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="search"
            enablesReturnKeyAutomatically
            accessibilityLabel="Search users"
            accessibilityHint="Type a name or handle to find users"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => handleSearch("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Clear search"
              accessibilityRole="button"
            >
              <CloseIcon size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results */}
        {isSearching ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyboardDismissMode="on-drag"
            renderItem={renderUserItem}
            keyExtractor={(item) => item.did}
            style={styles.resultsList}
            ListEmptyComponent={renderEmptyState}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>
    </Modal>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceAlt,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "bold",
    },
    closeButton: {
      padding: 4,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceAlt,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      margin: 16,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    resultsList: {
      flex: 1,
    },
    userItem: {
      flexDirection: "row",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceAlt,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },
    avatarPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surface,
      justifyContent: "center",
      alignItems: "center",
    },
    avatarText: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "600",
    },
    userDetails: {
      flex: 1,
      marginLeft: 12,
    },
    displayName: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    handle: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 2,
    },
    description: {
      color: colors.textSecondary,
      fontSize: 14,
      marginTop: 4,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: 16,
      textAlign: "center",
      marginTop: 12,
    },
    errorText: {
      color: colors.danger,
      fontSize: 16,
      textAlign: "center",
    },
  });
}

export const NewConversationModal = React.memo(NewConversationModalInner);
