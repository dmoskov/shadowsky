import React from 'react';
import {Path} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function PlusIcon({size = 24, color = '#9ca3af', accessibilityLabel = 'Add'}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      <Path
        d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
        fill={color}
      />
    </IconBase>
  );
}
