import { requireNativeModule } from 'expo-modules-core';

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

export function setTypeaheadResults(resultsJson: string): void {
  NativeSearchModule.setTypeaheadResults(resultsJson);
}
