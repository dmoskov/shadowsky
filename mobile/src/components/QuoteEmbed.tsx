import React, {useMemo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {AppBskyEmbedRecord, AppBskyFeedPost, AppBskyRichtextFacet} from '@atproto/api';
import {Avatar} from './Avatar';
import {RichText} from '../utils/rich-text';
import {useTheme} from '../contexts/ThemeContext';

interface QuoteEmbedProps {
  record: any;
  onPress?: (uri: string, handle: string) => void;
}

export function QuoteEmbed({record, onPress}: QuoteEmbedProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
          text={postRecord.text as string}
          facets={postRecord.facets as AppBskyRichtextFacet.Main[] | undefined}
          style={styles.text}
          numberOfLines={6}
        />
      )}
    </TouchableOpacity>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      marginTop: 8,
      marginBottom: 8,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.surfaceElevated,
      backgroundColor: colors.background,
    },
    notFoundContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    notFoundText: {
      color: colors.textTertiary,
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
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    handle: {
      color: colors.textTertiary,
      fontSize: 13,
    },
    text: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 18,
    },
  });
}
