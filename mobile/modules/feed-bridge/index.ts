/**
 * Feed Bridge Expo Module
 *
 * Native module for passing serialized feed data to Swift.
 */

import {NativeModule, requireNativeModule} from 'expo';

export interface FeedBridgeModule extends NativeModule {
  /**
   * Pass serialized feed data to Swift
   * @param jsonData Serialized feed data as JSON string
   */
  updateFeedData(jsonData: string): void;

  /**
   * Pass incremental updates to Swift
   * @param jsonData Serialized batch update as JSON string
   */
  updateFeedIncremental(jsonData: string): void;

  /**
   * Clear feed data in Swift
   */
  clearFeedData(): void;
}

// Export the native module
export default requireNativeModule<FeedBridgeModule>('FeedBridge');
