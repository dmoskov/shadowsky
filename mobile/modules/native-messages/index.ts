import { requireNativeModule } from 'expo-modules-core';

export {
  NativeMessages,
  NativeMessagesView,
} from './src/NativeMessagesView';
export type {
  NativeMessagesProps,
  MessagesViewEvents,
  NativeMessagesHandle,
} from './src/NativeMessagesView';

// Module-level functions for sending data from JS to native
const NativeMessagesModule = requireNativeModule('NativeMessages');

export function updateConversations(conversationsJson: string): void {
  NativeMessagesModule.updateConversations(conversationsJson);
}

export function updateMessages(messagesJson: string): void {
  NativeMessagesModule.updateMessages(messagesJson);
}

export function setMessageSent(success: boolean, errorMessage?: string): void {
  NativeMessagesModule.setMessageSent(success, errorMessage ?? null);
}

export function updateSearchResults(searchResultsJson: string): void {
  NativeMessagesModule.updateSearchResults(searchResultsJson);
}

export function clearData(): void {
  NativeMessagesModule.clearData();
}
