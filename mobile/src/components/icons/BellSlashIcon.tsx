import React from 'react';
import {Path} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function BellSlashIcon({size = 24, color = '#9ca3af', accessibilityLabel = 'Muted'}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      <Path
        d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-11v-0.5l1.29-1.29c-.05-.1-.09-.21-.13-.32-.49-1.16-1.27-2.18-2.24-2.99l-1.42 1.42c.61.54 1.08 1.21 1.38 1.96l0.12 0.29v1.43l2 2zm-3.16 3.16l-7.84-7.84v3.68l-2 2v1h10.59l1.41 1.41v-0.41zm-3.84-9.16v-0.68c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68c-1.76.41-3.23 1.53-4.13 3.02l12.12 12.12 1.41-1.41-16.49-16.49-1.41 1.41 3.5 3.5z"
        fill={color}
      />
    </IconBase>
  );
}
