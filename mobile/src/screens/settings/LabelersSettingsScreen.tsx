import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { ChevronLeftIcon, ChevronDownIcon, ChevronUpIcon } from '../../components/icons';
import {
  getSubscribedLabelers,
  subscribeToLabeler,
  unsubscribeFromLabeler,
  getLabelerInfoBatch,
  getLabelerLabelPreferences,
  setLabelerLabelPreference,
} from "../../services/atproto/labelers";
import type {
  LabelerInfo,
  LabelerSubscription,
  LabelerLabelPreference,
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

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await loadLabelers();
      setIsLoading(false);
    })();
  }, [loadLabelers]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadLabelers();
    setIsRefreshing(false);
  }, [loadLabelers]);

  const handleSubscribe = useCallback(async () => {
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

      // Load label preferences for this labeler if not cached
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

        // Update local cache
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

      // Check default from labeler policies
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
                        <Text style={styles.labelName}>{localeName}</Text>
                        {localeDesc ? (
                          <Text
                            style={styles.labelDescription}
                            numberOfLines={2}
                          >
                            {localeDesc}
                          </Text>
                        ) : null}
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
          Subscribe to labeling services that moderate content in your feeds.
          Configure how each label type is displayed.
        </Text>

        {/* Add Labeler */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscribe to Labeler</Text>
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={didInput}
              onChangeText={setDidInput}
              placeholder="Enter labeler DID (did:plc:...)"
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
              onPress={handleSubscribe}
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
              No labelers subscribed. Add a labeler DID above to get started.
            </Text>
          ) : (
            subscriptions.map(renderLabelerCard)
          )}
        </View>

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
    labelName: {
      fontSize: fontSize.subheadline,
      fontWeight: "500",
      color: colors.text,
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
