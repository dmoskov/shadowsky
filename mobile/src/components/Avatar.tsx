import React from 'react';
import {View, StyleSheet, ViewStyle} from 'react-native';
import {Image} from 'expo-image';
import {colors} from '../constants/theme';

interface AvatarProps {
  uri?: string;
  size?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Avatar({uri, size = 40, style, accessibilityLabel}: AvatarProps) {
  return (
    <View
      style={[styles.container, {width: size, height: size, borderRadius: size / 2}, style]}
      accessible={true}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel || 'User avatar'}>
      {uri ? (
        <Image
          source={{uri}}
          style={[styles.image, {width: size, height: size, borderRadius: size / 2}]}
          contentFit="cover"
          transition={200}
          accessibilityIgnoresInvertColors={true}
        />
      ) : (
        <View style={[styles.placeholder, {width: size, height: size, borderRadius: size / 2}]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    // Add subtle ring and shadow for premium feel
    borderWidth: 2,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  image: {
    backgroundColor: colors.surfaceElevated,
  },
  placeholder: {
    backgroundColor: colors.borderLight,
  },
});
