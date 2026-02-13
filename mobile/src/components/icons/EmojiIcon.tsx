import React from 'react';
import {Path, Circle} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function EmojiIcon({size = 24, color = '#9ca3af', accessibilityLabel = 'Emoji'}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.5" fill="none" />
      <Circle cx="8.5" cy="9.5" r="1.5" fill={color} />
      <Circle cx="15.5" cy="9.5" r="1.5" fill={color} />
      <Path
        d="M8 14.5C8.5 15.5 10 17 12 17C14 17 15.5 15.5 16 14.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </IconBase>
  );
}
