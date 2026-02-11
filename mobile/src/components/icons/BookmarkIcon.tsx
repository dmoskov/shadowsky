import React from 'react';
import {Path} from 'react-native-svg';
import {IconBase, IconProps} from './Icon';

export function BookmarkIcon({size = 24, color = '#9ca3af', filled = false, accessibilityLabel = 'Bookmark'}: IconProps) {
  return (
    <IconBase size={size} accessibilityLabel={accessibilityLabel}>
      {filled ? (
        <Path
          d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"
          fill={color}
        />
      ) : (
        <Path
          d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"
          fill={color}
        />
      )}
    </IconBase>
  );
}
