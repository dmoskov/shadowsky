import React from "react";
import { IconBase, type IconProps } from "./Icon";

export const PersonIcon: React.FC<IconProps> = ({
  size = 24,
  color,
  filled = false,
  className,
  style,
  ...props
}) => (
  <IconBase size={size} className={className} style={style} {...props}>
    {filled ? (
      <path
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
        fill={color || "currentColor"}
      />
    ) : (
      <path
        d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 8c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zm6 4H6v-.02c.2-.72 3.04-1.98 6-1.98s5.8 1.26 6 1.98V18z"
        fill={color || "currentColor"}
      />
    )}
  </IconBase>
);
