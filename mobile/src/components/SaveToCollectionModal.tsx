import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  useBookmarkCollections,
  useBookmarkInCollections,
} from '../hooks/useBookmarkCollections';
import { COLLECTION_COLORS } from '../services/bookmark-collections';
import { ThemeColors, useTheme } from '../contexts/ThemeContext';
import { AppModal } from './ui/AppModal';
import {fontSize} from '../utils/typography';
import {borderRadius} from '../constants/elevation';
import {fontWeights, spacing} from '../constants/spacing';

interface SaveToCollectionModalProps {
  visible: boolean;
  postUri: string;
  onClose: () => void;
}

function SaveToCollectionModalInner({
  visible,
  postUri,
  onClose,
}: SaveToCollectionModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [selectedColor, setSelectedColor] = useState('blue');

  const {
    collections,
    createCollection,
    addToCollection,
    removeFromCollection,
    isCreating,
  } = useBookmarkCollections();

  const { collectionIds } = useBookmarkInCollections(postUri);

  const handleToggleCollection = async (collectionId: string) => {
    const isInCollection = collectionIds.includes(collectionId);

    if (isInCollection) {
      await removeFromCollection(postUri, collectionId);
    } else {
      await addToCollection(postUri, collectionId);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return;

    const collection = await createCollection({
      name: newCollectionName.trim(),
      color: selectedColor,
    });

    // Add the bookmark to the new collection
    await addToCollection(postUri, collection.id);

    setNewCollectionName('');
    setShowNewCollectionForm(false);
    setSelectedColor('blue');
  };

  const getCollectionColor = (colorId: string) => {
    const colorOption = COLLECTION_COLORS.find((c) => c.id === colorId);
    return colorOption?.value || colors.info;
  };

  return (
    <AppModal
      visible={visible}
      onClose={onClose}
      title="Save to collection"
      maxHeight="80%"
      keyboardDismissMode="on-drag">
      {collections.length === 0 && !showNewCollectionForm && (
        <Text style={styles.emptyText}>No collections yet</Text>
      )}

      {collections.map((collection) => (
        <TouchableOpacity
          key={collection.id}
          onPress={() => handleToggleCollection(collection.id)}
          style={styles.collectionItem}
        >
          <View
            style={[
              styles.colorDot,
              { backgroundColor: getCollectionColor(collection.color || 'blue') },
            ]}
          />
          <Text style={styles.collectionName}>{collection.name}</Text>
          {collectionIds.includes(collection.id) && (
            <Text style={styles.checkMark}>✓</Text>
          )}
        </TouchableOpacity>
      ))}

      {showNewCollectionForm ? (
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            value={newCollectionName}
            onChangeText={setNewCollectionName}
            placeholder="Collection name"
            placeholderTextColor={colors.textSecondary}
            autoFocus
            editable={!isCreating}
          />

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
              />
            ))}
          </View>

          <View style={styles.formButtons}>
            <TouchableOpacity
              onPress={() => setShowNewCollectionForm(false)}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleCreateCollection}
              style={[
                styles.createButton,
                (!newCollectionName.trim() || isCreating) && styles.disabledButton,
              ]}
              disabled={!newCollectionName.trim() || isCreating}
            >
              {isCreating ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={styles.createButtonText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={() => setShowNewCollectionForm(true)}
          style={styles.newCollectionButton}
        >
          <Text style={styles.newCollectionButtonText}>+ New collection</Text>
        </TouchableOpacity>
      )}
    </AppModal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    emptyText: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    collectionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: borderRadius.medium,
      marginBottom: spacing.sm,
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: spacing.md,
    },
    collectionName: {
      flex: 1,
      fontSize: fontSize.callout,
      color: colors.text,
    },
    checkMark: {
      fontSize: fontSize.headline,
      color: colors.success,
    },
    formContainer: {
      marginTop: spacing.lg,
      padding: spacing.lg,
      backgroundColor: colors.surfaceAlt,
      borderRadius: borderRadius.medium,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      fontSize: fontSize.subheadline,
      color: colors.text,
      marginBottom: spacing.md,
    },
    colorPicker: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.lg,
    },
    colorOption: {
      width: 28,
      height: 28,
      borderRadius: 14,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    selectedColorOption: {
      borderColor: colors.text,
    },
    formButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      alignItems: 'center',
    },
    cancelButtonText: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
    },
    createButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.info,
      alignItems: 'center',
    },
    disabledButton: {
      opacity: 0.5,
    },
    createButtonText: {
      fontSize: fontSize.subheadline,
      fontWeight: fontWeights.semibold,
      color: colors.text,
    },
    newCollectionButton: {
      marginTop: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.medium,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      alignItems: 'center',
    },
    newCollectionButtonText: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
    },
  });
}

export const SaveToCollectionModal = React.memo(SaveToCollectionModalInner);
