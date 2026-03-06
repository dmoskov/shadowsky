import React from 'react';
import {Path} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function PenIcon({size = 24, color = '#9ca3af', accessibilityLabel = 'Compose'}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      <Path
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 000-1.42l-2.34-2.34a1.003 1.003 0 00-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
        fill={color}
      />
    </IconBase>
  );
}
