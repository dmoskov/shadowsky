/**
 * AppModal - Shared bottom-sheet modal primitive.
 *
 * Consolidates the modal pattern used across the app: a transparent
 * RN Modal with a blurred/dimmed backdrop, a themed sheet anchored to
 * the bottom of the screen (centered card on wide screens), a header
 * with title and close affordance, a scrollable body slot, and an
 * optional footer slot for action buttons. Keyboard avoidance is
 * built in.
 *
 * Body content and footer buttons are owned by the caller; this
 * component only provides the chrome.
 */

import React, { useMemo } from 'react';
import {
  DimensionValue,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { ThemeColors, useTheme } from '../../contexts/ThemeContext';
import { BlurOverlay } from '../BlurOverlay';
import { borderRadius } from '../../constants/elevation';
import { fontWeights, spacing } from '../../constants/spacing';
import { fontSize } from '../../utils/typography';

const WIDE_SCREEN_BREAKPOINT = 768;
const WIDE_SCREEN_MAX_WIDTH = 600;

export interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Body content. Wrapped in a ScrollView unless `scrollable` is false. */
  children: React.ReactNode;
  /** Action buttons rendered in a bordered footer row. Omit for no footer. */
  footer?: React.ReactNode;
  /**
   * Wrap the body in a ScrollView (default true). Set false when the body
   * manages its own scrolling (e.g. a FlatList) or must not scroll.
   */
  scrollable?: boolean;
  /** Apply the default body padding (default true). */
  padded?: boolean;
  /** Maximum sheet height (default '90%'). */
  maxHeight?: DimensionValue;
  /** Disable the header close affordance (e.g. while saving). */
  closeDisabled?: boolean;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  keyboardDismissMode?: 'none' | 'on-drag' | 'interactive';
}

export function AppModal({
  visible,
  onClose,
  title,
  children,
  footer,
  scrollable = true,
  padded = true,
  maxHeight = '90%',
  closeDisabled = false,
  keyboardShouldPersistTaps,
  keyboardDismissMode,
}: AppModalProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = windowWidth > WIDE_SCREEN_BREAKPOINT;
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <BlurOverlay intensity={25} />
        <View style={[styles.sheet, { maxHeight }, isWideScreen && styles.sheetWide]}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={closeDisabled}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <Text
                style={[
                  styles.closeButtonText,
                  closeDisabled && styles.closeButtonDisabled,
                ]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {scrollable ? (
            <ScrollView
              contentContainerStyle={padded ? styles.bodyContent : undefined}
              keyboardShouldPersistTaps={keyboardShouldPersistTaps}
              keyboardDismissMode={keyboardDismissMode}>
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.body, padded && styles.bodyContent]}>
              {children}
            </View>
          )}

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.modalOverlay,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.large,
      borderTopRightRadius: borderRadius.large,
    },
    sheetWide: {
      maxWidth: WIDE_SCREEN_MAX_WIDTH,
      width: '100%',
      alignSelf: 'center',
      borderRadius: borderRadius.xlarge,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      flex: 1,
      fontSize: fontSize.headline,
      fontWeight: fontWeights.semibold,
      color: colors.text,
    },
    closeButton: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
    },
    closeButtonText: {
      fontSize: fontSize.title2,
      color: colors.textSecondary,
    },
    closeButtonDisabled: {
      opacity: 0.5,
    },
    body: {
      flexShrink: 1,
    },
    bodyContent: {
      padding: spacing.lg,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });
}
