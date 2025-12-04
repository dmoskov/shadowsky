import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type {TabScreenPropsType} from '../../types/navigation';

type Props = TabScreenPropsType<'Compose'>;

export function ComposeScreen({navigation}: Props) {
  const handleClose = () => {
    navigation.goBack();
  };

  const handlePost = () => {
    // TODO: Implement post creation
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.postButton} onPress={handlePost}>
          <Text style={styles.postButtonText}>Post</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.input}
        placeholder="What's happening?"
        placeholderTextColor="#6b7280"
        multiline
        autoFocus
      />

      <View style={styles.toolbar}>
        <Text style={styles.toolbarText}>Image | GIF | Poll | Thread</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  cancelButton: {
    color: '#9ca3af',
    fontSize: 16,
  },
  postButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 18,
    padding: 16,
    textAlignVertical: 'top',
  },
  toolbar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  toolbarText: {
    color: '#6b7280',
    fontSize: 14,
  },
});
