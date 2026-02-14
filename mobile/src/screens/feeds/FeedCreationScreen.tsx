import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../../constants/theme';
import {useCreateFeedGenerator} from '../../hooks/api';

export function FeedCreationScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [serviceEndpoint, setServiceEndpoint] = useState('');

  const createFeedMutation = useCreateFeedGenerator();

  const handleCreate = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a feed name');
      return;
    }

    if (!serviceEndpoint.trim()) {
      Alert.alert('Error', 'Please enter a service endpoint URL');
      return;
    }

    try {
      await createFeedMutation.mutateAsync({
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        serviceEndpoint: serviceEndpoint.trim(),
      });

      Alert.alert(
        'Success',
        'Your feed generator has been created!',
        [
          {
            text: 'OK',
            onPress: () => {
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Failed to create feed generator:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create feed generator. Please try again.'
      );
    }
  };

  const handleCancel = () => {
    if (displayName || description || serviceEndpoint) {
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard your changes?',
        [
          {text: 'Keep Editing', style: 'cancel'},
          {text: 'Discard', style: 'destructive', onPress: () => router.back()},
        ]
      );
    } else {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create Custom Feed</Text>
          <Text style={styles.headerSubtitle}>
            Create a custom feed generator to curate content based on your preferences
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>ℹ️ Important</Text>
          <Text style={styles.infoText}>
            Creating a feed generator requires a service endpoint that implements the AT Protocol feed generator API.
            You'll need to host your own feed generator service or use an existing one.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Feed Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Tech News Feed"
              placeholderTextColor=colors.textSecondary
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={100}
              editable={!createFeedMutation.isPending}
            />
            <Text style={styles.helperText}>Choose a descriptive name for your feed</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe what content your feed will show..."
              placeholderTextColor=colors.textSecondary
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
              editable={!createFeedMutation.isPending}
            />
            <Text style={styles.helperText}>
              {description.length}/500 characters
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Service Endpoint <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="https://your-feed-service.com"
              placeholderTextColor=colors.textSecondary
              value={serviceEndpoint}
              onChangeText={setServiceEndpoint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              editable={!createFeedMutation.isPending}
            />
            <Text style={styles.helperText}>
              URL of your feed generator service
            </Text>
          </View>

          <View style={styles.exampleBox}>
            <Text style={styles.exampleTitle}>📖 Example Use Cases:</Text>
            <Text style={styles.exampleText}>• Posts from specific users</Text>
            <Text style={styles.exampleText}>• Posts with certain hashtags</Text>
            <Text style={styles.exampleText}>• Posts containing keywords</Text>
            <Text style={styles.exampleText}>• Posts in specific languages</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, {paddingBottom: insets.bottom || 16}]}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={handleCancel}
          disabled={createFeedMutation.isPending}
          activeOpacity={0.7}>
          <Text style={[styles.buttonText, styles.cancelButtonText]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.createButton, createFeedMutation.isPending && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={createFeedMutation.isPending || !displayName.trim() || !serviceEndpoint.trim()}
          activeOpacity={0.7}>
          {createFeedMutation.isPending ? (
            <ActivityIndicator color=colors.text size="small" />
          ) : (
            <Text style={styles.buttonText}>Create Feed</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'colors.surface',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  form: {
    gap: 20,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  required: {
    color: 'colors.danger',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
  },
  exampleBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  exampleText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  createButton: {
    backgroundColor: colors.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cancelButtonText: {
    color: colors.textSecondary,
  },
});
