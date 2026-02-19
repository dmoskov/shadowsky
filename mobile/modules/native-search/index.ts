import { requireNativeModule } from 'expo-modules-core';

export { default as NativeSearchView } from './src/NativeSearchView';
export type { NativeSearchViewProps } from './src/NativeSearchView';

// Module-level functions for sending data from JS to native
const NativeSearchModule = requireNativeModule('NativeSearch');

export function setSearchResults(resultsJson: string): void {
  NativeSearchModule.setSearchResults(resultsJson);
}

export function setTrendingData(trendingJson: string): void {
  NativeSearchModule.setTrendingData(trendingJson);
}

export function setSearchHistory(historyJson: string): void {
  NativeSearchModule.setSearchHistory(historyJson);
}
