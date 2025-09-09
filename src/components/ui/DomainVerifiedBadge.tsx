import { CheckCircle, Globe } from "lucide-react";
import React from "react";
import {
  getDomainFromHandle,
  isDomainVerified,
  isNotableDomain,
} from "../../utils/domain-verification";

interface DomainVerifiedBadgeProps {
  handle: string;
  size?: "sm" | "md" | "lg";
  showDomain?: boolean;
  className?: string;
}

/**
 * Badge component to indicate domain-verified users
 * Shows a visual indicator when a user has verified their domain ownership
 */
export const DomainVerifiedBadge: React.FC<DomainVerifiedBadgeProps> = ({
  handle,
  size = "sm",
  showDomain = false,
  className = "",
}) => {
  if (!isDomainVerified(handle)) {
    return null;
  }

  const domain = getDomainFromHandle(handle);
  const isNotable = isNotableDomain(handle);

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const iconSize = {
    sm: 14,
    md: 16,
    lg: 20,
  };

  return (
    <span
      className={`domain-verified-badge inline-flex items-center gap-1 ${className}`}
      title={`Verified domain: ${domain}`}
    >
      {isNotable ? (
        <CheckCircle
          size={iconSize[size]}
          className={`${sizeClasses[size]} text-green-500`}
          strokeWidth={2.5}
        />
      ) : (
        <Globe
          size={iconSize[size]}
          className={`${sizeClasses[size]} text-blue-500`}
          strokeWidth={2}
        />
      )}
      {showDomain && domain && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {domain}
        </span>
      )}
    </span>
  );
};

/**
 * Inline version of the badge that can be used next to handles
 */
export const DomainVerifiedBadgeInline: React.FC<{
  handle: string;
  className?: string;
}> = ({ handle, className = "" }) => {
  if (!isDomainVerified(handle)) {
    return null;
  }

  const isNotable = isNotableDomain(handle);

  return (
    <span
      className={`domain-verified-inline ml-1 inline-flex ${className}`}
      title={`Verified domain: ${getDomainFromHandle(handle)}`}
    >
      {isNotable ? (
        <CheckCircle size={16} className="text-green-500" strokeWidth={2.5} />
      ) : (
        <Globe size={16} className="text-blue-500" strokeWidth={2} />
      )}
    </span>
  );
};
