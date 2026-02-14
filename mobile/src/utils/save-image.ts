import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import {triggerHaptic} from './haptics';

export async function saveImageToGallery(url: string): Promise<boolean> {
  const {status} = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permission to access media library was denied');
  }

  const filename = url.split('/').pop()?.split('?')[0] || 'image.jpg';
  const localUri = `${FileSystem.cacheDirectory}${filename}`;

  const downloadResult = await FileSystem.downloadAsync(url, localUri);

  await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
  triggerHaptic('success');

  // Clean up cached file
  await FileSystem.deleteAsync(downloadResult.uri, {idempotent: true});

  return true;
}
