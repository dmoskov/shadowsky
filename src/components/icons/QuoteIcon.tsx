import React from "react";
import { IconBase, type IconProps } from "./Icon";

export const QuoteIcon: React.FC<IconProps> = ({
  size = 24,
  color,
  className,
  style,
  ...props
}) => (
  <IconBase size={size} className={className} style={style} {...props}>
    <path
      d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"
      fill={color || "currentColor"}
    />
  </IconBase>
);
