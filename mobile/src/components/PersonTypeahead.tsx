import { AppBskyActorDefs } from "@atproto/api";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { useSearchActors } from "../hooks/api/useProfile";
import { Avatar } from "./Avatar";
import { CloseIcon } from "./icons";

interface PersonTypeaheadProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPerson: (handle: string) => void;
  placeholder?: string;
  maxSuggestions?: number;
}

export function PersonTypeahead({
  value,
  onChangeText,
  onSelectPerson,
  placeholder = "e.g. alice.bsky.social",
  maxSuggestions = 5,
}: PersonTypeaheadProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectingRef = useRef(false);

  const { data: actors, isLoading } = useSearchActors(query);

  // Debounce the search query
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    const cleaned = value.replace(/^@/, "");
    if (!cleaned || cleaned.length < 2) {
      setQuery("");
      return;
    }
    debounceTimer.current = setTimeout(() => {
      setQuery(cleaned);
    }, 200);
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [value]);

  const suggestions = useMemo(() => {
    if (!actors) return [];
    return actors.slice(0, maxSuggestions);
  }, [actors, maxSuggestions]);

  const handleSelect = (actor: AppBskyActorDefs.ProfileView) => {
    selectingRef.current = true;
    setShowSuggestions(false);
    setQuery("");
    onSelectPerson(actor.handle);
    // Reset selection flag after the event loop completes
    setTimeout(() => {
      selectingRef.current = false;
    }, 0);
  };

  const handleChangeText = (text: string) => {
    const cleaned = text.replace(/^@/, "");
    onChangeText(cleaned);
    setShowSuggestions(cleaned.length >= 2);
  };

  const handleClear = () => {
    onChangeText("");
    setShowSuggestions(false);
    setQuery("");
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={handleChangeText}
          onFocus={() => {
            if (value && value.length >= 2) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Delay hiding suggestions to allow tap events on suggestions
            // to fire before the list disappears. On iOS the keyboard
            // dismissal can race with touch handling, so we use a longer
            // delay and also guard against hiding during an active selection.
            setTimeout(() => {
              if (!selectingRef.current) {
                setShowSuggestions(false);
              }
            }, 300);
          }}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="search"
          keyboardType="default"
          accessibilityLabel="Search users"
          accessibilityHint="Type a name or handle to find users"
        />
        {value ? (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.clearButton}
          >
            <CloseIcon size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {showSuggestions && (suggestions.length > 0 || isLoading || (query.length >= 2 && !isLoading)) && (
        <ScrollView
          style={styles.suggestionsContainer}
          keyboardShouldPersistTaps="always"
          nestedScrollEnabled
          accessibilityRole="list"
          accessibilityLabel="User suggestions"
        >
          {isLoading && suggestions.length === 0 && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          )}
          {!isLoading && suggestions.length === 0 && query.length >= 2 && (
            <View style={styles.loadingRow}>
              <Text style={styles.loadingText}>No users found</Text>
            </View>
          )}
          {suggestions.map((actor) => (
            <TouchableOpacity
              key={actor.did}
              style={styles.suggestionRow}
              onPress={() => handleSelect(actor)}
              activeOpacity={0.7}
              accessibilityLabel={`${actor.displayName || actor.handle}, @${actor.handle}`}
              accessibilityRole="button"
            >
              <Avatar uri={actor.avatar} size={32} />
              <View style={styles.suggestionInfo}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {actor.displayName || actor.handle}
                </Text>
                <Text style={styles.handle} numberOfLines={1}>
                  @{actor.handle}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      zIndex: 10,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
      paddingRight: 8,
    },
    textInput: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.text,
    },
    clearButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    suggestionsContainer: {
      backgroundColor: colors.surface,
      borderRadius: 8,
      marginTop: 4,
      borderWidth: 1,
      borderColor: colors.surfaceElevated,
      overflow: "hidden",
      maxHeight: 250,
    },
    suggestionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceElevated,
    },
    suggestionInfo: {
      flex: 1,
    },
    displayName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    handle: {
      color: colors.textTertiary,
      fontSize: 12,
      marginTop: 1,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      gap: 8,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
  });
}
