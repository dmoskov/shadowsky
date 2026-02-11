import React from "react";
import { IconBase, type IconProps } from "./Icon";

export const ChartIcon: React.FC<IconProps> = ({
  size = 24,
  color,
  className,
  style,
  ...props
}) => (
  <IconBase size={size} className={className} style={style} {...props}>
    <path
      d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"
      fill={color || "currentColor"}
    />
  </IconBase>
);
