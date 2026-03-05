import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import { usePreferences } from "../../contexts/PreferencesContext";
import { MutedWord } from "../../services/preferences";
import { calculateExpirationTime, getActiveMutedWords } from "../../utils/content-filter";
import { useTheme } from "../../contexts/ThemeContext";
import { BlurOverlay } from "../../components/BlurOverlay";
import { triggerHaptic } from "../../utils/haptics";
import {fontSize} from '../../utils/typography';

export function MutedWordsScreen() {
  const { colors } = useTheme();
  const {
    preferences,
    updatePreference,
    addMutedWord,
    removeMutedWord,
    syncingMutedWords,
  } = usePreferences();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWord, setNewWord] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<MutedWord["duration"]>("forever");
  const [selectedAppliesTo, setSelectedAppliesTo] = useState<MutedWord["appliesTo"]>("all");
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Clean up expired muted words on mount
  useEffect(() => {
    if (preferences?.mutedWords) {
      const activeMutedWords = getActiveMutedWords(preferences.mutedWords);
      if (activeMutedWords.length !== preferences.mutedWords.length) {
        updatePreference("mutedWords", activeMutedWords);
      }
    }
  }, []);

  const mutedWords = preferences?.mutedWords || [];

  const handleAddWord = async () => {
    const trimmedWord = newWord.trim();

    if (!trimmedWord) {
      Alert.alert("Error", "Please enter a word or phrase to mute");
      return;
    }

    // Check for duplicates
    const exists = mutedWords.some(
      (word) => word.value.toLowerCase() === trimmedWord.toLowerCase(),
    );

    if (exists) {
      Alert.alert("Error", "This word or phrase is already muted");
      return;
    }

    const newMutedWord: MutedWord = {
      id: Date.now().toString(),
      value: trimmedWord,
      duration: selectedDuration,
      expiresAt: calculateExpirationTime(selectedDuration),
      appliesTo: selectedAppliesTo,
    };

    await addMutedWord(newMutedWord);

    triggerHaptic("success");
    setNewWord("");
    setSelectedDuration("forever");
    setSelectedAppliesTo("all");
    setShowAddModal(false);
  };

  const handleDeleteWord = (wordId: string) => {
    const word = mutedWords.find((w) => w.id === wordId);
    if (!word) return;

    Alert.alert("Remove Muted Word", `Remove "${word.value}" from muted words?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await removeMutedWord(wordId);
          triggerHaptic("success");
        },
      },
    ]);
  };

  const getDurationLabel = (duration?: MutedWord["duration"]) => {
    switch (duration) {
      case "24h":
        return "24 hours";
      case "7d":
        return "7 days";
      case "30d":
        return "30 days";
      case "forever":
      default:
        return "Forever";
    }
  };

  const getAppliesToLabel = (appliesTo?: MutedWord["appliesTo"]) => {
    return appliesTo === "home" ? "Home feed only" : "All feeds";
  };

  const getExpirationText = (word: MutedWord) => {
    if (!word.expiresAt || word.duration === "forever") {
      return null;
    }

    const now = Date.now();
    const remaining = word.expiresAt - now;

    if (remaining <= 0) {
      return "Expired";
    }

    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `Expires in ${days} day${days !== 1 ? "s" : ""}`;
    } else if (hours > 0) {
      return `Expires in ${hours} hour${hours !== 1 ? "s" : ""}`;
    } else {
      return "Expires soon";
    }
  };

  const renderMutedWord = ({ item }: { item: MutedWord }) => {
    const expirationText = getExpirationText(item);

    return (
      <View style={styles.wordItem}>
        <View style={styles.wordInfo}>
          <Text style={styles.wordValue}>{item.value}</Text>
          <View style={styles.wordMeta}>
            <Text style={styles.wordMetaText}>
              {getDurationLabel(item.duration)} • {getAppliesToLabel(item.appliesTo)}
            </Text>
            {expirationText && (
              <Text style={styles.expirationText}>{expirationText}</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteWord(item.id)}
        >
          <Text style={styles.deleteButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No muted words</Text>
      <Text style={styles.emptySubtext}>
        Add words or phrases to hide posts containing them from your feed.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Muted Words</Text>
          {syncingMutedWords && (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
        </View>
        <Text style={styles.headerDescription}>
          Posts containing these words will be hidden from your feeds.
          Synced across all your Bluesky clients.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setShowAddModal(true)}
      >
        <Text style={styles.addButtonText}>+ Add Muted Word</Text>
      </TouchableOpacity>

      <FlatList
        data={mutedWords}
        keyboardDismissMode="on-drag"
        renderItem={renderMutedWord}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={mutedWords.length === 0 ? styles.emptyList : undefined}
      />

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurOverlay intensity={25} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Muted Word</Text>

            <Text style={styles.inputLabel}>Word or phrase</Text>
            <TextInput
              style={styles.input}
              value={newWord}
              onChangeText={setNewWord}
              placeholder="Enter word, phrase, or #hashtag"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>Duration</Text>
            <View style={styles.optionGroup}>
              {(["forever", "24h", "7d", "30d"] as const).map((duration) => (
                <TouchableOpacity
                  key={duration}
                  style={[
                    styles.optionButton,
                    selectedDuration === duration && styles.optionButtonActive,
                  ]}
                  onPress={() => setSelectedDuration(duration)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      selectedDuration === duration && styles.optionButtonTextActive,
                    ]}
                  >
                    {getDurationLabel(duration)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Apply to</Text>
            <View style={styles.optionGroup}>
              {(["all", "home"] as const).map((appliesTo) => (
                <TouchableOpacity
                  key={appliesTo}
                  style={[
                    styles.optionButton,
                    selectedAppliesTo === appliesTo && styles.optionButtonActive,
                  ]}
                  onPress={() => setSelectedAppliesTo(appliesTo)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      selectedAppliesTo === appliesTo && styles.optionButtonTextActive,
                    ]}
                  >
                    {getAppliesToLabel(appliesTo)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowAddModal(false);
                  setNewWord("");
                  setSelectedDuration("forever");
                  setSelectedAppliesTo("all");
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleAddWord}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  Add
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontSize.title2,
    fontWeight: "bold",
  },
  headerDescription: {
    color: colors.textSecondary,
    fontSize: fontSize.subheadline,
  },
  addButton: {
    margin: 16,
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: "center",
  },
  addButtonText: {
    color: colors.text,
    fontSize: fontSize.callout,
    fontWeight: "600",
  },
  wordItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  wordInfo: {
    flex: 1,
    marginRight: 12,
  },
  wordValue: {
    color: colors.text,
    fontSize: fontSize.callout,
    fontWeight: "600",
    marginBottom: 4,
  },
  wordMeta: {
    gap: 4,
  },
  wordMetaText: {
    color: colors.textSecondary,
    fontSize: fontSize.footnote,
  },
  expirationText: {
    color: colors.textTertiary,
    fontSize: fontSize.caption1,
    fontStyle: "italic",
  },
  deleteButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.danger,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: fontSize.subheadline,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyText: {
    color: colors.text,
    fontSize: fontSize.headline,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtext: {
    color: colors.textSecondary,
    fontSize: fontSize.subheadline,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyList: {
    flexGrow: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontSize.title3,
    fontWeight: "bold",
    marginBottom: 20,
  },
  inputLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.subheadline,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.borderLight,
    color: colors.text,
    borderRadius: 8,
    padding: 12,
    fontSize: fontSize.callout,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  optionGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  optionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.subheadline,
    fontWeight: "500",
  },
  optionButtonTextActive: {
    color: colors.text,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.callout,
    fontWeight: "600",
  },
  modalButtonTextPrimary: {
    color: colors.text,
  },
  });
}
