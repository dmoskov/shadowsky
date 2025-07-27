import React from 'react'
import { motion } from 'framer-motion'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

interface CardHeaderProps {
  children: React.ReactNode
  className?: string
}

interface CardTitleProps {
  children: React.ReactNode
  className?: string
}

interface CardContentProps {
  children: React.ReactNode
  className?: string
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => {
  const Component = onClick ? motion.button : motion.div
  
  return (
    <Component
      className={`bg-gray-900 border border-gray-800 rounded-lg shadow-lg ${className}`}
      onClick={onClick}
      whileHover={onClick ? { scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2 }}
    >
      {children}
    </Component>
  )
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => (
  <div className={`p-4 pb-2 ${className}`}>
    {children}
  </div>
)

export const CardTitle: React.FC<CardTitleProps> = ({ children, className = '' }) => (
  <h3 className={`text-lg font-semibold text-gray-100 ${className}`}>
    {children}
  </h3>
)

export const CardContent: React.FC<CardContentProps> = ({ children, className = '' }) => (
  <div className={`p-4 pt-2 ${className}`}>
    {children}
  </div>
)