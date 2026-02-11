import React from 'react';
import {Path} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function HomeIcon({size = 24, color = '#9ca3af', filled = false, accessibilityLabel = 'Home'}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      {filled ? (
        <Path
          d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"
          fill={color}
        />
      ) : (
        <Path
          d="M12 5.69l5 4.5V18h-2v-6H9v6H7v-7.81l5-4.5M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"
          fill={color}
        />
      )}
    </IconBase>
  );
}
