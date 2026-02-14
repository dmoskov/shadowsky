import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';
import { exportCollections, importCollections } from '../services/atproto/bookmarks';
import { createLogger } from './logger';

const logger = createLogger('BookmarkCollectionsImportExport');

/**
 * Export bookmark collections to a JSON file
 */
export async function exportBookmarkCollections() {
  try {
    const data = await exportCollections();
    const jsonString = JSON.stringify(data, null, 2);
    const fileName = `bookmark-collections-${Date.now()}.json`;
    const fileUri = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(fileUri, jsonString, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Bookmark Collections',
      });
    } else {
      Alert.alert('Success', `Collections exported to ${fileName}`);
    }

    return true;
  } catch (error) {
    logger.error('Failed to export collections:', error);
    Alert.alert('Error', 'Failed to export bookmark collections');
    return false;
  }
}

/**
 * Import bookmark collections from a JSON file
 */
export async function importBookmarkCollections() {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return false;
    }

    const fileUri = result.assets[0].uri;
    const fileContent = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const data = JSON.parse(fileContent);

    // Validate the data structure
    if (!data.collections || !Array.isArray(data.collections)) {
      Alert.alert('Error', 'Invalid file format. Missing collections array.');
      return false;
    }

    if (!data.mappings || !Array.isArray(data.mappings)) {
      Alert.alert('Error', 'Invalid file format. Missing mappings array.');
      return false;
    }

    // Confirm import
    Alert.alert(
      'Import Collections',
      `This will import ${data.collections.length} collection(s) and ${data.mappings.length} mapping(s). This will not delete existing collections.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            try {
              await importCollections(data);
              Alert.alert('Success', 'Collections imported successfully');
            } catch (error) {
              logger.error('Failed to import collections:', error);
              Alert.alert('Error', 'Failed to import collections');
            }
          },
        },
      ]
    );

    return true;
  } catch (error) {
    logger.error('Failed to import collections:', error);
    Alert.alert('Error', 'Failed to import bookmark collections');
    return false;
  }
}
