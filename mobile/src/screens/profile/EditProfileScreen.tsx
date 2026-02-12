import React, { useState, useEffect } from 'react';
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
import { useImagePicker } from '../../hooks/useImagePicker';
import { colors } from '../../constants/theme';

interface EditProfileScreenProps {
  onSave?: () => void;
  onCancel?: () => void;
}

const MAX_DISPLAY_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 256;

export function EditProfileScreen({ onSave, onCancel }: EditProfileScreenProps) {
  const { account } = useAuth();
  const { data: profile, isLoading } = useProfile(account?.handle || '');
  const updateProfile = useUpdateProfile();
  const { pickFromLibrary, selectedImages, clearImages } = useImagePicker();

  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | undefined>();

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
    await pickFromLibrary();
  };

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
      console.error('Error updating profile:', error);
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
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
            placeholderTextColor="#6b7280"
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
            placeholderTextColor="#6b7280"
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
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
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
    color: '#ef4444',
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 14,
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
    color: '#6b7280',
    fontSize: 12,
  },
  charCountError: {
    color: '#ef4444',
  },
  avatarContainer: {
    alignItems: 'center',
    gap: 12,
  },
  changeAvatarButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#1f2937',
    borderRadius: 8,
  },
  changeAvatarText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1f2937',
    color: '#ffffff',
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  handleText: {
    color: '#6b7280',
    fontSize: 16,
    padding: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
