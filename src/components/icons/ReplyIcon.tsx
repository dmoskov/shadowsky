import React from "react";
import { IconBase, type IconProps } from "./Icon";

export const ReplyIcon: React.FC<IconProps> = ({
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
        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
        fill={color || "currentColor"}
      />
    ) : (
      <path
        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"
        fill={color || "currentColor"}
      />
    )}
  </IconBase>
);
