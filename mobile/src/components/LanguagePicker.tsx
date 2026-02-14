import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { CloseIcon, CheckIcon } from './icons';
import {
  PINNED_LANGUAGES,
  ALL_LANGUAGES,
  Language,
  getLanguageDisplayName,
} from '../constants/languages';

interface LanguagePickerProps {
  visible: boolean;
  onClose: () => void;
  selectedLanguages: string[];
  onSelectLanguages: (langs: string[]) => void;
  multiSelect?: boolean;
}

export function LanguagePicker({
  visible,
  onClose,
  selectedLanguages,
  onSelectLanguages,
  multiSelect = true,
}: LanguagePickerProps) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter languages based on search query
  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) {
      return ALL_LANGUAGES;
    }

    const query = searchQuery.toLowerCase();
    return ALL_LANGUAGES.filter(
      (lang) =>
        lang.code.toLowerCase().includes(query) ||
        lang.name.toLowerCase().includes(query) ||
        lang.nativeName.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Get pinned languages that match search
  const pinnedLanguages = useMemo(() => {
    if (!searchQuery.trim()) {
      return PINNED_LANGUAGES;
    }

    const query = searchQuery.toLowerCase();
    return PINNED_LANGUAGES.filter(
      (lang) =>
        lang.code.toLowerCase().includes(query) ||
        lang.name.toLowerCase().includes(query) ||
        lang.nativeName.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Get other languages (excluding pinned ones)
  const otherLanguages = useMemo(() => {
    const pinnedCodes = new Set(PINNED_LANGUAGES.map((l) => l.code));
    return filteredLanguages.filter((lang) => !pinnedCodes.has(lang.code));
  }, [filteredLanguages]);

  const handleSelectLanguage = (code: string) => {
    if (multiSelect) {
      // Multi-select mode
      if (selectedLanguages.includes(code)) {
        // Remove language
        onSelectLanguages(selectedLanguages.filter((c) => c !== code));
      } else {
        // Add language
        onSelectLanguages([...selectedLanguages, code]);
      }
    } else {
      // Single-select mode
      onSelectLanguages([code]);
      onClose();
    }
  };

  const handleDone = () => {
    onClose();
  };

  const renderLanguageItem = ({ item }: { item: Language }) => {
    const isSelected = selectedLanguages.includes(item.code);

    return (
      <TouchableOpacity
        style={[styles.languageItem, isSelected && styles.languageItemSelected]}
        onPress={() => handleSelectLanguage(item.code)}
        activeOpacity={0.7}
      >
        <View style={styles.languageInfo}>
          <Text style={styles.languageName}>{item.name}</Text>
          <Text style={styles.languageNative}>{item.nativeName}</Text>
          <Text style={styles.languageCode}>{item.code.toUpperCase()}</Text>
        </View>
        {isSelected && (
          <View style={styles.checkIcon}>
            <CheckIcon size={20} color={colors.primary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {multiSelect ? 'Select Languages' : 'Select Language'}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <CloseIcon size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search languages..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Language list */}
        <FlatList
          data={[]}
          renderItem={null}
          ListHeaderComponent={
            <>
              {pinnedLanguages.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>Common Languages</Text>
                  {pinnedLanguages.map((lang) => (
                    <View key={`pinned-${lang.code}`}>
                      {renderLanguageItem({ item: lang })}
                    </View>
                  ))}
                </>
              )}
              {otherLanguages.length > 0 && (
                <>
                  <Text style={styles.sectionHeader}>All Languages</Text>
                  {otherLanguages.map((lang) => (
                    <View key={`other-${lang.code}`}>
                      {renderLanguageItem({ item: lang })}
                    </View>
                  ))}
                </>
              )}
              {filteredLanguages.length === 0 && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    No languages found matching "{searchQuery}"
                  </Text>
                </View>
              )}
            </>
          }
          keyExtractor={(item, index) => `list-${index}`}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 80 },
          ]}
        />

        {/* Footer with Done button (for multi-select) */}
        {multiSelect && (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <TouchableOpacity
              style={styles.doneButton}
              onPress={handleDone}
              activeOpacity={0.8}
            >
              <Text style={styles.doneButtonText}>
                Done
                {selectedLanguages.length > 0 &&
                  ` (${selectedLanguages.length})`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceElevated,
  },
  searchInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.surfaceElevated,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textTertiary,
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  languageItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  languageItemSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 2,
  },
  languageNative: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  languageCode: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  checkIcon: {
    marginLeft: 12,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceElevated,
    backgroundColor: colors.background,
  },
  doneButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  doneButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
