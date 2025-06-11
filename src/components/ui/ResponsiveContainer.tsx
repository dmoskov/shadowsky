import React from 'react'
import clsx from 'clsx'

interface ResponsiveContainerProps {
  children: React.ReactNode
  className?: string
}

/**
 * Responsive container that provides fixed widths at specific breakpoints
 * Matches Bluesky's approach of snapping to specific widths
 */
export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({ children, className }) => {
  return (
    <div className={clsx(
      "mx-auto w-full",
      // Mobile: full width with padding
      "px-4",
      // Small screens: 600px max
      "sm:max-w-[600px]",
      // Medium screens: 600px
      "md:max-w-[600px]",
      // Large screens: 600px (feed doesn't expand beyond this)
      "lg:max-w-[600px]",
      // XL screens: still 600px
      "xl:max-w-[600px]",
      // 2XL screens: could go wider but typically still 600px for feed
      "2xl:max-w-[600px]",
      className
    )}>
      {children}
    </div>
  )
}