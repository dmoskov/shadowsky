/**
 * EditScheduledPostModal Component
 * Modal for editing scheduled post text and time
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ScheduledPost } from '../services/scheduled-posts';
import { ThemeColors, useTheme } from "../contexts/ThemeContext";
import { AppModal } from "./ui/AppModal";

import { createLogger } from '../utils/logger';
import {fontSize} from '../utils/typography';
import {borderRadius} from '../constants/elevation';
import {fontWeights, spacing} from '../constants/spacing';

const logger = createLogger('Editscheduledpostmodalx');
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
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);

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
      logger.error('Failed to save:', error);
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
    <AppModal
      visible={visible}
      onClose={handleClose}
      title="Edit Scheduled Post"
      maxHeight="80%"
      padded={false}
      closeDisabled={isSaving}
      keyboardShouldPersistTaps="handled"
      footer={
        <>
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
        </>
      }
    >
      <TextInput
        style={styles.input}
        placeholder="What's happening?"
        placeholderTextColor={colors.textTertiary}
        multiline
        autoFocus
        value={text}
        onChangeText={setText}
        editable={!isSaving}
      />

      <View style={styles.charCountContainer}>
        <Text style={[styles.charCount, isOverLimit && styles.charCountOver]}>
          {charCount}/{MAX_POST_LENGTH}
        </Text>
      </View>
    </AppModal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    input: {
      color: colors.text,
      fontSize: fontSize.callout,
      padding: spacing.lg,
      minHeight: 150,
      textAlignVertical: 'top',
    },
    charCountContainer: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },
    charCount: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
      fontWeight: fontWeights.medium,
      textAlign: 'right',
    },
    charCountOver: {
      color: colors.danger,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: borderRadius.medium,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    cancelButton: {
      backgroundColor: colors.surfaceAlt,
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: fontSize.callout,
      fontWeight: fontWeights.semibold,
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    saveButtonDisabled: {
      backgroundColor: colors.surfaceAlt,
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: fontWeights.semibold,
    },
  });
}
