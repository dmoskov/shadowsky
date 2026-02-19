import { requireNativeModule } from 'expo-modules-core';

export { default as NativeThreadView } from './src/NativeThreadViewView';

// Module-level functions for sending translation results from JS to native
const NativeThreadViewModule = requireNativeModule('NativeThreadView');

export function setTranslationResult(postUri: string, translatedText: string, sourceLang: string): void {
  NativeThreadViewModule.setTranslationResult(postUri, translatedText, sourceLang);
}

export function setTranslationError(postUri: string, errorMessage: string): void {
  NativeThreadViewModule.setTranslationError(postUri, errorMessage);
}
