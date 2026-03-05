import React from 'react';
import {Path} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function TrendingUpIcon({size = 24, color = '#9ca3af', accessibilityLabel = 'Trending'}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      <Path
        d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z"
        fill={color}
      />
    </IconBase>
  );
}
