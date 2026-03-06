import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import {triggerHaptic} from './haptics';

export async function saveImageToGallery(url: string): Promise<boolean> {
  let permStatus;
  try {
    const result = await MediaLibrary.requestPermissionsAsync();
    permStatus = result.status;
  } catch {
    throw new Error('Failed to request media library permissions');
  }
  if (permStatus !== 'granted') {
    throw new Error('Permission to access media library was denied');
  }

  const filename = url.split('/').pop()?.split('?')[0] || 'image.jpg';
  const localUri = `${FileSystem.cacheDirectory}${filename}`;

  let downloadResult;
  try {
    downloadResult = await FileSystem.downloadAsync(url, localUri);
  } catch {
    throw new Error('Failed to download image');
  }

  try {
    await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
  } catch {
    throw new Error('Failed to save image to gallery');
  }
  triggerHaptic('success');

  // Clean up cached file
  try {
    await FileSystem.deleteAsync(downloadResult.uri, {idempotent: true});
  } catch {
    // Best-effort cleanup
  }

  return true;
}
