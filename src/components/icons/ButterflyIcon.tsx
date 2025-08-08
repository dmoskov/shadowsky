import React from "react";

interface ButterflyIconProps {
  size?: number;
  className?: string;
}

export const ButterflyIcon: React.FC<ButterflyIconProps> = ({
  size = 24,
  className = "",
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="shadowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop
            offset="0%"
            style={{ stopColor: "#000000", stopOpacity: 0.3 }}
          />
          <stop
            offset="100%"
            style={{ stopColor: "#000000", stopOpacity: 0.5 }}
          />
        </linearGradient>

        <filter id="dropShadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="8" />
          <feOffset dx="0" dy="4" result="offsetblur" />
          <feFlood floodColor="#000000" floodOpacity="0.3" />
          <feComposite in2="offsetblur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Upper butterfly wings (light) */}
      <path
        d="M256 160 C176 80, 96 120, 128 200 C160 280, 256 240, 256 200 C256 240, 352 280, 384 200 C416 120, 336 80, 256 160"
        fill="currentColor"
        opacity="0.9"
        filter="url(#dropShadow)"
      />

      {/* Lower butterfly wings (shadow) */}
      <path
        d="M256 200 C176 240, 128 320, 192 340 C256 360, 256 280, 256 240 C256 280, 256 360, 320 340 C384 320, 336 240, 256 200"
        fill="url(#shadowGradient)"
        opacity="0.7"
      />

      {/* Center body */}
      <ellipse
        cx="256"
        cy="200"
        rx="12"
        ry="40"
        fill="currentColor"
        opacity="0.8"
      />
    </svg>
  );
};
