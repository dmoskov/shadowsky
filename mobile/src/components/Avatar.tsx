import React from 'react';
import {View, Image, StyleSheet, ViewStyle} from 'react-native';

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
  },
  image: {
    backgroundColor: '#1f2937',
  },
  placeholder: {
    backgroundColor: '#374151',
  },
});
