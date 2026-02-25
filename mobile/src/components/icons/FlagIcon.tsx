import React from 'react';
import {Path} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function FlagIcon({size = 24, color = '#9ca3af', accessibilityLabel = 'Report'}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      <Path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z" fill={color} />
    </IconBase>
  );
}
