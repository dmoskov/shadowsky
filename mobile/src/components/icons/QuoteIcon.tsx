import React from 'react';
import {Path} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function QuoteIcon({size = 24, color = '#9ca3af', accessibilityLabel = 'Quote'}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      <Path
        d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"
        fill={color}
      />
    </IconBase>
  );
}
