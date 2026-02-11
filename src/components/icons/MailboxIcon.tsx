import React from "react";
import { IconBase, type IconProps } from "./Icon";

export const MailboxIcon: React.FC<IconProps> = ({
  size = 24,
  color,
  className,
  style,
  ...props
}) => (
  <IconBase size={size} className={className} style={style} {...props}>
    <path
      d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
      fill={color || "currentColor"}
    />
  </IconBase>
);
