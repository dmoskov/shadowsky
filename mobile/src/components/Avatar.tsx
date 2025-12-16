import React from 'react';
import {View, Image, StyleSheet, ViewStyle} from 'react-native';

interface AvatarProps {
  uri?: string;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({uri, size = 40, style}: AvatarProps) {
  return (
    <View style={[styles.container, {width: size, height: size, borderRadius: size / 2}, style]}>
      {uri ? (
        <Image
          source={{uri}}
          style={[styles.image, {width: size, height: size, borderRadius: size / 2}]}
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
