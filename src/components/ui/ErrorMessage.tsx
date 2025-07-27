import React from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

interface ErrorMessageProps {
  error: Error | string
  onDismiss?: () => void
  className?: string
  showIcon?: boolean
  variant?: 'default' | 'destructive' | 'warning'
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  error,
  onDismiss,
  className = '',
  showIcon = true,
  variant = 'destructive'
}) => {
  const message = typeof error === 'string' ? error : error.message
  
  const variantClasses = {
    default: 'bg-gray-800 border-gray-700 text-gray-300',
    destructive: 'bg-red-950 border-red-900 text-red-200',
    warning: 'bg-yellow-950 border-yellow-900 text-yellow-200'
  }
  
  const iconColor = {
    default: 'text-gray-400',
    destructive: 'text-red-500',
    warning: 'text-yellow-500'
  }
  
  return (
    <motion.div
      className={`relative rounded-lg border p-4 ${variantClasses[variant]} ${className}`}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start gap-3">
        {showIcon && (
          <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${iconColor[variant]}`} />
        )}
        <div className="flex-1">
          <p className="text-sm font-medium">
            {message}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded hover:bg-black/20 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  )
}