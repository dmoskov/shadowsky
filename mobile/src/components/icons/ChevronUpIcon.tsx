import React from 'react';
import {Path} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function ChevronUpIcon({
  size = 24,
  color = '#9ca3af',
  accessibilityLabel = 'Chevron Up',
}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      <Path d="M7 14l5-5 5 5z" fill={color} />
    </IconBase>
  );
}
