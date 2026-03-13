import React, { useMemo } from 'react';
import {TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert} from 'react-native';
import {useFollowUser, useUnfollowUser} from '../hooks/api/useProfile';
import { useTheme } from "../contexts/ThemeContext";
import { triggerHaptic } from '../utils/haptics';
import {fontSize} from '../utils/typography';

interface FollowButtonProps {
  did: string;
  followUri?: string;
  isFollowing: boolean;
  handle?: string;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export function FollowButton({
  did,
  followUri,
  isFollowing,
  handle,
  size = 'medium',
  style,
}: FollowButtonProps) {
  const { colors } = useTheme();
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = () => {
    triggerHaptic('light');
    if (isFollowing && followUri) {
      const message = handle
        ? `Are you sure you want to unfollow @${handle}?`
        : 'Are you sure you want to unfollow this user?';
      Alert.alert(
        'Unfollow',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unfollow',
            style: 'destructive',
            onPress: () => {
              unfollowMutation.mutate(followUri);
            },
          },
        ]
      );
    } else {
      followMutation.mutate(did);
    }
  };

  const isPending = followMutation.isPending || unfollowMutation.isPending;

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: 12,
          paddingHorizontal: 12,
          fontSize: fontSize.caption1,
        };
      case 'large':
        return {
          paddingVertical: 12,
          paddingHorizontal: 24,
          fontSize: fontSize.callout,
        };
      default:
        return {
          paddingVertical: 8,
          paddingHorizontal: 16,
          fontSize: fontSize.subheadline,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
        },
        isFollowing && styles.followingButton,
        style,
      ]}
      onPress={handlePress}
      disabled={isPending}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={isFollowing ? 'Unfollow user' : 'Follow user'}
      accessibilityHint={isFollowing ? 'Double tap to unfollow this user' : 'Double tap to follow this user'}
      accessibilityState={{disabled: isPending, busy: isPending}}>
      {isPending ? (
        <ActivityIndicator size="small" color={isFollowing ? colors.primary : colors.text} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            {fontSize: sizeStyles.fontSize},
            isFollowing && styles.followingButtonText,
          ]}>
          {isFollowing ? 'Following' : 'Follow'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    button: {
      backgroundColor: colors.primary,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 80,
    },
    followingButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    buttonText: {
      color: colors.text,
      fontWeight: '600',
    },
    followingButtonText: {
      color: colors.primary,
    },
  });
}
