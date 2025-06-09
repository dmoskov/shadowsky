import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { ATProtoError, RateLimitError, AuthenticationError } from '../../lib/errors'
import { performanceTracker } from '../../lib/performance-tracking'

export const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState({ identifier: false, password: false })
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    // Validate fields
    if (!identifier.trim()) {
      setError('Please enter your username or email')
      return
    }
    
    if (!password) {
      setError('Please enter your password')
      return
    }
    
    setLoading(true)
    performanceTracker.mark('login-start')

    try {
      const success = await performanceTracker.measureAsync(
        'login-attempt',
        async () => await login(identifier, password)
      )
      if (!success) {
        setError('Invalid username or password. Please try again.')
      }
    } catch (err) {
      // Handle specific error types
      if (err instanceof RateLimitError) {
        const minutes = Math.ceil((err.resetAt.getTime() - Date.now()) / 60000)
        setError(`Too many login attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`)
      } else if (err instanceof AuthenticationError) {
        setError('Invalid username or password. Please check your credentials.')
      } else if (err instanceof ATProtoError) {
        setError(err.message || 'Login failed. Please try again.')
      } else {
        setError('Unable to connect to Bluesky. Please check your internet connection and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-24 p-6">
      <h2 className="text-2xl font-bold mb-6">Login to Bluesky</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Username or email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onBlur={() => setTouched({ ...touched, identifier: true })}
            required
            disabled={loading}
            className={`
              w-full px-3 py-2.5 text-base
              border rounded
              transition-colors duration-200
              ${touched.identifier && !identifier.trim() 
                ? 'border-red-500 focus:border-red-500' 
                : 'border-gray-300 focus:border-blue-500'
              }
              ${loading 
                ? 'bg-gray-100 cursor-not-allowed' 
                : 'bg-white cursor-text'
              }
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20
            `}
          />
          {touched.identifier && !identifier.trim() && (
            <div className="text-red-500 text-sm mt-1">
              Username or email is required
            </div>
          )}
        </div>
        <div className="mb-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched({ ...touched, password: true })}
            required
            disabled={loading}
            className={`
              w-full px-3 py-2.5 text-base
              border rounded
              transition-colors duration-200
              ${touched.password && !password 
                ? 'border-red-500 focus:border-red-500' 
                : 'border-gray-300 focus:border-blue-500'
              }
              ${loading 
                ? 'bg-gray-100 cursor-not-allowed' 
                : 'bg-white cursor-text'
              }
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20
            `}
          />
          {touched.password && !password && (
            <div className="text-red-500 text-sm mt-1">
              Password is required
            </div>
          )}
        </div>
        {error && (
          <div className="text-red-600 mb-4 p-3 bg-red-50 rounded text-sm">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className={`
            w-full py-2.5 px-4 text-base font-medium
            text-white bg-blue-600 rounded
            transition-all duration-200
            ${loading 
              ? 'opacity-60 cursor-not-allowed' 
              : 'hover:bg-blue-700 cursor-pointer'
            }
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
          `}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  )
}