import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {AppBskyEmbedRecord, AppBskyFeedPost} from '@atproto/api';
import {Avatar} from './Avatar';
import {RichText} from '../utils/rich-text';

interface QuoteEmbedProps {
  record: any;
  onPress?: (uri: string, handle: string) => void;
}

export function QuoteEmbed({record, onPress}: QuoteEmbedProps) {
  // Handle deleted/blocked/not-found posts
  if (!record || record.$type !== 'app.bsky.embed.record#viewRecord') {
    return (
      <View style={[styles.container, styles.notFoundContainer]}>
        <Text style={styles.notFoundText}>[Post not found]</Text>
      </View>
    );
  }

  const quotedPost = record as AppBskyEmbedRecord.ViewRecord;
  const author = quotedPost.author;

  // Type guard for the value/record
  const postRecord = AppBskyFeedPost.isRecord(quotedPost.value)
    ? quotedPost.value
    : undefined;

  const handlePress = () => {
    if (onPress && quotedPost.uri && author.handle) {
      onPress(quotedPost.uri, author.handle);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      activeOpacity={0.8}>
      <View style={styles.header}>
        <Avatar uri={author.avatar} size={20} />
        <View style={styles.authorInfo}>
          <Text style={styles.displayName} numberOfLines={1}>
            {author.displayName || author.handle}
          </Text>
          <Text style={styles.handle} numberOfLines={1}>
            @{author.handle}
          </Text>
        </View>
      </View>
      {postRecord && (
        <RichText
          text={postRecord.text}
          facets={postRecord.facets}
          style={styles.text}
          numberOfLines={3}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#0f1419',
  },
  notFoundContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  notFoundText: {
    color: '#6b7280',
    fontSize: 14,
    fontStyle: 'italic',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  authorInfo: {
    flex: 1,
    marginLeft: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  handle: {
    color: '#6b7280',
    fontSize: 13,
  },
  text: {
    color: '#e5e7eb',
    fontSize: 14,
    lineHeight: 18,
  },
});
