/**
 * EditPostModal - Edit the text of one of your own posts.
 *
 * Scoped to text deliberately: embeds, reply references and every other field
 * carry over untouched, which is what the realistic case — a typo caught right
 * after posting — actually needs.
 *
 * The cost of an edit is disclosed rather than used to block one. Editing zeroes
 * the AppView's engagement counters permanently (they increment from zero
 * afterwards and never backfill), so the honest thing is to say what will stop
 * being counted and let the author decide. Quotes get a distinct warning: unlike
 * the counters, that cost is not proportional to how recent the post is.
 */

import { AppBskyFeedDefs, RichText } from '@atproto/api';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { borderRadius } from '../constants/elevation';
import { fontWeights, spacing } from '../constants/spacing';
import { ThemeColors, useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useEditPost } from '../hooks/api/usePosts';
import { canEditPost, describeEditCost } from '../services/atproto/post-edit';
import { createLogger } from '../utils/logger';
import { fontSize } from '../utils/typography';
import { AppModal } from './ui/AppModal';

const logger = createLogger('EditPostModal');

const MAX_GRAPHEMES = 300;

interface EditPostModalProps {
  visible: boolean;
  post: AppBskyFeedDefs.PostView | null;
  /** Viewer's DID — the edit window only applies to your own posts. */
  currentUserDid?: string;
  onClose: () => void;
  /** Fired after a successful edit so the caller can refresh its own copy. */
  onEdited?: (result: { uri: string; text: string }) => void;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0
    ? `${minutes}m ${String(seconds).padStart(2, '0')}s`
    : `${seconds}s`;
}

/** Human-readable list of what will stop being counted elsewhere. */
function describeUncounted(cost: {
  likeCount: number;
  repostCount: number;
  replyCount: number;
}): string {
  return [
    cost.likeCount > 0 &&
      `${cost.likeCount} like${cost.likeCount === 1 ? '' : 's'}`,
    cost.repostCount > 0 &&
      `${cost.repostCount} repost${cost.repostCount === 1 ? '' : 's'}`,
    cost.replyCount > 0 &&
      `${cost.replyCount} repl${cost.replyCount === 1 ? 'y' : 'ies'}`,
  ]
    .filter(Boolean)
    .join(', ');
}

export function EditPostModal({
  visible,
  post,
  currentUserDid,
  onClose,
  onEdited,
}: EditPostModalProps) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const editMutation = useEditPost();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const originalText = ((post?.record as { text?: string })?.text ?? '').trim();
  const [text, setText] = useState(originalText);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Reset to the post's current text whenever the sheet is (re)opened.
  useEffect(() => {
    if (visible) {
      setText(originalText);
      setError(null);
      setNow(new Date());
    }
  }, [visible, originalText]);

  // Tick only while open, so a closed sheet costs nothing. This is also what
  // makes the window lapsing while the sheet is open take effect: `eligibility`
  // recomputes each second and the editor is replaced by the expiry notice.
  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [visible]);

  const eligibility = useMemo(
    () =>
      post
        ? canEditPost({ post, viewerDid: currentUserDid, now })
        : { allowed: false as const, remainingMs: 0 },
    [post, currentUserDid, now],
  );

  const cost = useMemo(
    () => (post ? describeEditCost(post) : null),
    [post],
  );

  const graphemeLength = useMemo(
    () => new RichText({ text }).graphemeLength,
    [text],
  );

  const trimmed = text.trim();
  const isUnchanged = trimmed === originalText;
  const isEmpty = trimmed.length === 0;
  const isTooLong = graphemeLength > MAX_GRAPHEMES;
  const canSave =
    eligibility.allowed && !isSaving && !isUnchanged && !isEmpty && !isTooLong;

  const handleClose = useCallback(() => {
    if (!isSaving) onClose();
  }, [isSaving, onClose]);

  const handleSave = useCallback(async () => {
    if (!post || !canSave) return;

    setIsSaving(true);
    setError(null);
    try {
      // Facets are re-detected inside the service wrapper, which owns the agent.
      await editMutation.mutateAsync({ uri: post.uri, text: trimmed });

      showToast(
        cost && cost.uncountedTotal > 0
          ? 'Post edited. Engagement counts will restart from zero.'
          : 'Post edited.',
        { type: 'success' },
      );
      onEdited?.({ uri: post.uri, text: trimmed });
      onClose();
    } catch (err) {
      logger.error('Failed to edit post', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Could not edit this post. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    post,
    canSave,
    editMutation,
    trimmed,
    cost,
    showToast,
    onEdited,
    onClose,
  ]);

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      title="Edit post"
      maxHeight="80%"
      padded={false}
      closeDisabled={isSaving}
      keyboardShouldPersistTaps="handled"
      footer={
        <>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleClose}
            disabled={isSaving}
            accessibilityRole="button"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          {eligibility.allowed && (
            <TouchableOpacity
              style={[
                styles.button,
                styles.saveButton,
                !canSave && styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={!canSave}
              accessibilityRole="button"
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Text>
            </TouchableOpacity>
          )}
        </>
      }
    >
      {!eligibility.allowed ? (
        <Text style={styles.expiredText} testID="edit-post-expired">
          {eligibility.reason === 'window-expired'
            ? 'The edit window for this post has closed. You can delete it and post again instead.'
            : 'This post can no longer be edited.'}
        </Text>
      ) : (
        <>
          <View style={styles.countdownRow}>
            <Text style={styles.countdown} testID="edit-post-countdown">
              {formatRemaining(eligibility.remainingMs)} left to edit
            </Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="What's on your mind?"
            placeholderTextColor={colors.textTertiary}
            multiline
            autoFocus
            value={text}
            onChangeText={setText}
            editable={!isSaving}
            testID="edit-post-input"
            accessibilityLabel="Post text"
          />

          <View style={styles.metaRow}>
            <Text style={styles.metaNote}>
              Attachments, links and replies are kept as they are.
            </Text>
            <Text
              style={[styles.charCount, isTooLong && styles.charCountOver]}
              testID="edit-post-char-count"
            >
              {graphemeLength}/{MAX_GRAPHEMES}
            </Text>
          </View>

          {cost && cost.uncountedTotal > 0 && (
            <View style={styles.warning} testID="edit-post-count-warning">
              <Text style={styles.warningText}>
                Editing restarts this post&apos;s public engagement counts from
                zero. Nothing is deleted — the {describeUncounted(cost)} stay
                attached, but other apps will show zero.
              </Text>
            </View>
          )}

          {cost?.rewritesExistingQuotes && (
            <View style={styles.warning} testID="edit-post-quote-warning">
              <Text style={styles.warningText}>
                {cost.quoteCount === 1
                  ? 'Someone has quoted this post. Their quote will start showing your new text instead of what they quoted.'
                  : `${cost.quoteCount} people have quoted this post. Their quotes will start showing your new text instead of what they quoted.`}
              </Text>
            </View>
          )}

          {error && (
            <Text style={styles.errorText} testID="edit-post-error">
              {error}
            </Text>
          )}
        </>
      )}
    </AppModal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    countdownRow: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
    },
    countdown: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
      textAlign: 'right',
    },
    input: {
      color: colors.text,
      fontSize: fontSize.callout,
      padding: spacing.lg,
      minHeight: 140,
      textAlignVertical: 'top',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    metaNote: {
      flex: 1,
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
    },
    charCount: {
      color: colors.textTertiary,
      fontSize: fontSize.caption1,
      fontWeight: fontWeights.medium,
    },
    charCountOver: {
      color: colors.danger,
    },
    warning: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: borderRadius.medium,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceAlt,
    },
    warningText: {
      color: colors.textSecondary,
      fontSize: fontSize.caption1,
    },
    errorText: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      color: colors.danger,
      fontSize: fontSize.caption1,
    },
    expiredText: {
      padding: spacing.lg,
      color: colors.textSecondary,
      fontSize: fontSize.callout,
    },
    button: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: borderRadius.medium,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    cancelButton: {
      backgroundColor: colors.surfaceAlt,
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: fontSize.callout,
      fontWeight: fontWeights.semibold,
    },
    saveButton: {
      backgroundColor: colors.primary,
    },
    saveButtonDisabled: {
      backgroundColor: colors.surfaceAlt,
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.text,
      fontSize: fontSize.callout,
      fontWeight: fontWeights.semibold,
    },
  });
}
