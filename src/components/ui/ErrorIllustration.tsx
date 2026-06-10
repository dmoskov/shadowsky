/**
 * ErrorIllustration - Visual illustrations for different error states
 *
 * Provides friendly, approachable illustrations for error messages
 * instead of just showing icons and text.
 */

import React from "react";

export type ErrorIllustrationType =
  | "offline"
  | "network"
  | "auth"
  | "not-found"
  | "empty"
  | "error"
  | "rate-limit"
  | "maintenance";

interface ErrorIllustrationProps {
  type: ErrorIllustrationType;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { width: 80, height: 80 },
  md: { width: 120, height: 120 },
  lg: { width: 160, height: 160 },
};

/**
 * Offline illustration - broken connection
 */
const OfflineIllustration: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="60"
      cy="60"
      r="50"
      fill="currentColor"
      className="text-orange-100 dark:text-orange-900/30"
    />
    <path
      d="M60 35C45.5 35 32.5 41 23 51L28 56C35.5 48 46.5 43 60 43C73.5 43 84.5 48 92 56L97 51C87.5 41 74.5 35 60 35Z"
      fill="currentColor"
      className="text-orange-300 dark:text-orange-700"
    />
    <path
      d="M38 66L43 71C48.5 65.5 54 63 60 63C66 63 71.5 65.5 77 71L82 66C75 59 67.5 55 60 55C52.5 55 45 59 38 66Z"
      fill="currentColor"
      className="text-orange-400 dark:text-orange-600"
    />
    <circle
      cx="60"
      cy="80"
      r="6"
      fill="currentColor"
      className="text-orange-500 dark:text-orange-500"
    />
    <path
      d="M30 30L90 90"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      className="text-orange-600 dark:text-orange-400"
    />
  </svg>
);

/**
 * Network error illustration - cloud with X
 */
const NetworkIllustration: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="60"
      cy="60"
      r="50"
      fill="currentColor"
      className="text-blue-100 dark:text-blue-900/30"
    />
    <path
      d="M90 60C90 48 82 40 70 40C68 32 60 28 50 30C40 32 35 40 35 48C28 50 24 58 26 66C28 74 36 80 44 80H84C90 80 94 74 94 68C94 62 90 60 90 60Z"
      fill="currentColor"
      className="text-blue-300 dark:text-blue-700"
    />
    <circle
      cx="60"
      cy="60"
      r="14"
      fill="currentColor"
      className="text-red-100 dark:text-red-900/40"
    />
    <path
      d="M54 54L66 66M66 54L54 66"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      className="text-red-500 dark:text-red-400"
    />
  </svg>
);

/**
 * Auth error illustration - locked padlock
 */
const AuthIllustration: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="60"
      cy="60"
      r="50"
      fill="currentColor"
      className="text-red-100 dark:text-red-900/30"
    />
    <rect
      x="40"
      y="52"
      width="40"
      height="32"
      rx="4"
      fill="currentColor"
      className="text-red-400 dark:text-red-600"
    />
    <path
      d="M48 52V44C48 37.4 53.4 32 60 32C66.6 32 72 37.4 72 44V52"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      className="text-red-500 dark:text-red-500"
    />
    <circle
      cx="60"
      cy="66"
      r="4"
      fill="currentColor"
      className="text-red-200 dark:text-red-900"
    />
    <path
      d="M60 70V76"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      className="text-red-200 dark:text-red-900"
    />
  </svg>
);

/**
 * Not found illustration - magnifying glass with question mark
 */
const NotFoundIllustration: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="60"
      cy="60"
      r="50"
      fill="currentColor"
      className="text-asph-bg-tertiary"
    />
    <circle
      cx="52"
      cy="52"
      r="24"
      stroke="currentColor"
      strokeWidth="6"
      className="text-asph-text-tertiary"
    />
    <path
      d="M70 70L88 88"
      stroke="currentColor"
      strokeWidth="6"
      strokeLinecap="round"
      className="text-asph-text-tertiary"
    />
    <text
      x="52"
      y="60"
      textAnchor="middle"
      fontSize="28"
      fontWeight="bold"
      fill="currentColor"
      className="text-asph-text-tertiary"
    >
      ?
    </text>
  </svg>
);

/**
 * Empty state illustration - empty box
 */
const EmptyIllustration: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="60"
      cy="60"
      r="50"
      fill="currentColor"
      className="text-asph-bg-tertiary"
    />
    <path
      d="M35 50L60 38L85 50L60 62L35 50Z"
      fill="currentColor"
      className="text-asph-text-tertiary"
    />
    <path
      d="M35 50V74L60 86V62L35 50Z"
      fill="currentColor"
      className="text-asph-text-tertiary"
    />
    <path
      d="M85 50V74L60 86V62L85 50Z"
      fill="currentColor"
      className="text-asph-border-secondary"
    />
    <path
      d="M60 62V86"
      stroke="currentColor"
      strokeWidth="2"
      strokeDasharray="4 2"
      className="text-asph-text-tertiary"
    />
  </svg>
);

/**
 * Generic error illustration - warning triangle
 */
const ErrorIllustrationGraphic: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="60"
      cy="60"
      r="50"
      fill="currentColor"
      className="text-red-100 dark:text-red-900/30"
    />
    <path
      d="M60 30L92 84H28L60 30Z"
      fill="currentColor"
      className="text-red-400 dark:text-red-600"
    />
    <path
      d="M60 50V64"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      className="text-white dark:text-red-100"
    />
    <circle
      cx="60"
      cy="74"
      r="3"
      fill="currentColor"
      className="text-white dark:text-red-100"
    />
  </svg>
);

/**
 * Rate limit illustration - hourglass
 */
const RateLimitIllustration: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="60"
      cy="60"
      r="50"
      fill="currentColor"
      className="text-yellow-100 dark:text-yellow-900/30"
    />
    <path
      d="M40 30H80V40C80 50 70 58 60 60C70 62 80 70 80 80V90H40V80C40 70 50 62 60 60C50 58 40 50 40 40V30Z"
      fill="currentColor"
      className="text-yellow-400 dark:text-yellow-600"
    />
    <path
      d="M45 35H75"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      className="text-yellow-500 dark:text-yellow-500"
    />
    <path
      d="M45 85H75"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      className="text-yellow-500 dark:text-yellow-500"
    />
    <path
      d="M52 42L60 52L68 42"
      fill="currentColor"
      className="text-yellow-600 dark:text-yellow-400"
    />
  </svg>
);

/**
 * Maintenance illustration - wrench and gear
 */
const MaintenanceIllustration: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="60"
      cy="60"
      r="50"
      fill="currentColor"
      className="text-purple-100 dark:text-purple-900/30"
    />
    <circle
      cx="60"
      cy="60"
      r="20"
      fill="currentColor"
      className="text-purple-300 dark:text-purple-700"
    />
    <circle
      cx="60"
      cy="60"
      r="8"
      fill="currentColor"
      className="text-purple-500 dark:text-purple-500"
    />
    <path
      d="M60 32V38M60 82V88M32 60H38M82 60H88M40 40L44 44M76 76L80 80M80 40L76 44M44 76L40 80"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      className="text-purple-400 dark:text-purple-600"
    />
  </svg>
);

const illustrationMap: Record<
  ErrorIllustrationType,
  React.FC<{ width: number; height: number }>
> = {
  offline: OfflineIllustration,
  network: NetworkIllustration,
  auth: AuthIllustration,
  "not-found": NotFoundIllustration,
  empty: EmptyIllustration,
  error: ErrorIllustrationGraphic,
  "rate-limit": RateLimitIllustration,
  maintenance: MaintenanceIllustration,
};

export const ErrorIllustration: React.FC<ErrorIllustrationProps> = ({
  type,
  className = "",
  size = "md",
}) => {
  const Illustration = illustrationMap[type];
  const dimensions = sizeMap[size];

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Illustration width={dimensions.width} height={dimensions.height} />
    </div>
  );
};

export default ErrorIllustration;
