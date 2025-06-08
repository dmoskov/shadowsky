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
    className={`error-state-container error-state-${variant}`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className="error-state-icon">
      {icon}
    </div>
    <h2 className="error-state-title">{title}</h2>
    <p className="error-state-description">{description}</p>
    {action && (
      <motion.button
        className="btn btn-primary"
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
  <div className="inline-error">
    <AlertTriangle size={16} />
    <span>{message}</span>
    {onRetry && (
      <button 
        className="btn-link"
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
    className="error-toast"
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 50 }}
  >
    <AlertTriangle size={20} />
    <span>{message}</span>
    <div className="error-toast-actions">
      {onRetry && (
        <button className="btn-link" onClick={onRetry}>
          Try again
        </button>
      )}
      <button className="btn-link" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  </motion.div>
)