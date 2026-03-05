import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {
  useBookmarkCollections,
  useBookmarkInCollections,
} from '../hooks/useBookmarkCollections';
import { COLLECTION_COLORS } from '../services/bookmark-collections';
import { useTheme } from '../contexts/ThemeContext';
import { BlurOverlay } from './BlurOverlay';
import {fontSize} from '../utils/typography';

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <BlurOverlay intensity={25} />
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Save to collection</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardDismissMode="on-drag">
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: fontSize.headline,
      fontWeight: '600',
      color: colors.text,
    },
    closeButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeButtonText: {
      fontSize: fontSize.title3,
      color: colors.textSecondary,
    },
    content: {
      padding: 16,
    },
    emptyText: {
      fontSize: fontSize.subheadline,
      color: colors.textSecondary,
      textAlign: 'center',
      paddingVertical: 16,
    },
    collectionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 8,
      marginBottom: 8,
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 12,
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
      marginTop: 16,
      padding: 16,
      backgroundColor: colors.surface,
      borderRadius: 8,
    },
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: fontSize.subheadline,
      color: colors.text,
      marginBottom: 12,
    },
    colorPicker: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 16,
    },
    colorOption: {
      width: 28,
      height: 28,
      borderRadius: 14,
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
      paddingVertical: 10,
      borderRadius: 8,
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
      borderRadius: 8,
      backgroundColor: colors.info,
      alignItems: 'center',
    },
    disabledButton: {
      opacity: 0.5,
    },
    createButtonText: {
      fontSize: fontSize.subheadline,
      fontWeight: '600',
      color: colors.text,
    },
    newCollectionButton: {
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: 8,
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
