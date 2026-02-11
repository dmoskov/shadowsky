import React from "react";
import { IconBase, type IconProps } from "./Icon";

export const HomeIcon: React.FC<IconProps> = ({
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
        d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"
        fill={color || "currentColor"}
      />
    ) : (
      <path
        d="M12 5.69l5 4.5V18h-2v-6H9v6H7v-7.81l5-4.5M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"
        fill={color || "currentColor"}
      />
    )}
  </IconBase>
);
