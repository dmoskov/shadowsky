/**
 * MobileUserSelectableRow Component for React Native
 *
 * User row that can be selected for batch operations in mobile view.
 * Displays user info with checkbox when in selection mode.
 */

import type { AppBskyActorDefs } from "@atproto/api";
import React, { useCallback } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import type { SelectableUser } from "../../../contexts/BatchSelectionContext";
import {
  profileToSelectableUser,
  useBatchSelection,
} from "../../../contexts/BatchSelectionContext";

interface MobileUserSelectableRowProps {
  /** User profile data */
  user: AppBskyActorDefs.ProfileView;
  /** Optional relationship URI (for unfollow operations) */
  relationshipUri?: string;
  /** Click handler for non-selection mode */
  onPress?: (handle: string) => void;
}

const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='%23e1e1e1'/%3E%3C/svg%3E";

export const MobileUserSelectableRow: React.FC<
  MobileUserSelectableRowProps
> = ({ user, relationshipUri, onPress }) => {
  const { isSelectionMode, isSelected, toggleUser } = useBatchSelection();

  const selectableUser: SelectableUser = profileToSelectableUser(
    user,
    relationshipUri,
  );
  const selected = isSelected(user.did);

  const handlePress = useCallback(() => {
    if (isSelectionMode) {
      toggleUser(selectableUser);
    } else if (onPress) {
      onPress(user.handle);
    }
  }, [isSelectionMode, toggleUser, selectableUser, onPress, user.handle]);

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.container,
        isSelectionMode && selected && styles.containerSelected,
      ]}
    >
      {/* Selection checkbox */}
      {isSelectionMode && (
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      )}

      {/* Avatar */}
      <Image
        source={{ uri: user.avatar || DEFAULT_AVATAR }}
        style={styles.avatar}
      />

      {/* User info */}
      <View style={styles.userInfo}>
        <Text style={styles.displayName} numberOfLines={1}>
          {user.displayName || user.handle}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          @{user.handle}
        </Text>
        {user.description && (
          <Text style={styles.bio} numberOfLines={2}>
            {user.description}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e1e1e1",
    backgroundColor: "#ffffff",
    gap: 12,
  } as ViewStyle,
  containerSelected: {
    backgroundColor: "#eff6ff",
  } as ViewStyle,
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
  } as ViewStyle,
  checkboxSelected: {
    borderColor: "#1d9bf0",
    backgroundColor: "#1d9bf0",
  } as ViewStyle,
  checkmark: {
    fontSize: 14,
    color: "#ffffff",
    fontWeight: "700",
  } as TextStyle,
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e1e1e1",
  } as ImageStyle,
  userInfo: {
    flex: 1,
    minWidth: 0,
  } as ViewStyle,
  displayName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f1419",
    marginBottom: 2,
  } as TextStyle,
  handle: {
    fontSize: 14,
    color: "#687684",
    marginBottom: 4,
  } as TextStyle,
  bio: {
    fontSize: 13,
    color: "#536471",
    lineHeight: 18,
  } as TextStyle,
});
