import React from 'react';
import {Path} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function PinIcon({size = 24, color = '#9ca3af', accessibilityLabel = 'Pinned'}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      <Path
        d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"
        fill={color}
      />
    </IconBase>
  );
}
