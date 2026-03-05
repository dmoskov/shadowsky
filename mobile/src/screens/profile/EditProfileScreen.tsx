import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Avatar } from '../../components/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile, useUpdateProfile } from '../../hooks/api/useProfile';
import { useImagePicker, ImageAsset } from '../../hooks/useImagePicker';
import { ImageEditor } from '../../components/ImageEditor';
import { useTheme } from '../../contexts/ThemeContext';


import { createLogger } from '../../utils/logger';
import {fontSize} from '../../utils/typography';

const logger = createLogger('Editprofilescreenx');
interface EditProfileScreenProps {
  onSave?: () => void;
  onCancel?: () => void;
}

const MAX_DISPLAY_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 256;

export function EditProfileScreen({ onSave, onCancel }: EditProfileScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { account } = useAuth();
  const { data: profile, isLoading } = useProfile(account?.handle || '');
  const updateProfile = useUpdateProfile();
  const { pickFromLibrary, selectedImages, clearImages, addImages } = useImagePicker();

  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | undefined>();

  // Image editor state
  const [imageEditorVisible, setImageEditorVisible] = useState(false);
  const [imagesToEdit, setImagesToEdit] = useState<ImageAsset[]>([]);

  // Initialize form with current profile data
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setDescription(profile.description || '');
      setAvatarUri(profile.avatar);
    }
  }, [profile]);

  // Update avatar URI when an image is selected
  useEffect(() => {
    if (selectedImages.length > 0) {
      setAvatarUri(selectedImages[0].uri);
    }
  }, [selectedImages]);

  const handlePickAvatar = async () => {
    clearImages();
    const images = await pickFromLibrary(false); // Don't skip editor
    if (images && images.length > 0) {
      setImagesToEdit(images);
      setImageEditorVisible(true);
    }
  };

  const handleSaveEditedImages = useCallback((editedImages: Array<{ originalAsset: ImageAsset; editedAsset: ImageAsset }>) => {
    // Use the first edited image as the avatar
    if (editedImages.length > 0) {
      const editedAsset = editedImages[0].editedAsset;
      setAvatarUri(editedAsset.uri);
      // Update the selected images in the picker for upload
      clearImages();
      addImages([editedAsset]);
    }
    setImageEditorVisible(false);
    setImagesToEdit([]);
  }, [clearImages, addImages]);

  const handleCancelImageEditor = useCallback(() => {
    setImageEditorVisible(false);
    setImagesToEdit([]);
  }, []);

  const handleSave = async () => {
    try {
      // Validate display name length
      if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
        Alert.alert('Error', `Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or less.`);
        return;
      }

      // Validate description length
      if (description.length > MAX_DESCRIPTION_LENGTH) {
        Alert.alert('Error', `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`);
        return;
      }

      await updateProfile.mutateAsync({
        displayName: displayName.trim(),
        description: description.trim(),
        avatar: selectedImages.length > 0 ? selectedImages[0].uri : undefined,
      });

      Alert.alert('Success', 'Profile updated successfully!');
      clearImages();
      onSave?.();
    } catch (error) {
      logger.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  const handleCancel = () => {
    clearImages();
    onCancel?.();
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load profile</Text>
        </View>
      </View>
    );
  }

  const displayNameRemaining = MAX_DISPLAY_NAME_LENGTH - displayName.length;
  const descriptionRemaining = MAX_DESCRIPTION_LENGTH - description.length;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardDismissMode="on-drag">
        {/* Avatar Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Avatar</Text>
          <View style={styles.avatarContainer}>
            <Avatar uri={avatarUri} size={96} />
            <TouchableOpacity style={styles.changeAvatarButton} onPress={handlePickAvatar}>
              <Text style={styles.changeAvatarText}>Change Avatar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Display Name Section */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>Display Name</Text>
            <Text
              style={[
                styles.charCount,
                displayNameRemaining < 0 && styles.charCountError,
              ]}
            >
              {displayNameRemaining}
            </Text>
          </View>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter display name"
            placeholderTextColor={colors.textTertiary}
            maxLength={MAX_DISPLAY_NAME_LENGTH + 10} // Allow typing slightly over to show error
          />
        </View>

        {/* Bio/Description Section */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.sectionLabel}>Bio</Text>
            <Text
              style={[
                styles.charCount,
                descriptionRemaining < 0 && styles.charCountError,
              ]}
            >
              {descriptionRemaining}
            </Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Tell us about yourself"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={MAX_DESCRIPTION_LENGTH + 10} // Allow typing slightly over to show error
          />
        </View>

        {/* Handle (read-only) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Handle</Text>
          <Text style={styles.handleText}>@{profile.handle}</Text>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={handleCancel}
          disabled={updateProfile.isPending}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.saveButton,
            (updateProfile.isPending || displayNameRemaining < 0 || descriptionRemaining < 0) &&
              styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={
            updateProfile.isPending || displayNameRemaining < 0 || descriptionRemaining < 0
          }
        >
          {updateProfile.isPending ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Image Editor Modal */}
      <ImageEditor
        visible={imageEditorVisible}
        images={imagesToEdit}
        onSave={handleSaveEditedImages}
        onCancel={handleCancelImageEditor}
      />
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      color: colors.danger,
      fontSize: fontSize.callout,
    },
    section: {
      marginBottom: 24,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.subheadline,
      fontWeight: '600',
      marginBottom: 8,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    charCount: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
    },
    charCountError: {
      color: colors.danger,
    },
    avatarContainer: {
      alignItems: 'center',
      gap: 12,
    },
    changeAvatarButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      backgroundColor: colors.surfaceElevated,
      borderRadius: 8,
    },
    changeAvatarText: {
      color: colors.primary,
      fontSize: fontSize.subheadline,
      fontWeight: '600',
    },
    input: {
      backgroundColor: colors.surfaceElevated,
      color: colors.text,
      fontSize: fontSize.callout,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    textArea: {
      minHeight: 100,
      paddingTop: 12,
    },
    handleText: {
      color: colors.textTertiary,
      fontSize: fontSize.callout,
      padding: 12,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 12,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.surfaceElevated,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    cancelButtonText: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: '600',
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    saveButtonDisabled: {
      backgroundColor: colors.borderLight,
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: '600',
    },
  });
}
