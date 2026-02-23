import { requireNativeModule } from 'expo-modules-core';

export { default as NativeThreadView } from './src/NativeThreadViewView';

// Module-level functions for sending data from JS to native
const NativeThreadViewModule = requireNativeModule('NativeThreadView');

export function setTranslationResult(postUri: string, translatedText: string, sourceLang: string): void {
  NativeThreadViewModule.setTranslationResult(postUri, translatedText, sourceLang);
}

export function setTranslationError(postUri: string, errorMessage: string): void {
  NativeThreadViewModule.setTranslationError(postUri, errorMessage);
}

export function setMentionSearchResults(resultsJson: string): void {
  NativeThreadViewModule.setMentionSearchResults(resultsJson);
}

export function setReplySent(success: boolean, errorMessage?: string): void {
  NativeThreadViewModule.setReplySent(success, errorMessage ?? null);
}

export function setThreadData(jsonString: string): void {
  if (typeof NativeThreadViewModule.setThreadData === 'function') {
    NativeThreadViewModule.setThreadData(jsonString);
  }
}

export function clearThreadData(): void {
  if (typeof NativeThreadViewModule.clearThreadData === 'function') {
    NativeThreadViewModule.clearThreadData();
  }
}
