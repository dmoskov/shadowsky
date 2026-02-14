/**
 * AccountSwitcher Component
 * Displays list of accounts and allows switching between them
 */

import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { AuthAccount } from "../services/auth/auth-service";
import { CheckIcon, CloseIcon, PlusIcon } from "./icons";
import {colors} from '../constants/theme';

interface AccountSwitcherProps {
  onAccountSwitch?: () => void;
  onAddAccount?: () => void;
}

export function AccountSwitcher({
  onAccountSwitch,
  onAddAccount,
}: AccountSwitcherProps) {
  const {
    accounts,
    account: currentAccount,
    switchAccount,
    removeAccount,
  } = useAuth();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [removingAccount, setRemovingAccount] = useState<string | null>(null);

  const handleSwitchAccount = async (did: string) => {
    if (did === currentAccount?.did) {
      return; // Already active
    }

    try {
      setSwitchingTo(did);
      await switchAccount(did);
      onAccountSwitch?.();
    } catch (error) {
      Alert.alert(
        "Switch Failed",
        error instanceof Error
          ? error.message
          : "Failed to switch account. Please try again.",
      );
    } finally {
      setSwitchingTo(null);
    }
  };

  const handleRemoveAccount = async (did: string, handle: string) => {
    Alert.alert(
      "Remove Account",
      `Are you sure you want to remove @${handle}? You will need to sign in again to use this account.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setRemovingAccount(did);
              await removeAccount(did);
            } catch (error) {
              Alert.alert(
                "Remove Failed",
                "Failed to remove account. Please try again.",
              );
            } finally {
              setRemovingAccount(null);
            }
          },
        },
      ],
    );
  };

  const renderAccount = (acc: AuthAccount) => {
    const isActive = acc.did === currentAccount?.did;
    const isSwitching = switchingTo === acc.did;
    const isRemoving = removingAccount === acc.did;

    return (
      <View key={acc.did} style={styles.accountContainer}>
        <TouchableOpacity
          style={[styles.accountButton, isActive && styles.activeAccount]}
          onPress={() => handleSwitchAccount(acc.did)}
          disabled={isSwitching || isRemoving}
        >
          {acc.avatar ? (
            <Image source={{ uri: acc.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {(acc.displayName || acc.handle || "?")[0].toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.accountInfo}>
            <Text style={styles.displayName}>
              {acc.displayName || acc.handle}
            </Text>
            <Text style={styles.handle}>@{acc.handle}</Text>
          </View>

          {isSwitching && (
            <ActivityIndicator color=colors.info style={styles.spinner} />
          )}
          {isActive && !isSwitching && (
            <View style={styles.activeIndicator}>
              <CheckIcon size={16} color=colors.text />
            </View>
          )}
        </TouchableOpacity>

        {!isActive && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => handleRemoveAccount(acc.did, acc.handle)}
            disabled={isRemoving}
          >
            {isRemoving ? (
              <ActivityIndicator size="small" color="colors.accent" />
            ) : (
              <CloseIcon size={20} color="colors.accent" />
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Accounts</Text>
      </View>

      <View style={styles.accountsList}>
        {accounts.length === 0 ? (
          <Text style={styles.emptyText}>No accounts available</Text>
        ) : (
          accounts.map(renderAccount)
        )}
      </View>

      <TouchableOpacity style={styles.addAccountButton} onPress={onAddAccount}>
        <View style={styles.addAccountContent}>
          <PlusIcon size={18} color=colors.text />
          <Text style={styles.addAccountButtonText}>Add Account</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.borderDark,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.text,
  },
  accountsList: {
    paddingVertical: 8,
  },
  accountContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  accountButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "colors.editorBackground",
  },
  activeAccount: {
    backgroundColor: "colors.surface",
    borderWidth: 1,
    borderColor: colors.info,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "bold",
  },
  accountInfo: {
    flex: 1,
  },
  displayName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  handle: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  spinner: {
    marginLeft: 8,
  },
  activeIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.info,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  removeButton: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    padding: 24,
  },
  addAccountButton: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: colors.info,
    alignItems: "center",
  },
  addAccountContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addAccountButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
});
