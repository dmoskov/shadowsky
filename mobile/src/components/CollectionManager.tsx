import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useBookmarkCollections } from '../hooks/useBookmarkCollections';
import { BookmarkCollection, COLLECTION_COLORS } from '../services/bookmark-collections';
import { colors } from '../constants/theme';
import {
  exportBookmarkCollections,
  importBookmarkCollections,
} from '../utils/bookmarkCollectionsImportExport';

interface CollectionManagerProps {
  selectedCollectionId: string | null;
  onSelectCollection: (collectionId: string | null) => void;
  onClose?: () => void;
}

export function CollectionManager({
  selectedCollectionId,
  onSelectCollection,
  onClose,
}: CollectionManagerProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCollection, setEditingCollection] = useState<BookmarkCollection | null>(null);
  const [collectionName, setCollectionName] = useState('');
  const [collectionDescription, setCollectionDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');

  const {
    collections,
    createCollection,
    updateCollection,
    deleteCollection,
    isCreating,
    isUpdating,
    isDeleting,
  } = useBookmarkCollections();

  const handleCreateCollection = async () => {
    if (!collectionName.trim()) return;

    await createCollection({
      name: collectionName.trim(),
      description: collectionDescription.trim() || undefined,
      color: selectedColor,
    });

    setCollectionName('');
    setCollectionDescription('');
    setSelectedColor('blue');
    setShowCreateForm(false);
  };

  const handleUpdateCollection = async () => {
    if (!editingCollection || !collectionName.trim()) return;

    await updateCollection(editingCollection.id, {
      name: collectionName.trim(),
      description: collectionDescription.trim() || undefined,
      color: selectedColor,
    });

    setEditingCollection(null);
    setCollectionName('');
    setCollectionDescription('');
    setSelectedColor('blue');
  };

  const handleDeleteCollection = (collection: BookmarkCollection) => {
    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${collection.name}"? The bookmarks in this collection will not be deleted, but they will be removed from this collection.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCollection(collection.id);
            if (selectedCollectionId === collection.id) {
              onSelectCollection(null);
            }
          },
        },
      ]
    );
  };

  const startEditing = (collection: BookmarkCollection) => {
    setEditingCollection(collection);
    setCollectionName(collection.name);
    setCollectionDescription(collection.description || '');
    setSelectedColor(collection.color || 'blue');
  };

  const cancelEditing = () => {
    setEditingCollection(null);
    setShowCreateForm(false);
    setCollectionName('');
    setCollectionDescription('');
    setSelectedColor('blue');
  };

  const getCollectionColor = (collection: BookmarkCollection) => {
    const colorOption = COLLECTION_COLORS.find((c) => c.id === collection.color);
    return colorOption?.value || colors.info;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Collections</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={exportBookmarkCollections}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={importBookmarkCollections}
            style={styles.headerButton}
          >
            <Text style={styles.headerButtonText}>Import</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Collection List */}
      <ScrollView style={styles.listContainer}>
        {/* All Bookmarks option */}
        <TouchableOpacity
          onPress={() => onSelectCollection(null)}
          style={[
            styles.collectionItem,
            selectedCollectionId === null && styles.selectedCollection,
          ]}
        >
          <View style={styles.collectionIcon}>
            <Text>📁</Text>
          </View>
          <Text
            style={[
              styles.collectionName,
              selectedCollectionId === null && styles.selectedText,
            ]}
          >
            All Bookmarks
          </Text>
        </TouchableOpacity>

        {/* Uncategorized option */}
        <TouchableOpacity
          onPress={() => onSelectCollection('__uncategorized__')}
          style={[
            styles.collectionItem,
            selectedCollectionId === '__uncategorized__' && styles.selectedCollection,
          ]}
        >
          <View style={styles.collectionIcon}>
            <Text>📁</Text>
          </View>
          <Text
            style={[
              styles.collectionName,
              selectedCollectionId === '__uncategorized__' && styles.selectedText,
            ]}
          >
            Uncategorized
          </Text>
        </TouchableOpacity>

        {/* User collections */}
        {collections.map((collection) => (
          <View key={collection.id}>
            <TouchableOpacity
              onPress={() => onSelectCollection(collection.id)}
              style={[
                styles.collectionItem,
                selectedCollectionId === collection.id && styles.selectedCollection,
              ]}
            >
              <View
                style={[
                  styles.colorDot,
                  { backgroundColor: getCollectionColor(collection) },
                ]}
              />
              <View style={styles.collectionInfo}>
                <Text
                  style={[
                    styles.collectionName,
                    selectedCollectionId === collection.id && styles.selectedText,
                  ]}
                >
                  {collection.name}
                </Text>
                {collection.description && (
                  <Text style={styles.collectionDescription}>{collection.description}</Text>
                )}
              </View>
              <Text style={styles.bookmarkCount}>{collection.bookmarkCount}</Text>
              <TouchableOpacity
                onPress={() => startEditing(collection)}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>✏️</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        ))}

        {collections.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No collections yet</Text>
            <Text style={styles.emptyStateSubtext}>
              Create a collection to organize your bookmarks
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Create/Edit Form */}
      {(showCreateForm || editingCollection) && (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {editingCollection ? 'Edit Collection' : 'New Collection'}
          </Text>

          <TextInput
            style={styles.input}
            value={collectionName}
            onChangeText={setCollectionName}
            placeholder="Collection name"
            placeholderTextColor={colors.textSecondary}
            editable={!isCreating && !isUpdating}
          />

          <TextInput
            style={styles.input}
            value={collectionDescription}
            onChangeText={setCollectionDescription}
            placeholder="Description (optional)"
            placeholderTextColor={colors.textSecondary}
            editable={!isCreating && !isUpdating}
          />

          <Text style={styles.colorLabel}>Color</Text>
          <View style={styles.colorPicker}>
            {COLLECTION_COLORS.map((color) => (
              <TouchableOpacity
                key={color.id}
                onPress={() => setSelectedColor(color.id)}
                style={[
                  styles.colorOption,
                  { backgroundColor: color.value },
                  selectedColor === color.id && styles.selectedColorOption,
                ]}
                disabled={isCreating || isUpdating}
              />
            ))}
          </View>

          <View style={styles.formButtons}>
            <TouchableOpacity onPress={cancelEditing} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={editingCollection ? handleUpdateCollection : handleCreateCollection}
              style={[
                styles.submitButton,
                (!collectionName.trim() || isCreating || isUpdating) &&
                  styles.disabledButton,
              ]}
              disabled={!collectionName.trim() || isCreating || isUpdating}
            >
              {isCreating || isUpdating ? (
                <ActivityIndicator color=colors.text />
              ) : (
                <Text style={styles.submitButtonText}>
                  {editingCollection ? 'Save' : 'Create'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {editingCollection && (
            <TouchableOpacity
              onPress={() => handleDeleteCollection(editingCollection)}
              style={styles.deleteButton}
              disabled={isDeleting}
            >
              <Text style={styles.deleteButtonText}>Delete Collection</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Create Button */}
      {!showCreateForm && !editingCollection && (
        <View style={styles.createButtonContainer}>
          <TouchableOpacity
            onPress={() => setShowCreateForm(true)}
            style={styles.createButton}
          >
            <Text style={styles.createButtonText}>+ Create Collection</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: 6,
  },
  headerButtonText: {
    fontSize: 12,
    color: colors.text,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  listContainer: {
    flex: 1,
  },
  collectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectedCollection: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  collectionIcon: {
    marginRight: 12,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: 16,
    color: colors.text,
  },
  selectedText: {
    color: colors.info,
    fontWeight: '600',
  },
  collectionDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  bookmarkCount: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
  },
  editButton: {
    padding: 4,
  },
  editButtonText: {
    fontSize: 16,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  formContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    marginBottom: 12,
  },
  colorLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOption: {
    borderColor: colors.text,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: colors.info,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  deleteButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    color: colors.danger,
  },
  createButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
