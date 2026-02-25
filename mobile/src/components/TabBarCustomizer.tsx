import React, { useCallback, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { usePreferences } from "../contexts/PreferencesContext";
import { useTheme } from "../contexts/ThemeContext";
import { triggerHaptic } from "../utils/haptics";
import type { IconProps } from "./icons";
import {
  BellIcon,
  BookmarkIcon,
  ChartIcon,
  ChatBubbleIcon,
  HomeIcon,
  ListIcon,
  PersonIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
} from "./icons";

export interface NavItemDef {
  id: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
}

/**
 * All available navigation items that can appear in the tab bar.
 * Each maps to a route group under (tabs).
 */
export const ALL_NAV_ITEMS: NavItemDef[] = [
  { id: "home", label: "Home", icon: (props) => <HomeIcon {...props} /> },
  { id: "search", label: "Search", icon: (props) => <SearchIcon {...props} /> },
  {
    id: "notifications",
    label: "Notifications",
    icon: (props) => <BellIcon {...props} />,
  },
  {
    id: "profile",
    label: "Profile",
    icon: (props) => <PersonIcon {...props} />,
  },
  {
    id: "messages",
    label: "Messages",
    icon: (props) => <ChatBubbleIcon {...props} />,
  },
  {
    id: "bookmarks",
    label: "Bookmarks",
    icon: (props) => <BookmarkIcon {...props} />,
  },
  { id: "feeds", label: "Feeds", icon: (props) => <SparklesIcon {...props} /> },
  { id: "lists", label: "Lists", icon: (props) => <ListIcon {...props} /> },
  {
    id: "analytics",
    label: "Analytics",
    icon: (props) => <ChartIcon {...props} />,
  },
  {
    id: "settings",
    label: "Settings",
    icon: (props) => <SettingsIcon {...props} />,
  },
];

const MIN_TABS = 3;
const MAX_TABS = 5;

interface TabBarCustomizerProps {
  visible: boolean;
  onClose: () => void;
}

function TabBarCustomizerInner({ visible, onClose }: TabBarCustomizerProps) {
  const { colors } = useTheme();
  const { preferences, updatePreference } = usePreferences();

  const currentItems = preferences?.tabBarItems ?? [
    "home",
    "search",
    "feeds",
    "notifications",
    "profile",
  ];
  const [selectedItems, setSelectedItems] = useState<string[]>(currentItems);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setSelectedItems(
        preferences?.tabBarItems ?? [
          "home",
          "search",
          "feeds",
          "notifications",
          "profile",
        ],
      );
    }
  }, [visible, preferences?.tabBarItems]);

  const toggleItem = useCallback((itemId: string) => {
    triggerHaptic("selection");
    setSelectedItems((prev) => {
      const isSelected = prev.includes(itemId);
      if (isSelected) {
        // Don't allow fewer than MIN_TABS
        if (prev.length <= MIN_TABS) return prev;
        return prev.filter((id) => id !== itemId);
      } else {
        // Don't allow more than MAX_TABS
        if (prev.length >= MAX_TABS) return prev;
        return [...prev, itemId];
      }
    });
  }, []);

  const moveItem = useCallback((itemId: string, direction: "up" | "down") => {
    triggerHaptic("light");
    setSelectedItems((prev) => {
      const idx = prev.indexOf(itemId);
      if (idx === -1) return prev;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    triggerHaptic("success");
    await updatePreference("tabBarItems", selectedItems);
    onClose();
  }, [selectedItems, updatePreference, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const styles = createStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} style={styles.headerBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Edit Tab Bar</Text>
            <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Choose {MIN_TABS}-{MAX_TABS} tabs. Drag to reorder.
          </Text>

          {/* Active items - reorderable */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ACTIVE TABS</Text>
            <Text style={styles.sectionCount}>
              {selectedItems.length}/{MAX_TABS}
            </Text>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            {selectedItems.map((itemId, index) => {
              const def = ALL_NAV_ITEMS.find((n) => n.id === itemId);
              if (!def) return null;
              return (
                <View key={itemId} style={styles.activeRow}>
                  <View style={styles.rowLeft}>
                    <View style={styles.iconContainer}>
                      {def.icon({ size: 22, color: colors.info })}
                    </View>
                    <Text style={styles.itemLabel}>{def.label}</Text>
                  </View>
                  <View style={styles.rowRight}>
                    <TouchableOpacity
                      onPress={() => moveItem(itemId, "up")}
                      disabled={index === 0}
                      style={[
                        styles.reorderBtn,
                        index === 0 && styles.disabledBtn,
                      ]}
                    >
                      <Text style={styles.reorderText}>^</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveItem(itemId, "down")}
                      disabled={index === selectedItems.length - 1}
                      style={[
                        styles.reorderBtn,
                        index === selectedItems.length - 1 &&
                          styles.disabledBtn,
                      ]}
                    >
                      <Text style={[styles.reorderText, styles.reorderDown]}>
                        ^
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => toggleItem(itemId)}
                      disabled={selectedItems.length <= MIN_TABS}
                      style={[
                        styles.removeBtn,
                        selectedItems.length <= MIN_TABS && styles.disabledBtn,
                      ]}
                    >
                      <Text style={styles.removeBtnText}>-</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}

            {/* Available items - not selected */}
            {ALL_NAV_ITEMS.filter((n) => !selectedItems.includes(n.id)).length >
              0 && (
              <>
                <View style={[styles.sectionHeader, styles.availableHeader]}>
                  <Text style={styles.sectionTitle}>AVAILABLE</Text>
                </View>
                {ALL_NAV_ITEMS.filter((n) => !selectedItems.includes(n.id)).map(
                  (def) => (
                    <View key={def.id} style={styles.availableRow}>
                      <View style={styles.rowLeft}>
                        <View style={styles.iconContainer}>
                          {def.icon({ size: 22, color: colors.textTertiary })}
                        </View>
                        <Text style={styles.availableLabel}>{def.label}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => toggleItem(def.id)}
                        disabled={selectedItems.length >= MAX_TABS}
                        style={[
                          styles.addBtn,
                          selectedItems.length >= MAX_TABS &&
                            styles.disabledBtn,
                        ]}
                      >
                        <Text style={styles.addBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  ),
                )}
              </>
            )}
          </ScrollView>

          {/* Preview */}
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Preview</Text>
            <View style={styles.previewBar}>
              {selectedItems.map((itemId) => {
                const def = ALL_NAV_ITEMS.find((n) => n.id === itemId);
                if (!def) return null;
                return (
                  <View key={itemId} style={styles.previewItem}>
                    {def.icon({ size: 20, color: colors.textTertiary })}
                    <Text style={styles.previewItemText}>{def.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Record<string, string>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "85%",
      paddingBottom: 34,
    },
    handle: {
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.borderLight,
      alignSelf: "center",
      marginTop: 8,
      marginBottom: 4,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    headerBtn: {
      padding: 4,
      minWidth: 60,
    },
    title: {
      color: colors.text,
      fontSize: 17,
      fontWeight: "600",
    },
    cancelText: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    saveText: {
      color: colors.info,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "right",
    },
    subtitle: {
      color: colors.textTertiary,
      fontSize: 13,
      textAlign: "center",
      marginBottom: 12,
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    sectionTitle: {
      color: colors.textTertiary,
      fontSize: 12,
      fontWeight: "600",
      letterSpacing: 0.5,
    },
    sectionCount: {
      color: colors.textTertiary,
      fontSize: 12,
    },
    scrollArea: {
      flexGrow: 0,
      flexShrink: 1,
    },
    scrollContent: {
      paddingBottom: 8,
    },
    activeRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    availableRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    availableHeader: {
      marginTop: 8,
    },
    rowLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    rowRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    iconContainer: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    itemLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "500",
    },
    availableLabel: {
      color: colors.textSecondary,
      fontSize: 16,
    },
    reorderBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    reorderText: {
      color: colors.textSecondary,
      fontSize: 16,
      fontWeight: "600",
    },
    reorderDown: {
      transform: [{ rotate: "180deg" }],
    },
    removeBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.danger + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    removeBtnText: {
      color: colors.danger,
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 20,
    },
    addBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.info + "20",
      alignItems: "center",
      justifyContent: "center",
    },
    addBtnText: {
      color: colors.info,
      fontSize: 18,
      fontWeight: "700",
      lineHeight: 20,
    },
    disabledBtn: {
      opacity: 0.3,
    },
    preview: {
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    previewLabel: {
      color: colors.textTertiary,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    previewBar: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingVertical: 8,
    },
    previewItem: {
      alignItems: "center",
      gap: 2,
    },
    previewItemText: {
      color: colors.textTertiary,
      fontSize: 10,
    },
  });

export const TabBarCustomizer = React.memo(TabBarCustomizerInner);
