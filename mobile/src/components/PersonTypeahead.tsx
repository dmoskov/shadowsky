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
import {fontSize} from '../utils/typography';

interface PersonTypeaheadProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPerson: (handle: string) => void;
  placeholder?: string;
  maxSuggestions?: number;
  /** Called when suggestions become visible — parent can scroll to this component */
  onSuggestionsVisible?: () => void;
}

export function PersonTypeahead({
  value,
  onChangeText,
  onSelectPerson,
  placeholder = "e.g. alice.bsky.social",
  maxSuggestions = 5,
  onSuggestionsVisible,
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
    const shouldShow = cleaned.length >= 2;
    setShowSuggestions(shouldShow);
    if (shouldShow) onSuggestionsVisible?.();
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
            // Delay hiding suggestions — on iOS, KAV layout changes and
            // suggestion taps can both trigger blur events. Use a longer
            // delay and check that we're not mid-selection AND that the
            // input doesn't still have text worth showing suggestions for.
            setTimeout(() => {
              if (!selectingRef.current) {
                setShowSuggestions(false);
              }
            }, 500);
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
      fontSize: fontSize.subheadline,
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
      maxHeight: 200,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
      overflow: "hidden",
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
      fontSize: fontSize.subheadline,
      fontWeight: "600",
    },
    handle: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
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
      fontSize: fontSize.footnote,
    },
  });
}
