import React from "react";

interface BlueskyIconProps {
  size?: number;
  className?: string;
}

export const BlueskyIcon: React.FC<BlueskyIconProps> = ({
  size = 32,
  className = "",
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 2C9.5 2 7.5 4.5 7.5 7.5C7.5 10.5 9.5 16 12 16C14.5 16 16.5 10.5 16.5 7.5C16.5 4.5 14.5 2 12 2Z"
        fill="currentColor"
      />
      <path
        d="M12 16C9.5 16 7.5 18.5 7.5 21C7.5 21.8284 8.17157 22.5 9 22.5C9.82843 22.5 10.5 21.8284 10.5 21C10.5 20.1716 11.1716 19.5 12 19.5C12.8284 19.5 13.5 20.1716 13.5 21C13.5 21.8284 14.1716 22.5 15 22.5C15.8284 22.5 16.5 21.8284 16.5 21C16.5 18.5 14.5 16 12 16Z"
        fill="currentColor"
      />
      <circle cx="9" cy="8" r="1.5" fill="currentColor" opacity="0.3" />
      <circle cx="15" cy="8" r="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  );
};

// Alternative stylized version
export const BlueskyLogoStyled: React.FC<BlueskyIconProps> = ({
  size = 32,
  className = "",
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient
          id="bluesky-gradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#00A8E8" />
          <stop offset="100%" stopColor="#007EA7" />
        </linearGradient>
      </defs>
      <path
        d="M16 4C13 4 10 7.5 10 11.5C10 15.5 13 22 16 22C19 22 22 15.5 22 11.5C22 7.5 19 4 16 4Z"
        fill="url(#bluesky-gradient)"
      />
      <path
        d="M16 22C13 22 10 25 10 28C10 29.1046 10.8954 30 12 30C13.1046 30 14 29.1046 14 28C14 27.4477 14.4477 27 15 27H17C17.5523 27 18 27.4477 18 28C18 29.1046 18.8954 30 20 30C21.1046 30 22 29.1046 22 28C22 25 19 22 16 22Z"
        fill="url(#bluesky-gradient)"
      />
    </svg>
  );
};
