import { useEffect } from 'react'
import { useAccessibility } from '../contexts/AccessibilityContext'

/**
 * Hook to announce messages to screen readers
 * 
 * @param message - The message to announce
 * @param priority - The priority of the announcement ('polite' or 'assertive')
 * @param condition - Optional condition to control when the announcement is made
 */
export const useAnnouncement = (
  message: string | null,
  priority: 'polite' | 'assertive' = 'polite',
  condition: boolean = true
) => {
  const { announce } = useAccessibility()

  useEffect(() => {
    if (message && condition) {
      announce(message, priority)
    }
  }, [message, priority, condition, announce])
}

/**
 * Hook to announce loading states
 */
export const useLoadingAnnouncement = (isLoading: boolean, loadingMessage = 'Loading content', completeMessage = 'Content loaded') => {
  const { announce } = useAccessibility()

  useEffect(() => {
    if (isLoading) {
      announce(loadingMessage, 'polite')
    } else {
      announce(completeMessage, 'polite')
    }
  }, [isLoading, loadingMessage, completeMessage, announce])
}

/**
 * Hook to announce error states
 */
export const useErrorAnnouncement = (error: Error | null) => {
  const { announce } = useAccessibility()

  useEffect(() => {
    if (error) {
      announce(`Error: ${error.message}`, 'assertive')
    }
  }, [error, announce])
}

/**
 * Hook to announce count changes (e.g., likes, reposts)
 */
export const useCountAnnouncement = (
  count: number,
  label: string,
  previousCount?: number
) => {
  const { announce } = useAccessibility()

  useEffect(() => {
    if (previousCount !== undefined && count !== previousCount) {
      const change = count - previousCount
      if (change > 0) {
        announce(`${label} increased to ${count}`, 'polite')
      } else if (change < 0) {
        announce(`${label} decreased to ${count}`, 'polite')
      }
    }
  }, [count, label, previousCount, announce])
}