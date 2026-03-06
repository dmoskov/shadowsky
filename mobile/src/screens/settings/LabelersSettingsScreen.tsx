import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { ChevronLeftIcon, ChevronDownIcon, ChevronUpIcon, SearchIcon, CloseIcon } from '../../components/icons';
import {
  getSubscribedLabelers,
  subscribeToLabeler,
  unsubscribeFromLabeler,
  getLabelerInfoBatch,
  getLabelerLabelPreferences,
  setLabelerLabelPreference,
  getDirectoryLabelers,
  searchLabelers,
  getModerationLists,
  LABELER_CATEGORIES,
} from "../../services/atproto/labelers";
import type {
  LabelerInfo,
  LabelerSubscription,
  LabelerLabelPreference,
  LabelerCategory,
} from "../../services/atproto/labelers";
import { createLogger } from "../../utils/logger";
import {fontSize} from '../../utils/typography';

const logger = createLogger("LabelersSettingsScreen");

interface LabelersSettingsScreenProps {
  navigation: {
    goBack: () => void;
  };
}

const VISIBILITY_OPTIONS: Array<{
  value: "show" | "warn" | "hide";
  label: string;
}> = [
  { value: "show", label: "Show" },
  { value: "warn", label: "Warn" },
  { value: "hide", label: "Hide" },
];

export function LabelersSettingsScreen({
  navigation,
}: LabelersSettingsScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [subscriptions, setSubscriptions] = useState<LabelerSubscription[]>([]);
  const [labelerDetails, setLabelerDetails] = useState<
    Map<string, LabelerInfo>
  >(new Map());
  const [labelPrefs, setLabelPrefs] = useState<
    Map<string, LabelerLabelPreference[]>
  >(new Map());
  const [expandedLabeler, setExpandedLabeler] = useState<string | null>(null);
  const [didInput, setDidInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Browse/search state
  const [selectedCategory, setSelectedCategory] = useState<LabelerCategory>("All");
  const [directoryLabelers, setDirectoryLabelers] = useState<LabelerInfo[]>([]);
  const [isLoadingDirectory, setIsLoadingDirectory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LabelerInfo[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Moderation lists state
  const [moderationLists, setModerationLists] = useState<
    Array<{
      uri: string;
      name: string;
      description?: string;
      avatar?: string;
      purpose: string;
      listItemCount?: number;
      creator: { did: string; handle: string; displayName?: string };
    }>
  >([]);

  const loadModerationLists = useCallback(async () => {
    try {
      const lists = await getModerationLists();
      setModerationLists(lists);
    } catch (error) {
      logger.error("Failed to load moderation lists:", error);
    }
  }, []);

  const loadLabelers = useCallback(async () => {
    try {
      const subs = await getSubscribedLabelers();
      setSubscriptions(subs);

      if (subs.length > 0) {
        const dids = subs.map((s) => s.did);
        const infos = await getLabelerInfoBatch(dids);
        const infoMap = new Map<string, LabelerInfo>();
        for (const info of infos) {
          infoMap.set(info.did, info);
        }
        setLabelerDetails(infoMap);
      } else {
        setLabelerDetails(new Map());
      }
    } catch (error) {
      logger.error("Failed to load labelers:", error);
    }
  }, []);

  const loadDirectory = useCallback(async (category?: LabelerCategory) => {
    setIsLoadingDirectory(true);
    try {
      const labelers = await getDirectoryLabelers(category);
      setDirectoryLabelers(labelers);
    } catch (error) {
      logger.error("Failed to load directory:", error);
    } finally {
      setIsLoadingDirectory(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await Promise.all([loadLabelers(), loadDirectory(), loadModerationLists()]);
      setIsLoading(false);
    })();
  }, [loadLabelers, loadDirectory, loadModerationLists]);

  useEffect(() => {
    if (!isLoading) {
      loadDirectory(selectedCategory);
    }
  }, [selectedCategory, loadDirectory, isLoading]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadLabelers(), loadDirectory(selectedCategory), loadModerationLists()]);
    setIsRefreshing(false);
  }, [loadLabelers, loadDirectory, loadModerationLists, selectedCategory]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (!query.trim()) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchLabelers(query);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }, []);

  const handleSubscribeFromBrowser = useCallback(
    async (labelerDid: string) => {
      if (subscriptions.some((s) => s.did === labelerDid)) {
        return;
      }

      try {
        await subscribeToLabeler(labelerDid);
        await loadLabelers();
      } catch (error) {
        logger.error("Failed to subscribe:", error);
        Alert.alert("Error", "Failed to subscribe to labeler. Please try again.");
      }
    },
    [subscriptions, loadLabelers],
  );

  const handleSubscribeDid = useCallback(async () => {
    const trimmedDid = didInput.trim();
    if (!trimmedDid.startsWith("did:")) {
      Alert.alert(
        "Invalid DID",
        "Please enter a valid DID starting with 'did:'",
      );
      return;
    }

    if (subscriptions.some((s) => s.did === trimmedDid)) {
      Alert.alert("Already Subscribed", "You are already subscribed to this labeler.");
      return;
    }

    setIsSubscribing(true);
    try {
      await subscribeToLabeler(trimmedDid);
      setDidInput("");
      await loadLabelers();
    } catch (error) {
      logger.error("Failed to subscribe:", error);
      Alert.alert("Error", "Failed to subscribe to labeler. Please try again.");
    } finally {
      setIsSubscribing(false);
    }
  }, [didInput, subscriptions, loadLabelers]);

  const handleUnsubscribe = useCallback(
    (did: string) => {
      const info = labelerDetails.get(did);
      const name =
        info?.creator.displayName || info?.creator.handle || did;

      Alert.alert(
        "Unsubscribe",
        `Are you sure you want to unsubscribe from ${name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unsubscribe",
            style: "destructive",
            onPress: async () => {
              try {
                await unsubscribeFromLabeler(did);
                setExpandedLabeler(null);
                await loadLabelers();
              } catch (error) {
                logger.error("Failed to unsubscribe:", error);
                Alert.alert(
                  "Error",
                  "Failed to unsubscribe. Please try again.",
                );
              }
            },
          },
        ],
      );
    },
    [labelerDetails, loadLabelers],
  );

  const handleToggleExpand = useCallback(
    async (did: string) => {
      if (expandedLabeler === did) {
        setExpandedLabeler(null);
        return;
      }

      setExpandedLabeler(did);

      if (!labelPrefs.has(did)) {
        try {
          const prefs = await getLabelerLabelPreferences(did);
          setLabelPrefs((prev) => new Map(prev).set(did, prefs));
        } catch (error) {
          logger.error("Failed to load label preferences:", error);
        }
      }
    },
    [expandedLabeler, labelPrefs],
  );

  const handleSetLabelPref = useCallback(
    async (
      labelerDid: string,
      label: string,
      visibility: "show" | "warn" | "hide",
    ) => {
      try {
        await setLabelerLabelPreference(labelerDid, label, visibility);

        setLabelPrefs((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(labelerDid) || [];
          const idx = existing.findIndex((p) => p.label === label);
          const newPref: LabelerLabelPreference = {
            labelerDid,
            label,
            visibility,
          };
          if (idx >= 0) {
            const copy = [...existing];
            copy[idx] = newPref;
            updated.set(labelerDid, copy);
          } else {
            updated.set(labelerDid, [...existing, newPref]);
          }
          return updated;
        });
      } catch (error) {
        logger.error("Failed to set label preference:", error);
        Alert.alert("Error", "Failed to update label preference.");
      }
    },
    [],
  );

  const getLabelVisibility = useCallback(
    (labelerDid: string, label: string): "show" | "warn" | "hide" => {
      const prefs = labelPrefs.get(labelerDid) || [];
      const pref = prefs.find((p) => p.label === label);
      if (pref) return pref.visibility;

      const info = labelerDetails.get(labelerDid);
      const def = info?.policies?.labelValueDefinitions?.find(
        (d) => d.identifier === label,
      );
      if (def?.defaultSetting) {
        return def.defaultSetting as "show" | "warn" | "hide";
      }
      return "warn";
    },
    [labelPrefs, labelerDetails],
  );

  const isSubscribed = useCallback(
    (did: string) => subscriptions.some((s) => s.did === did),
    [subscriptions],
  );

  const renderLabelerBrowseCard = (labeler: LabelerInfo) => {
    const subscribed = isSubscribed(labeler.did);
    const labelDefs = labeler.policies?.labelValueDefinitions || [];
    const standardLabelCount = labeler.policies?.labelValues?.length || 0;
    const customLabelCount = labelDefs.length;

    return (
      <View key={labeler.did} style={styles.browseCard}>
        <View style={styles.browseCardContent}>
          {labeler.creator.avatar ? (
            <Image
              source={{ uri: labeler.creator.avatar }}
              style={styles.browseAvatar}
            />
          ) : (
            <View style={styles.browseAvatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {(
                  labeler.creator.displayName ||
                  labeler.creator.handle ||
                  "?"
                )
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.browseTextContainer}>
            <Text style={styles.browseName} numberOfLines={1}>
              {labeler.creator.displayName || labeler.creator.handle}
            </Text>
            <Text style={styles.browseHandle} numberOfLines={1}>
              @{labeler.creator.handle}
            </Text>
            {labeler.creator.description ? (
              <Text style={styles.browseDescription} numberOfLines={2}>
                {labeler.creator.description}
              </Text>
            ) : null}
            <View style={styles.browseMetaRow}>
              {labeler.likeCount != null && labeler.likeCount > 0 && (
                <Text style={styles.browseLikes}>
                  {labeler.likeCount.toLocaleString()} likes
                </Text>
              )}
              {(standardLabelCount > 0 || customLabelCount > 0) && (
                <Text style={styles.browseLabelCount}>
                  {standardLabelCount + customLabelCount} label{standardLabelCount + customLabelCount !== 1 ? "s" : ""}
                </Text>
              )}
            </View>
            {/* Custom label definitions preview */}
            {customLabelCount > 0 && (
              <View style={styles.browseCustomLabels}>
                {labelDefs.slice(0, 4).map((def) => {
                  const name =
                    def.locales.find((l) => l.lang === "en")?.name ||
                    def.locales[0]?.name ||
                    def.identifier;
                  return (
                    <View key={def.identifier} style={[
                      styles.browseCustomLabelPill,
                      def.adultOnly && styles.browseCustomLabelPillAdult,
                    ]}>
                      <Text style={[
                        styles.browseCustomLabelText,
                        def.adultOnly && styles.browseCustomLabelTextAdult,
                      ]} numberOfLines={1}>
                        {name}
                      </Text>
                    </View>
                  );
                })}
                {customLabelCount > 4 && (
                  <Text style={styles.browseCustomLabelMore}>
                    +{customLabelCount - 4} more
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[
            styles.browseSubscribeButton,
            subscribed && styles.browseSubscribeButtonDisabled,
          ]}
          onPress={() => handleSubscribeFromBrowser(labeler.did)}
          disabled={subscribed}
        >
          <Text
            style={[
              styles.browseSubscribeText,
              subscribed && styles.browseSubscribeTextDisabled,
            ]}
          >
            {subscribed ? "Subscribed" : "Subscribe"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderLabelerCard = (sub: LabelerSubscription) => {
    const info = labelerDetails.get(sub.did);
    const isExpanded = expandedLabeler === sub.did;
    const labelDefs = info?.policies?.labelValueDefinitions || [];

    return (
      <View key={sub.did} style={styles.labelerCard}>
        <TouchableOpacity
          style={styles.labelerHeader}
          onPress={() => handleToggleExpand(sub.did)}
          accessibilityRole="button"
          accessibilityLabel={`${info?.creator.displayName || sub.did}, tap to ${isExpanded ? "collapse" : "expand"}`}
        >
          <View style={styles.labelerInfo}>
            {info?.creator.avatar ? (
              <Image
                source={{ uri: info.creator.avatar }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {(
                    info?.creator.displayName ||
                    info?.creator.handle ||
                    "?"
                  )
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.labelerText}>
              <Text style={styles.labelerName} numberOfLines={1}>
                {info?.creator.displayName || sub.did}
              </Text>
              {info?.creator.handle && (
                <Text style={styles.labelerHandle} numberOfLines={1}>
                  @{info.creator.handle}
                </Text>
              )}
            </View>
          </View>
          {isExpanded ? (
            <ChevronUpIcon size={20} color={colors.textSecondary} />
          ) : (
            <ChevronDownIcon size={20} color={colors.textSecondary} />
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            {info?.creator.description ? (
              <Text style={styles.labelerDescription}>
                {info.creator.description}
              </Text>
            ) : null}

            {info?.likeCount != null && (
              <Text style={styles.likeCount}>
                {info.likeCount.toLocaleString()} likes
              </Text>
            )}

            {labelDefs.length > 0 && (
              <View style={styles.labelsSection}>
                <Text style={styles.labelsSectionTitle}>Label Settings</Text>
                {labelDefs.map((def) => {
                  const localeName =
                    def.locales.find((l) => l.lang === "en")?.name ||
                    def.locales[0]?.name ||
                    def.identifier;
                  const localeDesc =
                    def.locales.find((l) => l.lang === "en")?.description ||
                    def.locales[0]?.description ||
                    "";
                  const currentVisibility = getLabelVisibility(
                    sub.did,
                    def.identifier,
                  );

                  return (
                    <View key={def.identifier} style={styles.labelRow}>
                      <View style={styles.labelInfo}>
                        <View style={styles.labelNameRow}>
                          <Text style={styles.labelName}>{localeName}</Text>
                          {def.adultOnly && (
                            <View style={styles.adultOnlyBadge}>
                              <Text style={styles.adultOnlyText}>18+</Text>
                            </View>
                          )}
                        </View>
                        {localeDesc ? (
                          <Text
                            style={styles.labelDescription}
                            numberOfLines={2}
                          >
                            {localeDesc}
                          </Text>
                        ) : null}
                        <View style={styles.labelMetaTags}>
                          {def.severity && (
                            <Text style={styles.labelMetaTag}>
                              {def.severity}
                            </Text>
                          )}
                          {def.blurs && (
                            <Text style={styles.labelMetaTag}>
                              blurs: {def.blurs}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.visibilityButtons}>
                        {VISIBILITY_OPTIONS.map((opt) => (
                          <TouchableOpacity
                            key={opt.value}
                            style={[
                              styles.visibilityButton,
                              currentVisibility === opt.value &&
                                styles.visibilityButtonActive,
                            ]}
                            onPress={() =>
                              handleSetLabelPref(
                                sub.did,
                                def.identifier,
                                opt.value,
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Set ${localeName} to ${opt.label}`}
                            accessibilityState={{
                              selected: currentVisibility === opt.value,
                            }}
                          >
                            <Text
                              style={[
                                styles.visibilityButtonText,
                                currentVisibility === opt.value &&
                                  styles.visibilityButtonTextActive,
                              ]}
                            >
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={styles.unsubscribeButton}
              onPress={() => handleUnsubscribe(sub.did)}
              accessibilityRole="button"
              accessibilityLabel="Unsubscribe from this labeler"
            >
              <Text style={styles.unsubscribeButtonText}>Unsubscribe</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
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
          <ChevronLeftIcon size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Content Labelers</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <Text style={styles.description}>
          Browse, search, and subscribe to content labeling services.
        </Text>

        {/* Browse Labelers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browse Labelers</Text>

          {/* Search input */}
          <View style={styles.searchContainer}>
            <SearchIcon size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search labelers by name or handle..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => handleSearch("")}>
                <CloseIcon size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Category filter pills (only when not searching) */}
          {!searchQuery && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {LABELER_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryPill,
                    selectedCategory === cat && styles.categoryPillActive,
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      selectedCategory === cat && styles.categoryPillTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Search results or directory listing */}
          {searchQuery ? (
            isSearching ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.searchLoader}
              />
            ) : searchResults && searchResults.length > 0 ? (
              <View>
                <Text style={styles.resultCount}>
                  {searchResults.length} labeler{searchResults.length !== 1 ? "s" : ""} found
                </Text>
                {searchResults.map(renderLabelerBrowseCard)}
              </View>
            ) : searchResults !== null ? (
              <Text style={styles.emptyText}>
                No labelers found for &ldquo;{searchQuery}&rdquo;. Not all accounts are labelers.
              </Text>
            ) : null
          ) : isLoadingDirectory ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.searchLoader}
            />
          ) : directoryLabelers.length > 0 ? (
            <View>
              {directoryLabelers.map(renderLabelerBrowseCard)}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              No labelers available in this category
            </Text>
          )}
        </View>

        {/* Add by DID */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add by DID</Text>
          <Text style={styles.sectionSubtitle}>
            Know a labeler&apos;s DID? Subscribe directly.
          </Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={didInput}
              onChangeText={setDidInput}
              placeholder="did:plc:..."
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubscribing}
            />
            <TouchableOpacity
              style={[
                styles.addButton,
                (isSubscribing || !didInput.trim()) && styles.addButtonDisabled,
              ]}
              onPress={handleSubscribeDid}
              disabled={isSubscribing || !didInput.trim()}
            >
              {isSubscribing ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={styles.addButtonText}>Add</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Subscribed Labelers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscribed Labelers</Text>

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              style={styles.loader}
            />
          ) : subscriptions.length === 0 ? (
            <Text style={styles.emptyText}>
              No labelers subscribed. Browse the directory above or add a labeler DID to get started.
            </Text>
          ) : (
            subscriptions.map(renderLabelerCard)
          )}
        </View>

        {/* Moderation Lists */}
        {moderationLists.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Moderation Lists</Text>
            <Text style={styles.sectionSubtitle}>
              Your moderation lists that act as label sources for blocking and muting.
            </Text>
            {moderationLists.map((list) => (
              <View key={list.uri} style={styles.modListCard}>
                <View style={styles.modListInfo}>
                  <Text style={styles.modListName} numberOfLines={1}>
                    {list.name}
                  </Text>
                  {list.description ? (
                    <Text style={styles.modListDescription} numberOfLines={2}>
                      {list.description}
                    </Text>
                  ) : null}
                  <Text style={styles.modListMeta}>
                    by @{list.creator.handle}
                    {list.listItemCount != null
                      ? ` · ${list.listItemCount} item${list.listItemCount !== 1 ? "s" : ""}`
                      : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>About Content Labelers</Text>
          <Text style={styles.infoText}>
            Labelers are moderation services that apply labels to content. When
            you subscribe, their labels appear on posts in your feeds. You can
            configure each label type to show, warn, or hide matching content.
          </Text>
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
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 4,
      width: 40,
    },
    headerTitle: {
      fontSize: fontSize.headline,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
      textAlign: "center",
    },
    headerSpacer: {
      width: 40,
    },
    container: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    description: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: fontSize.callout,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 12,
    },
    sectionSubtitle: {
      fontSize: fontSize.footnote,
      color: colors.textSecondary,
      marginBottom: 10,
    },
    // Search
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 8,
      fontSize: fontSize.subheadline,
      color: colors.text,
    },
    searchLoader: {
      marginVertical: 16,
    },
    resultCount: {
      fontSize: fontSize.caption1,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    // Category pills
    categoryScroll: {
      marginBottom: 12,
    },
    categoryScrollContent: {
      gap: 8,
    },
    categoryPill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    categoryPillText: {
      fontSize: fontSize.caption1,
      fontWeight: "500",
      color: colors.textSecondary,
    },
    categoryPillTextActive: {
      color: colors.text,
    },
    // Browse cards
    browseCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    browseCardContent: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    browseAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    browseAvatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    browseTextContainer: {
      flex: 1,
    },
    browseName: {
      fontSize: fontSize.subheadline,
      fontWeight: "600",
      color: colors.text,
    },
    browseHandle: {
      fontSize: fontSize.caption1,
      color: colors.textSecondary,
      marginTop: 1,
    },
    browseDescription: {
      fontSize: fontSize.caption1,
      color: colors.textSecondary,
      marginTop: 4,
      lineHeight: 16,
    },
    browseMetaRow: {
      flexDirection: "row",
      gap: 12,
      marginTop: 4,
    },
    browseLikes: {
      fontSize: fontSize.caption2,
      color: colors.textSecondary,
    },
    browseLabelCount: {
      fontSize: fontSize.caption2,
      color: colors.textSecondary,
    },
    browseCustomLabels: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 6,
    },
    browseCustomLabelPill: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    browseCustomLabelPillAdult: {
      borderColor: colors.danger,
    },
    browseCustomLabelText: {
      fontSize: fontSize.caption2,
      color: colors.textSecondary,
    },
    browseCustomLabelTextAdult: {
      color: colors.danger,
    },
    browseCustomLabelMore: {
      fontSize: fontSize.caption2,
      color: colors.textSecondary,
      alignSelf: "center",
    },
    browseSubscribeButton: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginTop: 10,
      alignSelf: "flex-end",
    },
    browseSubscribeButtonDisabled: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    browseSubscribeText: {
      fontSize: fontSize.footnote,
      fontWeight: "600",
      color: colors.text,
    },
    browseSubscribeTextDisabled: {
      color: colors.textSecondary,
    },
    // DID input
    addRow: {
      flexDirection: "row",
      gap: 10,
    },
    input: {
      flex: 1,
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: 10,
      padding: 12,
      fontSize: fontSize.subheadline,
      borderWidth: 1,
      borderColor: colors.border,
    },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    addButtonDisabled: {
      opacity: 0.5,
    },
    addButtonText: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: "600",
    },
    loader: {
      marginVertical: 24,
    },
    emptyText: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    // Subscribed labeler cards
    labelerCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    labelerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
    },
    labelerInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 8,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      marginRight: 12,
    },
    avatarPlaceholder: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    avatarPlaceholderText: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: "600",
    },
    labelerText: {
      flex: 1,
    },
    labelerName: {
      fontSize: fontSize.subheadline,
      fontWeight: "600",
      color: colors.text,
    },
    labelerHandle: {
      fontSize: fontSize.footnote,
      color: colors.textSecondary,
      marginTop: 2,
    },
    expandedContent: {
      paddingHorizontal: 14,
      paddingBottom: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    labelerDescription: {
      fontSize: fontSize.footnote,
      color: colors.textSecondary,
      lineHeight: 18,
      marginTop: 12,
    },
    likeCount: {
      fontSize: fontSize.caption1,
      color: colors.textSecondary,
      marginTop: 6,
    },
    labelsSection: {
      marginTop: 16,
    },
    labelsSectionTitle: {
      fontSize: fontSize.subheadline,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 10,
    },
    labelRow: {
      marginBottom: 14,
    },
    labelInfo: {
      marginBottom: 8,
    },
    labelNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    labelName: {
      fontSize: fontSize.subheadline,
      fontWeight: "500",
      color: colors.text,
    },
    adultOnlyBadge: {
      backgroundColor: colors.danger,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    adultOnlyText: {
      fontSize: fontSize.caption2,
      fontWeight: "700",
      color: "#fff",
    },
    labelMetaTags: {
      flexDirection: "row",
      gap: 6,
      marginTop: 4,
    },
    labelMetaTag: {
      fontSize: fontSize.caption2,
      color: colors.textSecondary,
      backgroundColor: colors.surface,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      overflow: "hidden",
    },
    labelDescription: {
      fontSize: fontSize.caption1,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    visibilityButtons: {
      flexDirection: "row",
      gap: 8,
    },
    visibilityButton: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    visibilityButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    visibilityButtonText: {
      fontSize: fontSize.footnote,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    visibilityButtonTextActive: {
      color: colors.text,
    },
    unsubscribeButton: {
      marginTop: 16,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.danger,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
    },
    unsubscribeButtonText: {
      color: colors.danger,
      fontSize: fontSize.subheadline,
      fontWeight: "600",
    },
    modListCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modListInfo: {
      flex: 1,
    },
    modListName: {
      fontSize: fontSize.subheadline,
      fontWeight: "600",
      color: colors.text,
    },
    modListDescription: {
      fontSize: fontSize.caption1,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 16,
    },
    modListMeta: {
      fontSize: fontSize.caption2,
      color: colors.textSecondary,
      marginTop: 4,
    },
    infoBox: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoTitle: {
      fontSize: fontSize.subheadline,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    infoText: {
      fontSize: fontSize.footnote,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
}
