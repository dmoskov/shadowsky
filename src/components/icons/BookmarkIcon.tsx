import React from "react";
import { IconBase, type IconProps } from "./Icon";

export const BookmarkIcon: React.FC<IconProps> = ({
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
        d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"
        fill={color || "currentColor"}
      />
    ) : (
      <path
        d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"
        fill={color || "currentColor"}
      />
    )}
  </IconBase>
);
