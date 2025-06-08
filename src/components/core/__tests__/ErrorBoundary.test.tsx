/**
 * Tests for ErrorBoundary component
 * This component catches React errors and displays fallback UI
 */

import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '../../../test/utils'
import { ErrorBoundary, withErrorBoundary } from '../ErrorBoundary'

// Component that throws an error for testing
const ThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = false }) => {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

// Component that throws in useEffect
const ThrowErrorInEffect: React.FC = () => {
  React.useEffect(() => {
    throw new Error('Effect error')
  }, [])
  return <div>Component loaded</div>
}

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests
  const originalError = console.error
  beforeAll(() => {
    console.error = jest.fn()
  })
  afterAll(() => {
    console.error = originalError
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('normal operation', () => {
    it('should render children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      )

      expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('should pass through props to children', () => {
      const TestComponent: React.FC<{ message: string }> = ({ message }) => (
        <div>{message}</div>
      )

      render(
        <ErrorBoundary>
          <TestComponent message="Hello world" />
        </ErrorBoundary>
      )

      expect(screen.getByText('Hello world')).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('should catch errors and display default error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('Test error message')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
    })

    it('should display error stack in details', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      const details = screen.getByText('Error details')
      expect(details).toBeInTheDocument()

      // The stack trace should be hidden initially
      const summary = details.closest('details')
      expect(summary).toBeInTheDocument()
    })

    it('should log error to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(console.error).toHaveBeenCalledWith(
        'Error caught by boundary:',
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      )
    })

    it('should handle errors without message', () => {
      const ErrorWithoutMessage = () => {
        throw new Error('')
      }

      render(
        <ErrorBoundary>
          <ErrorWithoutMessage />
        </ErrorBoundary>
      )

      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
    })
  })

  describe('custom fallback', () => {
    it('should render custom fallback when provided', () => {
      const customFallback = (error: Error, reset: () => void) => (
        <div>
          <h1>Custom Error</h1>
          <p>{error.message}</p>
          <button onClick={reset}>Custom Reset</button>
        </div>
      )

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByText('Custom Error')).toBeInTheDocument()
      expect(screen.getByText('Test error message')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Custom Reset' })).toBeInTheDocument()
    })
  })

  describe('reset functionality', () => {
    it('should call reset handler when Try Again is clicked', () => {
      const ControlledComponent = () => {
        const [hasError, setHasError] = React.useState(true)
        
        return (
          <ErrorBoundary 
            fallback={(error, reset) => (
              <div>
                <p>Error: {error.message}</p>
                <button onClick={() => {
                  reset()
                  setHasError(false)
                }}>Try Again</button>
              </div>
            )}
          >
            <ThrowError shouldThrow={hasError} />
          </ErrorBoundary>
        )
      }
      
      render(<ControlledComponent />)

      // Error should be displayed
      expect(screen.getByText('Error: Test error message')).toBeInTheDocument()

      // Click Try Again
      fireEvent.click(screen.getByRole('button', { name: 'Try Again' }))

      // Should show normal content after reset
      expect(screen.getByText('No error')).toBeInTheDocument()
      expect(screen.queryByText('Error: Test error message')).not.toBeInTheDocument()
    })

    it('should reset with custom fallback reset function', () => {
      let resetCalled = false
      const customFallback = (error: Error, reset: () => void) => (
        <button
          onClick={() => {
            resetCalled = true
            reset()
          }}
        >
          Reset
        </button>
      )

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )

      expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
      
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
      expect(resetCalled).toBe(true)
    })
  })

  describe('withErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const TestComponent: React.FC = () => <div>Test Component</div>
      const WrappedComponent = withErrorBoundary(TestComponent)

      render(<WrappedComponent />)

      expect(screen.getByText('Test Component')).toBeInTheDocument()
    })

    it('should pass props through HOC', () => {
      interface Props {
        message: string
        count: number
      }
      const TestComponent: React.FC<Props> = ({ message, count }) => (
        <div>
          {message} - {count}
        </div>
      )
      const WrappedComponent = withErrorBoundary(TestComponent)

      render(<WrappedComponent message="Hello" count={42} />)

      expect(screen.getByText('Hello - 42')).toBeInTheDocument()
    })

    it('should catch errors in wrapped component', () => {
      const ErrorComponent: React.FC = () => {
        throw new Error('HOC error')
      }
      const WrappedComponent = withErrorBoundary(ErrorComponent)

      render(<WrappedComponent />)

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('HOC error')).toBeInTheDocument()
    })

    it('should use custom fallback in HOC', () => {
      const ErrorComponent: React.FC = () => {
        throw new Error('HOC error')
      }
      const customFallback = () => <div>HOC Custom Fallback</div>
      const WrappedComponent = withErrorBoundary(ErrorComponent, customFallback)

      render(<WrappedComponent />)

      expect(screen.getByText('HOC Custom Fallback')).toBeInTheDocument()
    })
  })

  describe('error types', () => {
    it('should handle async errors in effects', async () => {
      // Note: Error boundaries don't catch errors in event handlers,
      // async code, or during SSR. This is a React limitation.
      
      const AsyncErrorComponent = () => {
        const [shouldThrow, setShouldThrow] = React.useState(false)
        
        if (shouldThrow) {
          throw new Error('State error')
        }
        
        return (
          <button onClick={() => setShouldThrow(true)}>
            Trigger Error
          </button>
        )
      }

      render(
        <ErrorBoundary>
          <AsyncErrorComponent />
        </ErrorBoundary>
      )

      // Click to trigger error
      fireEvent.click(screen.getByRole('button', { name: 'Trigger Error' }))

      // Error should be caught
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('State error')).toBeInTheDocument()
    })

    it('should handle errors with different types', () => {
      const CustomError = class extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'CustomError'
        }
      }

      const ThrowCustomError = () => {
        throw new CustomError('Custom error occurred')
      }

      render(
        <ErrorBoundary>
          <ThrowCustomError />
        </ErrorBoundary>
      )

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('Custom error occurred')).toBeInTheDocument()
    })
  })
})