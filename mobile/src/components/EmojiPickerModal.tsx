/**
 * EmojiPickerModal - Emoji search and selection UI
 *
 * Modal with categories, search bar, and grid of emojis
 * Uses rn-emoji-picker for emoji selection with recently used tracking
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmojiPicker from "rn-emoji-picker";
import { emojis } from "rn-emoji-picker/dist/data";
import type { Emoji } from "rn-emoji-picker/dist/interfaces";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CloseIcon } from "./icons";
import { useTheme } from "../contexts/ThemeContext";


import { createLogger } from '../utils/logger';

const logger = createLogger('Emojipickermodalx');
interface EmojiPickerModalProps {
  visible: boolean;
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

const RECENT_EMOJIS_KEY = "@shadowsky:recent_emojis";
const MAX_RECENT_EMOJIS = 30;

export function EmojiPickerModal({
  visible,
  onSelectEmoji,
  onClose,
}: EmojiPickerModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const [recentEmojis, setRecentEmojis] = useState<Emoji[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load recent emojis from storage
  useEffect(() => {
    if (visible) {
      loadRecentEmojis();
    }
  }, [visible]);

  const loadRecentEmojis = async () => {
    try {
      setIsLoading(true);
      const stored = await AsyncStorage.getItem(RECENT_EMOJIS_KEY);
      if (stored) {
        setRecentEmojis(JSON.parse(stored));
      }
    } catch (error) {
      logger.error('Failed to load recent emojis:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveRecentEmojis = async (newRecent: Emoji[]) => {
    try {
      await AsyncStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(newRecent));
    } catch (error) {
      logger.error('Failed to save recent emojis:', error);
    }
  };

  const handleSelectEmoji = (emoji: Emoji) => {
    // Add to recent emojis
    const updated = [emoji, ...recentEmojis.filter((e) => e.unified !== emoji.unified)].slice(
      0,
      MAX_RECENT_EMOJIS,
    );
    setRecentEmojis(updated);
    saveRecentEmojis(updated);

    // Notify parent with the actual emoji character
    onSelectEmoji(emoji.emoji);

    // Close modal
    onClose();
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
          <Text style={styles.headerTitle}>Select Emoji</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <CloseIcon size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Emoji Picker */}
        <View style={styles.pickerContainer}>
          <EmojiPicker
            emojis={emojis}
            recent={recentEmojis}
            autoFocus={false}
            loading={isLoading}
            darkMode={isDarkMode}
            perLine={8}
            onSelect={handleSelectEmoji}
          />
        </View>

        {/* Footer */}
        <View
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <Text style={styles.footerText}>
            Tap an emoji to insert it into your post
          </Text>
        </View>
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
      padding: 4,
    },
    pickerContainer: {
      flex: 1,
      backgroundColor: colors.background,
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
      textAlign: "center",
    },
  });
}
