import React from 'react';
import Svg, {SvgProps} from 'react-native-svg';

export interface IconProps {
  size?: number;
  color?: string;
  filled?: boolean;
  accessibilityLabel?: string;
}

export function IconBase({
  size = 24,
  accessibilityLabel,
  children,
  ...props
}: SvgProps & {size?: number; accessibilityLabel?: string; children: React.ReactNode}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityLabel={accessibilityLabel}
      {...props}>
      {children}
    </Svg>
  );
}
