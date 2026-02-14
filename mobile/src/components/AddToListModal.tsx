import React, {useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useLists, useAddToList} from '../hooks/api';
import {AppBskyGraphDefs} from '@atproto/api';
import {colors} from '../constants/theme';

interface AddToListModalProps {
  visible: boolean;
  onClose: () => void;
  userDid: string;
  userHandle: string;
}

export function AddToListModal({
  visible,
  onClose,
  userDid,
  userHandle,
}: AddToListModalProps) {
  const {data, isLoading, error} = useLists();
  const {mutateAsync: addToList, isPending} = useAddToList();

  const lists = data?.lists || [];

  const handleAddToList = async (list: AppBskyGraphDefs.ListView) => {
    try {
      await addToList({listUri: list.uri, did: userDid});
      Alert.alert('Success', `Added @${userHandle} to ${list.name}`);
      onClose();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to add user to list'
      );
    }
  };

  const renderListItem = ({item}: {item: AppBskyGraphDefs.ListView}) => (
    <TouchableOpacity
      style={styles.listItem}
      onPress={() => handleAddToList(item)}
      disabled={isPending}>
      <View style={styles.listContent}>
        <Text style={styles.listName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.listDescription} numberOfLines={1}>
            {item.description}
          </Text>
        )}
        <Text style={styles.listMemberCount}>
          {item.listItemCount || 0} members
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading lists...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load lists</Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No lists yet</Text>
        <Text style={styles.emptySubtext}>Create a list to get started</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add to List</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={lists}
          renderItem={renderListItem}
          keyExtractor={(item) => item.uri}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={lists.length === 0 ? styles.emptyContainer : undefined}
        />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    color: colors.textSecondary,
    fontSize: 24,
    fontWeight: '300',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  listContent: {
    flex: 1,
  },
  listName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  listDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  listMemberCount: {
    color: colors.textTertiary,
    fontSize: 13,
  },
  chevron: {
    color: colors.textTertiary,
    fontSize: 24,
    fontWeight: '300',
    marginLeft: 8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  emptyText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '600',
  },
});
