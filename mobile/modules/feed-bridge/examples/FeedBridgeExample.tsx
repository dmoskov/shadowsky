/**
 * Feed Bridge Example
 *
 * Demonstrates how to use the feed bridge to pass data to Swift
 */

import React, {useEffect} from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTimeline} from '../../../src/hooks/api/useFeed';
import {useNetworkStatus} from '../../../src/hooks/useNetworkStatus';
import {useOfflineFeedEnhancer} from '../../../src/hooks/useOfflineFeed';
import {useCompleteFeedSerializer} from '../../../src/services/feed-bridge';
import FeedBridge from '../index';

/**
 * Example 1: Basic Feed Serialization
 */
export function BasicFeedBridgeExample() {
  const timeline = useTimeline();

  const {serializedJSON} = useCompleteFeedSerializer(timeline, {
    isOnline: true,
  });

  useEffect(() => {
    if (serializedJSON) {
      console.log('Sending feed data to Swift...');
      FeedBridge.updateFeedData(serializedJSON);
    }
  }, [serializedJSON]);

  return (
    <View style={styles.container}>
      <Text>Feed data is being passed to Swift</Text>
      <Text style={styles.status}>
        Posts loaded: {timeline.data?.pages.flatMap(p => p.feed).length ?? 0}
      </Text>
    </View>
  );
}

/**
 * Example 2: With Incremental Updates
 */
export function IncrementalUpdateExample() {
  const timeline = useTimeline();

  const {serializedJSON} = useCompleteFeedSerializer(timeline, {
    isOnline: true,
    onIncrementalUpdate: update => {
      console.log('Sending incremental update to Swift:', update.updates.length, 'posts');
      const json = JSON.stringify(update);
      FeedBridge.updateFeedIncremental(json);
    },
  });

  useEffect(() => {
    if (serializedJSON) {
      FeedBridge.updateFeedData(serializedJSON);
    }
  }, [serializedJSON]);

  return (
    <View style={styles.container}>
      <Text>Feed with incremental updates</Text>
    </View>
  );
}

/**
 * Example 3: With Offline Support
 */
export function OfflineFeedExample() {
  const {isConnected} = useNetworkStatus();
  const timeline = useTimeline();
  const enhancedQuery = useOfflineFeedEnhancer(timeline, 'timeline');

  const {serializedJSON} = useCompleteFeedSerializer(enhancedQuery, {
    isOnline: isConnected,
    isFromCache: enhancedQuery.isServingCached,
    onIncrementalUpdate: update => {
      if (isConnected) {
        const json = JSON.stringify(update);
        FeedBridge.updateFeedIncremental(json);
      }
    },
  });

  useEffect(() => {
    if (serializedJSON) {
      FeedBridge.updateFeedData(serializedJSON);
    }
  }, [serializedJSON]);

  return (
    <View style={styles.container}>
      <Text>Feed with offline support</Text>
      <Text style={styles.status}>
        Status: {isConnected ? 'Online' : 'Offline'}
        {enhancedQuery.isServingCached && ' (Cached)'}
      </Text>
    </View>
  );
}

/**
 * Example 4: With Bookmarks
 */
export function BookmarkedFeedExample() {
  const timeline = useTimeline();
  // In a real app, you'd get bookmarks from your bookmark service
  const bookmarkedPostUris = new Set<string>([
    // Example URIs
  ]);

  const {serializedJSON} = useCompleteFeedSerializer(timeline, {
    isOnline: true,
    bookmarkedPostUris,
    onIncrementalUpdate: update => {
      const json = JSON.stringify(update);
      FeedBridge.updateFeedIncremental(json);
    },
  });

  useEffect(() => {
    if (serializedJSON) {
      FeedBridge.updateFeedData(serializedJSON);
    }
  }, [serializedJSON]);

  return (
    <View style={styles.container}>
      <Text>Feed with bookmark state</Text>
      <Text style={styles.status}>Bookmarks: {bookmarkedPostUris.size}</Text>
    </View>
  );
}

/**
 * Example 5: Custom Feed
 */
export function CustomFeedExample({feedUri}: {feedUri: string}) {
  const customFeed = useCustomFeed(feedUri);

  const {serializedJSON} = useCompleteFeedSerializer(customFeed, {
    isOnline: true,
  });

  useEffect(() => {
    if (serializedJSON) {
      FeedBridge.updateFeedData(serializedJSON);
    }
  }, [serializedJSON]);

  return (
    <View style={styles.container}>
      <Text>Custom feed: {feedUri}</Text>
    </View>
  );
}

/**
 * Example 6: Cleanup on unmount
 */
export function FeedWithCleanup() {
  const timeline = useTimeline();

  const {serializedJSON} = useCompleteFeedSerializer(timeline, {
    isOnline: true,
  });

  useEffect(() => {
    if (serializedJSON) {
      FeedBridge.updateFeedData(serializedJSON);
    }
  }, [serializedJSON]);

  useEffect(() => {
    // Clear feed data when component unmounts
    return () => {
      console.log('Clearing feed data in Swift');
      FeedBridge.clearFeedData();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text>Feed with cleanup</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  status: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
});

// Import useCustomFeed for the example
import {useCustomFeed} from '../../../src/hooks/api/useFeed';
