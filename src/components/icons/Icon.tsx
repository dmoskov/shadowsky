import React from "react";

export interface IconProps {
  size?: number;
  color?: string;
  filled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  "aria-hidden"?: boolean | "true" | "false";
}

export function IconBase({
  size = 24,
  className,
  style,
  children,
  ...props
}: React.SVGProps<SVGSVGElement> & {
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
      {...props}
    >
      {children}
    </svg>
  );
}
