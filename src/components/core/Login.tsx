import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { ATProtoError, RateLimitError, AuthenticationError } from '../../lib/errors'

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

    try {
      const success = await login(identifier, password)
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
    <div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
      <h2>Login to Bluesky</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            placeholder="Username or email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onBlur={() => setTouched({ ...touched, identifier: true })}
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: touched.identifier && !identifier.trim() ? '1px solid #ff4444' : '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: loading ? '#f5f5f5' : 'white',
              cursor: loading ? 'not-allowed' : 'text'
            }}
          />
          {touched.identifier && !identifier.trim() && (
            <div style={{ color: '#ff4444', fontSize: '14px', marginTop: '5px' }}>
              Username or email is required
            </div>
          )}
        </div>
        <div style={{ marginBottom: '15px' }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched({ ...touched, password: true })}
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: touched.password && !password ? '1px solid #ff4444' : '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: loading ? '#f5f5f5' : 'white',
              cursor: loading ? 'not-allowed' : 'text'
            }}
          />
          {touched.password && !password && (
            <div style={{ color: '#ff4444', fontSize: '14px', marginTop: '5px' }}>
              Password is required
            </div>
          )}
        </div>
        {error && (
          <div style={{ 
            color: '#ff4444', 
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: '#ffe6e6',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            backgroundColor: '#0085ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  )
}