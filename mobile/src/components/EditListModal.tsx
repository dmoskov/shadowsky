/**
 * EditListModal Component
 * Modal for editing list name, description, and avatar
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import {AppBskyGraphDefs} from '@atproto/api';
import {colors} from '../constants/theme';

const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 300;

interface EditListModalProps {
  visible: boolean;
  list: AppBskyGraphDefs.ListView | null;
  onClose: () => void;
  onSave: (updates: {
    name: string;
    description: string;
  }) => Promise<void>;
}

export function EditListModal({
  visible,
  list,
  onClose,
  onSave,
}: EditListModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (list) {
      setName(list.name);
      setDescription(list.description || '');
    }
  }, [list]);

  const handleSave = async () => {
    if (!name.trim() || name.length > MAX_NAME_LENGTH || isSaving) {
      return;
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return;
    }

    try {
      setIsSaving(true);
      await onSave({
        name: name.trim(),
        description: description.trim(),
      });
      onClose();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update list'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setName(list?.name || '');
      setDescription(list?.description || '');
      onClose();
    }
  };

  const nameCharCount = name.length;
  const descCharCount = description.length;
  const isNameOverLimit = nameCharCount > MAX_NAME_LENGTH;
  const isDescOverLimit = descCharCount > MAX_DESCRIPTION_LENGTH;
  const isSaveDisabled =
    !name.trim() || isNameOverLimit || isDescOverLimit || isSaving;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit List</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSaving}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Text style={[styles.closeButton, isSaving && styles.disabledText]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {/* Avatar Section - Coming Soon */}
            {list?.avatar && (
              <View style={styles.avatarSection}>
                <Image source={{uri: list.avatar}} style={styles.avatar} />
                <Text style={styles.avatarNote}>
                  Avatar editing coming soon
                </Text>
              </View>
            )}

            {/* Name Input */}
            <View style={styles.inputSection}>
              <Text style={styles.label}>List Name</Text>
              <TextInput
                style={[styles.input, isNameOverLimit && styles.inputError]}
                placeholder="Enter list name"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                maxLength={MAX_NAME_LENGTH + 10}
                editable={!isSaving}
                autoCapitalize="sentences"
              />
              <View style={styles.charCountContainer}>
                <Text
                  style={[
                    styles.charCount,
                    isNameOverLimit && styles.charCountError,
                  ]}>
                  {nameCharCount} / {MAX_NAME_LENGTH}
                </Text>
              </View>
            </View>

            {/* Description Input */}
            <View style={styles.inputSection}>
              <Text style={styles.label}>Description (Optional)</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  isDescOverLimit && styles.inputError,
                ]}
                placeholder="Enter list description"
                placeholderTextColor={colors.textTertiary}
                value={description}
                onChangeText={setDescription}
                maxLength={MAX_DESCRIPTION_LENGTH + 10}
                multiline
                numberOfLines={4}
                editable={!isSaving}
                autoCapitalize="sentences"
              />
              <View style={styles.charCountContainer}>
                <Text
                  style={[
                    styles.charCount,
                    isDescOverLimit && styles.charCountError,
                  ]}>
                  {descCharCount} / {MAX_DESCRIPTION_LENGTH}
                </Text>
              </View>
            </View>

            {/* Purpose Info */}
            {list && (
              <View style={styles.infoSection}>
                <Text style={styles.infoLabel}>List Type</Text>
                <Text style={styles.infoValue}>
                  {list.purpose === 'app.bsky.graph.defs#curatelist'
                    ? 'Curate List'
                    : 'Mod List'}
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isSaving}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, isSaveDisabled && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={isSaveDisabled}>
              {isSaving ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceAlt,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    color: colors.textSecondary,
    fontSize: 24,
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.5,
  },
  content: {
    padding: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
  },
  avatarNote: {
    color: colors.textTertiary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  inputSection: {
    marginBottom: 20,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.text,
    fontSize: 16,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  inputError: {
    borderColor: colors.danger,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCountContainer: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  charCount: {
    color: colors.textTertiary,
    fontSize: 12,
  },
  charCountError: {
    color: colors.danger,
  },
  infoSection: {
    backgroundColor: colors.surfaceAlt,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  infoLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  cancelButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
