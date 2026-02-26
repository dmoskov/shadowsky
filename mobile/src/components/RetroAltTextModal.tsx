import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {Image} from 'expo-image';
import {useTheme} from '../contexts/ThemeContext';
import {generateAltTextFromUrl} from '../services/ai-service';
import {updatePostAltText} from '../services/atproto/post-editor';
import {createLogger} from '../utils/logger';

const logger = createLogger('RetroAltTextModal');

export interface RetroAltTextModalProps {
  visible: boolean;
  onClose: () => void;
  imageUrl: string;
  imageIndex: number;
  postUri: string;
  initialAltText?: string;
  onAltTextSaved?: (index: number, altText: string) => void;
}

function RetroAltTextModalInner({
  visible,
  onClose,
  imageUrl,
  imageIndex,
  postUri,
  initialAltText = '',
  onAltTextSaved,
}: RetroAltTextModalProps) {
  const {colors} = useTheme();
  const [altText, setAltText] = useState(initialAltText);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setAltText(initialAltText);
    }
  }, [visible, initialAltText]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    try {
      const generated = await generateAltTextFromUrl(imageUrl);
      setAltText(generated);
    } catch (error: any) {
      Alert.alert(
        'Generation Failed',
        error.message || 'Could not generate alt text. Please try again.',
      );
    } finally {
      setIsGenerating(false);
    }
  }, [imageUrl]);

  const handleSave = useCallback(async () => {
    if (!altText.trim()) {
      Alert.alert('Empty Alt Text', 'Please enter or generate alt text before saving.');
      return;
    }

    setIsSaving(true);
    try {
      await updatePostAltText(postUri, {[imageIndex]: altText.trim()});
      onAltTextSaved?.(imageIndex, altText.trim());
      onClose();
    } catch (error: any) {
      logger.error('Failed to save alt text:', error);
      Alert.alert(
        'Save Failed',
        error.message || 'Could not update the post. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [altText, postUri, imageIndex, onAltTextSaved, onClose]);

  const charCount = altText.length;
  const isOverLimit = charCount > 1000;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.content, {backgroundColor: colors.background}]}>
          <View style={styles.header}>
            <Text style={[styles.title, {color: colors.text}]}>
              Add Alt Text
            </Text>
            <TouchableOpacity onPress={onClose} disabled={isSaving}>
              <Text
                style={[
                  styles.closeButton,
                  {color: colors.textSecondary},
                ]}>
                {'\u00D7'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, {color: colors.textSecondary}]}>
            Describe this image for people who are blind or have low vision.
          </Text>

          <Image
            source={{uri: imageUrl}}
            style={[
              styles.imagePreview,
              {backgroundColor: colors.surfaceElevated},
            ]}
            contentFit="contain"
            cachePolicy="memory-disk"
          />

          <TouchableOpacity
            style={[
              styles.generateButton,
              {backgroundColor: colors.surfaceElevated},
              isGenerating && styles.generateButtonDisabled,
            ]}
            onPress={handleGenerate}
            disabled={isGenerating || isSaving}>
            {isGenerating ? (
              <>
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={styles.spinner}
                />
                <Text style={[styles.generateButtonText, {color: colors.text}]}>
                  Generating...
                </Text>
              </>
            ) : (
              <Text style={[styles.generateButtonText, {color: colors.text}]}>
                Generate with AI
              </Text>
            )}
          </TouchableOpacity>

          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.surfaceElevated,
                color: colors.text,
              },
            ]}
            placeholder="Describe this image..."
            placeholderTextColor={colors.textTertiary}
            multiline
            value={altText}
            onChangeText={setAltText}
            maxLength={1000}
            editable={!isSaving}
          />

          <View style={styles.charCountRow}>
            <Text
              style={[
                styles.charCount,
                {color: isOverLimit ? colors.danger : colors.textTertiary},
              ]}>
              {charCount}/1000
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.saveButton,
              {backgroundColor: colors.primary},
              (isSaving || isOverLimit || !altText.trim()) &&
                styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={isSaving || isOverLimit || !altText.trim()}>
            {isSaving ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <Text style={[styles.saveButtonText, {color: colors.text}]}>
                Save Alt Text
              </Text>
            )}
          </TouchableOpacity>
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
  content: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 32,
    lineHeight: 32,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 12,
  },
  generateButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    flexDirection: 'row',
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  spinner: {
    marginRight: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCountRow: {
    alignItems: 'flex-end',
    marginTop: 4,
    marginBottom: 12,
  },
  charCount: {
    fontSize: 12,
  },
  saveButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export const RetroAltTextModal = React.memo(RetroAltTextModalInner);
