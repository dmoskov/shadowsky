import React from 'react'
import { motion } from 'framer-motion'
import { 
  AlertTriangle,
  RefreshCw,
  Wifi,
  Server,
  Lock,
  Ban
} from 'lucide-react'

interface ErrorStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  variant?: 'error' | 'warning' | 'info'
}

const ErrorStateBase: React.FC<ErrorStateProps> = ({ 
  icon, 
  title, 
  description, 
  action,
  variant = 'error' 
}) => (
  <motion.div 
    className={`flex flex-col items-center justify-center text-center px-8 py-16 ${
      variant === 'error' ? 'text-red-400' : 
      variant === 'warning' ? 'text-yellow-400' : 
      'text-blue-400'
    }`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className="mb-4">
      {icon}
    </div>
    <h2 className="text-xl font-semibold mb-2">{title}</h2>
    <p className="text-gray-400 mb-6 max-w-md">{description}</p>
    {action && (
      <motion.button
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        onClick={action.onClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <RefreshCw size={16} />
        {action.label}
      </motion.button>
    )}
  </motion.div>
)

export const NetworkError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <ErrorStateBase
    icon={<Wifi size={48} />}
    title="Connection failed"
    description="Please check your internet connection and try again."
    action={{
      label: "Try again",
      onClick: onRetry
    }}
    variant="warning"
  />
)

export const ServerError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <ErrorStateBase
    icon={<Server size={48} />}
    title="Server error"
    description="Something went wrong on our end. We're working to fix it."
    action={{
      label: "Retry",
      onClick: onRetry
    }}
  />
)

export const AuthenticationError: React.FC<{ onLogin: () => void }> = ({ onLogin }) => (
  <ErrorStateBase
    icon={<Lock size={48} />}
    title="Authentication required"
    description="Please log in to continue using Bluesky."
    action={{
      label: "Log in",
      onClick: onLogin
    }}
    variant="warning"
  />
)

export const RateLimitError: React.FC<{ retryAfter?: number }> = ({ retryAfter }) => (
  <ErrorStateBase
    icon={<Ban size={48} />}
    title="Rate limit exceeded"
    description={retryAfter 
      ? `Please wait ${retryAfter} seconds before trying again.`
      : "You're making requests too quickly. Please slow down."
    }
    variant="warning"
  />
)

export const FeedError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <ErrorStateBase
    icon={<AlertTriangle size={48} />}
    title="Failed to load feed"
    description="We couldn't load your timeline. Please try again."
    action={{
      label: "Reload feed",
      onClick: onRetry
    }}
  />
)

export const PostError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <ErrorStateBase
    icon={<AlertTriangle size={48} />}
    title="Failed to load post"
    description="This post couldn't be loaded. It may have been deleted or you don't have permission to view it."
    action={{
      label: "Try again",
      onClick: onRetry
    }}
  />
)

export const SearchError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <ErrorStateBase
    icon={<AlertTriangle size={48} />}
    title="Search failed"
    description="We couldn't complete your search. Please try again."
    action={{
      label: "Retry search",
      onClick: onRetry
    }}
  />
)

export const ProfileError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <ErrorStateBase
    icon={<AlertTriangle size={48} />}
    title="Profile not found"
    description="This profile couldn't be loaded. It may have been deleted or doesn't exist."
    action={{
      label: "Go back",
      onClick: () => window.history.back()
    }}
  />
)

// Generic error boundary fallback
export const ErrorFallback: React.FC<{ 
  error: Error
  resetError: () => void 
}> = ({ error, resetError }) => (
  <ErrorStateBase
    icon={<AlertTriangle size={48} />}
    title="Something went wrong"
    description={error.message || "An unexpected error occurred. Please try refreshing the page."}
    action={{
      label: "Try again",
      onClick: resetError
    }}
  />
)

// Inline error for smaller components
export const InlineError: React.FC<{
  message: string
  onRetry?: () => void
}> = ({ message, onRetry }) => (
  <div className="inline-flex items-center gap-2 px-3 py-2 bg-red-900/20 text-red-400 rounded-lg">
    <AlertTriangle size={16} />
    <span className="text-sm">{message}</span>
    {onRetry && (
      <button 
        className="ml-2 p-1 hover:bg-red-900/30 rounded transition-colors"
        onClick={onRetry}
        aria-label="Retry"
      >
        <RefreshCw size={14} />
      </button>
    )}
  </div>
)

// Toast notification for errors
export const ErrorToast: React.FC<{
  message: string
  onRetry?: () => void
  onDismiss: () => void
}> = ({ message, onRetry, onDismiss }) => (
  <motion.div
    className="flex items-center gap-3 px-4 py-3 bg-red-900/90 text-red-400 rounded-lg shadow-lg"
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 50 }}
  >
    <AlertTriangle size={20} />
    <span className="flex-1">{message}</span>
    <div className="flex items-center gap-2">
      {onRetry && (
        <button className="px-3 py-1 text-sm font-medium hover:bg-red-800/50 rounded transition-colors" onClick={onRetry}>
          Try again
        </button>
      )}
      <button className="px-3 py-1 text-sm font-medium hover:bg-red-800/50 rounded transition-colors" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  </motion.div>
)