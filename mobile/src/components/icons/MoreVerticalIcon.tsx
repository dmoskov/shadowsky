import React from 'react';
import {Circle} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function MoreVerticalIcon({size = 24, color = '#9ca3af', accessibilityLabel = 'More options'}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      <Circle cx="12" cy="5" r="1.5" fill={color} />
      <Circle cx="12" cy="12" r="1.5" fill={color} />
      <Circle cx="12" cy="19" r="1.5" fill={color} />
    </IconBase>
  );
}
