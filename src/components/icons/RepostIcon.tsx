import React from "react";
import { IconBase, type IconProps } from "./Icon";

export const RepostIcon: React.FC<IconProps> = ({
  size = 24,
  color,
  className,
  style,
  ...props
}) => (
  <IconBase size={size} className={className} style={style} {...props}>
    <path
      d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"
      fill={color || "currentColor"}
    />
  </IconBase>
);
