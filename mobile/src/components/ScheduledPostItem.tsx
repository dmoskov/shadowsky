/**
 * ScheduledPostItem Component
 * Displays a scheduled post with edit/delete actions
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ScheduledPost } from '../services/scheduled-posts';

const MAX_POST_LENGTH = 300;

interface ScheduledPostItemProps {
  post: ScheduledPost;
  onEdit: (post: ScheduledPost) => void;
  onDelete: (post: ScheduledPost) => void;
}

export function ScheduledPostItem({ post, onEdit, onDelete }: ScheduledPostItemProps) {
  const formatScheduledTime = (date: Date): string => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (diff < 0) {
      return 'Overdue';
    } else if (hours < 1) {
      return `in ${minutes} min${minutes !== 1 ? 's' : ''}`;
    } else if (hours < 24) {
      return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      // Format as date and time
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  };

  const charCount = post.text.length;
  const isOverLimit = charCount > MAX_POST_LENGTH;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.scheduledInfo}>
          <Text style={styles.scheduledLabel}>Scheduled</Text>
          <Text style={styles.scheduledTime}>{formatScheduledTime(post.scheduledTime)}</Text>
        </View>
        <Text style={[styles.charCount, isOverLimit && styles.charCountOver]}>
          {charCount}/{MAX_POST_LENGTH}
        </Text>
      </View>

      <Text style={styles.text} numberOfLines={5}>
        {post.text}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onEdit(post)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => onDelete(post)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.actionButtonText, styles.deleteButtonText]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a24',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a38',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scheduledInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scheduledLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '500',
  },
  scheduledTime: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  charCount: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
  charCountOver: {
    color: '#ef4444',
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#2a2a38',
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  deleteButtonText: {
    color: '#ef4444',
  },
});
