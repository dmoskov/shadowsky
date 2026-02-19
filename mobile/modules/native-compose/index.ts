import { requireNativeModule } from 'expo-modules-core';

export { default as NativeComposeView } from './src/NativeComposeView';
export type { NativeComposeViewProps } from './src/NativeComposeView';

// Module-level functions for sending data from JS to native
const NativeComposeModule = requireNativeModule('NativeCompose');

export function setMentionSearchResults(resultsJson: string): void {
  NativeComposeModule.setMentionSearchResults(resultsJson);
}

export function setGeneratedAltText(index: number, altText: string): void {
  NativeComposeModule.setGeneratedAltText(index, altText);
}

export function setPostResult(success: boolean, errorMessage?: string): void {
  NativeComposeModule.setPostResult(success, errorMessage ?? null);
}
