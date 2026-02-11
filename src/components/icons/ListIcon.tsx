import React from "react";
import { IconBase, type IconProps } from "./Icon";

export const ListIcon: React.FC<IconProps> = ({
  size = 24,
  color,
  className,
  style,
  ...props
}) => (
  <IconBase size={size} className={className} style={style} {...props}>
    <path
      d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"
      fill={color || "currentColor"}
    />
  </IconBase>
);
