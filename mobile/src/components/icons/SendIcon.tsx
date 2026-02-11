import React from 'react';
import {Path} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function SendIcon({size = 24, color = '#9ca3af', accessibilityLabel = 'Send'}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      <Path
        d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
        fill={color}
      />
    </IconBase>
  );
}
