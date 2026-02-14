import React, {useState} from 'react';
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
import {useCreateList} from '../../hooks/api';
import {useAppNavigation} from '../../hooks/useNavigation';
import {colors} from '../../constants/theme';

interface CreateListScreenProps {
  onSuccess?: () => void;
}

export function CreateListScreen({onSuccess}: CreateListScreenProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState<'curatelist' | 'modlist'>('curatelist');
  const {mutateAsync: createList, isPending} = useCreateList();
  const {goBack} = useAppNavigation();

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a list name');
      return;
    }

    try {
      const purposeValue = `app.bsky.graph.defs#${purpose}`;
      await createList({
        name: name.trim(),
        description: description.trim() || undefined,
        purpose: purposeValue,
      });

      Alert.alert('Success', 'List created successfully', [
        {
          text: 'OK',
          onPress: () => {
            if (onSuccess) {
              onSuccess();
            } else {
              goBack();
            }
          },
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create list'
      );
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>List Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter list name"
            placeholderTextColor={colors.textTertiary}
            maxLength={64}
            editable={!isPending}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Enter list description (optional)"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            maxLength={300}
            editable={!isPending}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Purpose</Text>
          <Text style={styles.helperText}>
            Curate lists are for organizing content. Mod lists are for moderation.
          </Text>
          <View style={styles.purposeContainer}>
            <TouchableOpacity
              style={[
                styles.purposeOption,
                purpose === 'curatelist' && styles.purposeOptionSelected,
              ]}
              onPress={() => setPurpose('curatelist')}
              disabled={isPending}>
              <View style={styles.radioButton}>
                {purpose === 'curatelist' && <View style={styles.radioButtonSelected} />}
              </View>
              <View style={styles.purposeTextContainer}>
                <Text style={styles.purposeTitle}>Curate List</Text>
                <Text style={styles.purposeDescription}>
                  Organize and share content from specific users
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.purposeOption,
                purpose === 'modlist' && styles.purposeOptionSelected,
              ]}
              onPress={() => setPurpose('modlist')}
              disabled={isPending}>
              <View style={styles.radioButton}>
                {purpose === 'modlist' && <View style={styles.radioButtonSelected} />}
              </View>
              <View style={styles.purposeTextContainer}>
                <Text style={styles.purposeTitle}>Mod List</Text>
                <Text style={styles.purposeDescription}>
                  Create a moderation list to block or mute users
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.createButton, isPending && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={isPending}>
          {isPending ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.createButtonText}>Create List</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={goBack}
          disabled={isPending}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    color: colors.text,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  purposeContainer: {
    gap: 12,
  },
  purposeOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: 8,
  },
  purposeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.textTertiary,
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  purposeTextContainer: {
    flex: 1,
  },
  purposeTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  purposeDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  createButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelButtonText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
});
