import React from 'react'

export const SkipLinks: React.FC = () => {
  return (
    <div className="sr-only focus:not-sr-only">
      <a
        href="#main-content"
        className="fixed top-4 left-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-md
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   focus:ring-offset-gray-900 transition-all"
      >
        Skip to main content
      </a>
      <a
        href="#main-navigation"
        className="fixed top-4 left-32 z-50 bg-blue-600 text-white px-4 py-2 rounded-md
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                   focus:ring-offset-gray-900 transition-all"
      >
        Skip to navigation
      </a>
    </div>
  )
}