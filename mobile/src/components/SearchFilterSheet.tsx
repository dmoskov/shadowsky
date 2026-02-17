import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { LanguagePicker } from './LanguagePicker';
import {
  CalendarIcon,
  CloseIcon,
  GlobeIcon,
  SearchIcon,
} from './icons';
import { PINNED_LANGUAGES } from '../constants/languages';

type MediaFilter = 'all' | 'images' | 'videos' | 'links';
type DatePreset = '24h' | '7d' | '30d' | '1y' | 'all';

export interface SearchFilterValues {
  sort: 'top' | 'latest';
  since?: string;
  until?: string;
  lang?: string;
  author?: string;
  domain?: string;
  mediaFilter?: MediaFilter;
}

interface SearchFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: SearchFilterValues;
  onApplyFilters: (filters: SearchFilterValues) => void;
}

function getDatePreset(since?: string): DatePreset {
  if (!since) return 'all';
  const sinceTime = new Date(since).getTime();
  const now = Date.now();
  const diff = now - sinceTime;
  const hour = 60 * 60 * 1000;
  if (diff <= 25 * hour) return '24h';
  if (diff <= 8 * 24 * hour) return '7d';
  if (diff <= 31 * 24 * hour) return '30d';
  if (diff <= 366 * 24 * hour) return '1y';
  return 'all';
}

function getLanguageName(code: string): string {
  const lang = PINNED_LANGUAGES.find((l) => l.code === code);
  return lang ? lang.name : code.toUpperCase();
}

export function SearchFilterSheet({
  visible,
  onClose,
  filters,
  onApplyFilters,
}: SearchFilterSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<SearchFilterValues>(filters);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Sync draft when modal opens
  React.useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
  }, [visible, filters]);

  const updateDraft = useCallback(
    (updates: Partial<SearchFilterValues>) => {
      setDraft((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  const handleApply = useCallback(() => {
    onApplyFilters(draft);
    onClose();
  }, [draft, onApplyFilters, onClose]);

  const handleReset = useCallback(() => {
    const reset: SearchFilterValues = {
      sort: 'top',
      mediaFilter: 'all',
      since: undefined,
      until: undefined,
      lang: undefined,
      author: undefined,
      domain: undefined,
    };
    setDraft(reset);
  }, []);

  const setDatePreset = useCallback(
    (preset: DatePreset) => {
      if (preset === 'all') {
        updateDraft({ since: undefined, until: undefined });
        return;
      }
      const now = Date.now();
      const msMap: Record<string, number> = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
        '1y': 365 * 24 * 60 * 60 * 1000,
      };
      updateDraft({
        since: new Date(now - msMap[preset]).toISOString(),
        until: undefined,
      });
    },
    [updateDraft],
  );

  const activePreset = getDatePreset(draft.since);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (draft.sort !== 'top') count++;
    if (draft.mediaFilter && draft.mediaFilter !== 'all') count++;
    if (draft.since) count++;
    if (draft.lang) count++;
    if (draft.domain) count++;
    return count;
  }, [draft]);

  // Active filter chips
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> =
      [];
    if (draft.mediaFilter && draft.mediaFilter !== 'all') {
      chips.push({
        key: 'media',
        label: draft.mediaFilter.charAt(0).toUpperCase() + draft.mediaFilter.slice(1),
        onRemove: () => updateDraft({ mediaFilter: 'all' }),
      });
    }
    if (draft.since) {
      const presetLabels: Record<string, string> = {
        '24h': 'Last 24h',
        '7d': 'Last 7 days',
        '30d': 'Last 30 days',
        '1y': 'Last year',
      };
      chips.push({
        key: 'date',
        label: presetLabels[activePreset] || 'Custom date',
        onRemove: () => updateDraft({ since: undefined, until: undefined }),
      });
    }
    if (draft.lang) {
      chips.push({
        key: 'lang',
        label: getLanguageName(draft.lang),
        onRemove: () => updateDraft({ lang: undefined }),
      });
    }
    if (draft.domain) {
      chips.push({
        key: 'domain',
        label: draft.domain,
        onRemove: () => updateDraft({ domain: undefined }),
      });
    }
    return chips;
  }, [draft, activePreset, updateDraft]);

  const mediaTypes: Array<{ value: MediaFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'images', label: 'Images' },
    { value: 'videos', label: 'Videos' },
    { value: 'links', label: 'Links' },
  ];

  const datePresets: Array<{ value: DatePreset; label: string }> = [
    { value: '24h', label: '24h' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '1y', label: '1 year' },
    { value: 'all', label: 'All time' },
  ];

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayBackground}
            activeOpacity={1}
            onPress={onClose}
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            {/* Handle bar */}
            <View style={styles.handleBar}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Search Filters</Text>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <CloseIcon size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {/* Active Filter Chips */}
              {activeChips.length > 0 && (
                <View style={styles.chipsContainer}>
                  {activeChips.map((chip) => (
                    <View key={chip.key} style={styles.chip}>
                      <Text style={styles.chipText}>{chip.label}</Text>
                      <TouchableOpacity
                        onPress={chip.onRemove}
                        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                      >
                        <CloseIcon size={14} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Sort By */}
              <Text style={styles.sectionLabel}>Sort By</Text>
              <View style={styles.optionRow}>
                {(['top', 'latest'] as const).map((sort) => (
                  <TouchableOpacity
                    key={sort}
                    style={[
                      styles.optionPill,
                      draft.sort === sort && styles.optionPillActive,
                    ]}
                    onPress={() => updateDraft({ sort })}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        draft.sort === sort && styles.optionPillTextActive,
                      ]}
                    >
                      {sort.charAt(0).toUpperCase() + sort.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Media Type */}
              <Text style={styles.sectionLabel}>Media Type</Text>
              <View style={styles.optionRow}>
                {mediaTypes.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.optionPill,
                      draft.mediaFilter === type.value &&
                        styles.optionPillActive,
                    ]}
                    onPress={() => updateDraft({ mediaFilter: type.value })}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        draft.mediaFilter === type.value &&
                          styles.optionPillTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Date Range */}
              <View style={styles.sectionHeader}>
                <CalendarIcon size={16} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>Date Range</Text>
              </View>
              <View style={styles.optionRow}>
                {datePresets.map((preset) => (
                  <TouchableOpacity
                    key={preset.value}
                    style={[
                      styles.optionPill,
                      activePreset === preset.value &&
                        styles.optionPillActive,
                    ]}
                    onPress={() => setDatePreset(preset.value)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        activePreset === preset.value &&
                          styles.optionPillTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Language */}
              <View style={styles.sectionHeader}>
                <GlobeIcon size={16} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>Language</Text>
              </View>
              <TouchableOpacity
                style={styles.selectButton}
                onPress={() => setShowLanguagePicker(true)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.selectButtonText,
                    draft.lang && styles.selectButtonTextActive,
                  ]}
                >
                  {draft.lang
                    ? getLanguageName(draft.lang)
                    : 'Any language'}
                </Text>
                {draft.lang && (
                  <TouchableOpacity
                    onPress={() => updateDraft({ lang: undefined })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.clearFieldButton}
                  >
                    <CloseIcon size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Domain / Source */}
              <View style={styles.sectionHeader}>
                <SearchIcon size={16} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>Domain / Source</Text>
              </View>
              <View style={styles.textInputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. nytimes.com"
                  placeholderTextColor={colors.textTertiary}
                  value={draft.domain || ''}
                  onChangeText={(text) =>
                    updateDraft({ domain: text || undefined })
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                {draft.domain ? (
                  <TouchableOpacity
                    onPress={() => updateDraft({ domain: undefined })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.clearFieldButton}
                  >
                    <CloseIcon size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Reset button */}
              {activeFilterCount > 0 && (
                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleReset}
                  activeOpacity={0.7}
                >
                  <Text style={styles.resetButtonText}>
                    Reset All Filters
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            {/* Apply button */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={handleApply}
                activeOpacity={0.8}
              >
                <Text style={styles.applyButtonText}>
                  Apply Filters
                  {activeFilterCount > 0
                    ? ` (${activeFilterCount})`
                    : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language picker sub-modal */}
      <LanguagePicker
        visible={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
        selectedLanguages={draft.lang ? [draft.lang] : []}
        onSelectLanguages={(langs) => {
          updateDraft({ lang: langs[0] || undefined });
        }}
        multiSelect={false}
      />
    </>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    overlayBackground: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.modalOverlay,
    },
    sheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '85%',
    },
    handleBar: {
      alignItems: 'center',
      paddingTop: 8,
      paddingBottom: 4,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textTertiary,
      opacity: 0.4,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    chipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
      marginTop: 4,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    chipText: {
      color: '#ffffff',
      fontSize: 13,
      fontWeight: '500',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 16,
      marginBottom: 8,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 16,
      marginBottom: 8,
    },
    optionRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    optionPill: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    optionPillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.surface,
    },
    optionPillText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    optionPillTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    selectButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    selectButtonText: {
      fontSize: 15,
      color: colors.textTertiary,
    },
    selectButtonTextActive: {
      color: colors.text,
    },
    clearFieldButton: {
      padding: 4,
    },
    textInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
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
    resetButton: {
      marginTop: 24,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.surfaceElevated,
    },
    resetButtonText: {
      color: colors.danger,
      fontSize: 15,
      fontWeight: '600',
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceElevated,
    },
    applyButton: {
      backgroundColor: colors.primary,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
    },
    applyButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
