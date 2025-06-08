/**
 * Tests for Toast component
 * This provides user feedback through temporary notifications
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { ToastProvider, ToastContainer, useToast } from '../Toast'

// Mock framer-motion to avoid animation complexities in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, layout, initial, animate, exit, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children, mode }: any) => <>{children}</>,
}))

// Test component that uses the toast hook
const TestComponent: React.FC = () => {
  const toast = useToast()
  
  return (
    <div>
      <button onClick={() => toast.success('Success message')}>Show Success</button>
      <button onClick={() => toast.error('Error message')}>Show Error</button>
      <button onClick={() => toast.info('Info message')}>Show Info</button>
      <button onClick={() => toast.warning('Warning message')}>Show Warning</button>
      <button onClick={() => toast.success('Custom duration', 1000)}>Show Custom Duration</button>
    </div>
  )
}

describe('Toast', () => {
  // Mock timers for auto-dismiss functionality
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers()
    })
    jest.useRealTimers()
  })

  describe('ToastProvider and ToastContainer', () => {
    it('should render without errors', () => {
      render(
        <ToastProvider>
          <ToastContainer />
        </ToastProvider>
      )
      
      // Container should be present even without toasts
      const container = document.querySelector('.toast-container')
      expect(container).toBeInTheDocument()
      expect(container).toHaveAttribute('aria-live', 'polite')
    })

    it('should throw error when ToastContainer is used outside provider', () => {
      // Suppress console.error for this test
      const spy = jest.spyOn(console, 'error').mockImplementation()
      
      expect(() => {
        render(<ToastContainer />)
      }).toThrow('ToastContainer must be used within ToastProvider')
      
      spy.mockRestore()
    })
  })

  describe('useToast hook', () => {
    it('should throw error when used outside provider', () => {
      const InvalidComponent = () => {
        useToast() // This should throw
        return null
      }
      
      // Suppress console.error for this test
      const spy = jest.spyOn(console, 'error').mockImplementation()
      
      expect(() => {
        render(<InvalidComponent />)
      }).toThrow('useToast must be used within ToastProvider')
      
      spy.mockRestore()
    })

    it('should display success toast', () => {
      render(
        <ToastProvider>
          <TestComponent />
          <ToastContainer />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Show Success'))
      
      expect(screen.getByText('Success message')).toBeInTheDocument()
      expect(screen.getByLabelText('Close notification')).toBeInTheDocument()
    })

    it('should display error toast', () => {
      render(
        <ToastProvider>
          <TestComponent />
          <ToastContainer />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Show Error'))
      
      expect(screen.getByText('Error message')).toBeInTheDocument()
    })

    it('should display info toast', () => {
      render(
        <ToastProvider>
          <TestComponent />
          <ToastContainer />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Show Info'))
      
      expect(screen.getByText('Info message')).toBeInTheDocument()
    })

    it('should display warning toast', () => {
      render(
        <ToastProvider>
          <TestComponent />
          <ToastContainer />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Show Warning'))
      
      expect(screen.getByText('Warning message')).toBeInTheDocument()
    })
  })

  describe('toast behavior', () => {
    it('should display multiple toasts', () => {
      render(
        <ToastProvider>
          <TestComponent />
          <ToastContainer />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Show Success'))
      fireEvent.click(screen.getByText('Show Error'))
      fireEvent.click(screen.getByText('Show Info'))
      
      expect(screen.getByText('Success message')).toBeInTheDocument()
      expect(screen.getByText('Error message')).toBeInTheDocument()
      expect(screen.getByText('Info message')).toBeInTheDocument()
    })

    it('should remove toast when close button is clicked', () => {
      render(
        <ToastProvider>
          <TestComponent />
          <ToastContainer />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Show Success'))
      expect(screen.getByText('Success message')).toBeInTheDocument()
      
      const closeButton = screen.getByLabelText('Close notification')
      fireEvent.click(closeButton)
      
      expect(screen.queryByText('Success message')).not.toBeInTheDocument()
    })

    it('should auto-dismiss toast after default duration', async () => {
      render(
        <ToastProvider>
          <TestComponent />
          <ToastContainer />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Show Success'))
      expect(screen.getByText('Success message')).toBeInTheDocument()
      
      // Default duration is 5000ms
      act(() => {
        jest.advanceTimersByTime(5000)
      })
      
      await waitFor(() => {
        expect(screen.queryByText('Success message')).not.toBeInTheDocument()
      })
    })

    it('should respect custom duration', async () => {
      render(
        <ToastProvider>
          <TestComponent />
          <ToastContainer />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Show Custom Duration'))
      expect(screen.getByText('Custom duration')).toBeInTheDocument()
      
      // Should not dismiss before custom duration
      act(() => {
        jest.advanceTimersByTime(500)
      })
      expect(screen.getByText('Custom duration')).toBeInTheDocument()
      
      // Should dismiss after custom duration (1000ms)
      act(() => {
        jest.advanceTimersByTime(500)
      })
      
      await waitFor(() => {
        expect(screen.queryByText('Custom duration')).not.toBeInTheDocument()
      })
    })

    it('should clear timer when toast is manually closed', () => {
      const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
      
      render(
        <ToastProvider>
          <TestComponent />
          <ToastContainer />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Show Success'))
      
      const closeButton = screen.getByLabelText('Close notification')
      fireEvent.click(closeButton)
      
      // Timer should be cleared when component unmounts
      expect(clearTimeoutSpy).toHaveBeenCalled()
      
      clearTimeoutSpy.mockRestore()
    })
  })

  describe('accessibility', () => {
    it('should have appropriate ARIA attributes', () => {
      render(
        <ToastProvider>
          <ToastContainer />
        </ToastProvider>
      )
      
      const container = document.querySelector('.toast-container')
      expect(container).toHaveAttribute('aria-live', 'polite')
      expect(container).toHaveAttribute('aria-atomic', 'true')
    })

    it('should have accessible close button', () => {
      render(
        <ToastProvider>
          <TestComponent />
          <ToastContainer />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Show Success'))
      
      const closeButton = screen.getByLabelText('Close notification')
      expect(closeButton).toBeInTheDocument()
      expect(closeButton.tagName).toBe('BUTTON')
    })
  })

  describe('styling', () => {
    it('should apply correct class names', () => {
      render(
        <ToastProvider>
          <TestComponent />
          <ToastContainer />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Show Success'))
      
      const toast = screen.getByText('Success message').closest('.toast')
      expect(toast).toHaveClass('toast', 'toast-success')
    })

    it('should apply correct color styles', () => {
      render(
        <ToastProvider>
          <TestComponent />
          <ToastContainer />
        </ToastProvider>
      )
      
      fireEvent.click(screen.getByText('Show Success'))
      
      const toast = screen.getByText('Success message').closest('.toast')
      expect(toast).toHaveStyle({ '--toast-color': 'var(--color-success)' })
    })
  })
})