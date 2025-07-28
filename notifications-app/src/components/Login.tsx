import React, { useState } from 'react'
import { Shield, Smartphone } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export const Login: React.FC = () => {
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(identifier, password)
    } catch (err: any) {
      setError(err.message || 'Failed to login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bsky-font" style={{ background: 'var(--bsky-bg-primary)' }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img 
            src="/shadowsky-icon.svg" 
            alt="ShadowSky Logo" 
            className="w-20 h-20 mb-4 rounded-2xl shadow-lg mx-auto"
          />
          <h1 className="text-3xl font-bold bsky-gradient-text mb-2">ShadowSky</h1>
          <p className="text-lg mb-2" style={{ color: 'var(--bsky-text-secondary)' }}>Your Bluesky Companion App</p>
        </div>

        <form onSubmit={handleSubmit} className="bsky-card p-8 shadow-lg">
          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm" 
                 style={{ 
                   backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                   border: '1px solid var(--bsky-error)',
                   color: 'var(--bsky-error)'
                 }}>
              {error}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="identifier" className="block text-sm font-medium mb-2" style={{ color: 'var(--bsky-text-secondary)' }}>
              Handle or Email
            </label>
            <input
              type="text"
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-white transition-all
                       focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--bsky-bg-tertiary)',
                border: '1px solid var(--bsky-border-primary)',
                color: 'var(--bsky-text-primary)'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--bsky-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--bsky-border-primary)'}
              placeholder="@handle.bsky.social"
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: 'var(--bsky-text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-white transition-all
                       focus:outline-none focus:ring-2 focus:ring-opacity-50"
              style={{ 
                backgroundColor: 'var(--bsky-bg-tertiary)',
                border: '1px solid var(--bsky-border-primary)',
                color: 'var(--bsky-text-primary)'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--bsky-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--bsky-border-primary)'}
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bsky-button-primary text-white font-semibold
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
          
        </form>
        
        <div className="mt-8 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: 'var(--bsky-bg-secondary)' }}>
            <Smartphone size={20} style={{ color: 'var(--bsky-primary)' }} className="mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--bsky-text-primary)' }}>Works alongside Bluesky</h3>
              <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                ShadowSky complements your official Bluesky app. Keep using Bluesky as normal - we just add extra insights!
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: 'var(--bsky-bg-secondary)' }}>
            <Shield size={20} style={{ color: 'var(--bsky-success)' }} className="mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--bsky-text-primary)' }}>Your credentials are safe</h3>
              <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                Your login goes directly to Bluesky's official servers. We never store your password - the session token is saved only on your computer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}