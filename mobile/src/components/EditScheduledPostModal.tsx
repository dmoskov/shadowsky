/**
 * EditScheduledPostModal Component
 * Modal for editing scheduled post text and time
 */

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { ScheduledPost } from '../services/scheduled-posts';
import { colors } from '../constants/theme';

const MAX_POST_LENGTH = 300;

interface EditScheduledPostModalProps {
  visible: boolean;
  post: ScheduledPost | null;
  onClose: () => void;
  onSave: (text: string) => Promise<void>;
}

export function EditScheduledPostModal({
  visible,
  post,
  onClose,
  onSave,
}: EditScheduledPostModalProps) {
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (post) {
      setText(post.text);
    }
  }, [post]);

  const handleSave = async () => {
    if (!text.trim() || text.length > MAX_POST_LENGTH || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      await onSave(text.trim());
      onClose();
    } catch (error) {
      // Error handling could be improved with a toast or alert
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      setText(post?.text || '');
      onClose();
    }
  };

  const charCount = text.length;
  const isOverLimit = charCount > MAX_POST_LENGTH;
  const isSaveDisabled = !text.trim() || isOverLimit || isSaving;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Scheduled Post</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSaving}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.closeButton, isSaving && styles.disabledText]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            <TextInput
              style={styles.input}
              placeholder="What's happening?"
              placeholderTextColor=colors.textTertiary
              multiline
              autoFocus
              value={text}
              onChangeText={setText}
              editable={!isSaving}
            />

            <View style={styles.footer}>
              <Text style={[styles.charCount, isOverLimit && styles.charCountOver]}>
                {charCount}/{MAX_POST_LENGTH}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isSaving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, isSaveDisabled && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaveDisabled}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    color: colors.textSecondary,
    fontSize: 24,
    fontWeight: '300',
  },
  disabledText: {
    opacity: 0.5,
  },
  content: {
    flex: 1,
  },
  input: {
    color: colors.text,
    fontSize: 16,
    padding: 16,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  charCount: {
    color: colors.textTertiary,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  charCountOver: {
    color: colors.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelButton: {
    backgroundColor: colors.surface,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    backgroundColor: 'colors.surface',
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
