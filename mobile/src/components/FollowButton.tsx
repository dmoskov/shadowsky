import React from 'react';
import {TouchableOpacity, Text, StyleSheet, ActivityIndicator} from 'react-native';
import {useFollowUser, useUnfollowUser} from '../hooks/api/useProfile';
import {colors} from '../constants/theme';

interface FollowButtonProps {
  did: string;
  followUri?: string;
  isFollowing: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export function FollowButton({
  did,
  followUri,
  isFollowing,
  size = 'medium',
  style,
}: FollowButtonProps) {
  const followMutation = useFollowUser();
  const unfollowMutation = useUnfollowUser();

  const handlePress = () => {
    if (isFollowing && followUri) {
      unfollowMutation.mutate(followUri);
    } else {
      followMutation.mutate(did);
    }
  };

  const isPending = followMutation.isPending || unfollowMutation.isPending;

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: 6,
          paddingHorizontal: 12,
          fontSize: 12,
        };
      case 'large':
        return {
          paddingVertical: 12,
          paddingHorizontal: 24,
          fontSize: 16,
        };
      default:
        return {
          paddingVertical: 8,
          paddingHorizontal: 16,
          fontSize: 14,
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
      activeOpacity={0.7}>
      {isPending ? (
        <ActivityIndicator size="small" color={isFollowing ? colors.primary : '#ffffff'} />
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

const styles = StyleSheet.create({
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
    color: '#ffffff',
    fontWeight: '600',
  },
  followingButtonText: {
    color: colors.primary,
  },
});
