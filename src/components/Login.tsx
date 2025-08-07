import React, { useState } from 'react'
import { Shield, Smartphone, Mail } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import butterflyIcon from '/butterfly-icon.svg'

export const Login: React.FC = () => {
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [pdsUrl, setPdsUrl] = useState('https://bsky.social')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showEmailCode, setShowEmailCode] = useState(false)
  const [emailCode, setEmailCode] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(identifier, password, pdsUrl, showEmailCode ? emailCode : undefined)
    } catch (err: any) {
      // Check if this is an email auth factor error
      console.log('Login error:', err)
      console.log('Error message:', err.message)
      console.log('Error status:', err.status)
      
      if (err.message?.includes('sign in code has been sent') || 
          err.message?.includes('AuthFactorTokenRequired') ||
          err.status === 'AuthFactorTokenRequired') {
        console.log('Setting showEmailCode to true')
        setShowEmailCode(true)
        setError('A sign in code has been sent to your email address. Please check your email and enter the code below.')
      } else {
        setError(err.message || 'Failed to login')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bsky-font" style={{ background: 'var(--bsky-bg-primary)' }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <img 
            src={butterflyIcon} 
            alt="ShadowSky Logo" 
            className="w-20 h-20 mb-4 rounded-2xl shadow-lg mx-auto"
          />
          <h1 className="text-3xl font-bold bsky-gradient-text mb-2">ShadowSky</h1>
          <p className="text-lg mb-2" style={{ color: 'var(--bsky-text-secondary)' }}>Your Bluesky Companion App</p>
        </div>

        <form onSubmit={handleSubmit} className="bsky-card p-8 shadow-lg">
          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm flex items-start gap-2" 
                 style={{ 
                   backgroundColor: showEmailCode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                   border: showEmailCode ? '1px solid var(--bsky-primary)' : '1px solid var(--bsky-error)',
                   color: showEmailCode ? 'var(--bsky-primary)' : 'var(--bsky-error)'
                 }}>
              {showEmailCode && <Mail size={16} className="mt-0.5 flex-shrink-0" />}
              <span>{error}</span>
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

          {showEmailCode && (
            <div className="mb-6">
              <label htmlFor="emailCode" className="block text-sm font-medium mb-2" style={{ color: 'var(--bsky-text-secondary)' }}>
                Email Verification Code
              </label>
              <input
                type="text"
                id="emailCode"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-white transition-all
                         focus:outline-none focus:ring-2 focus:ring-opacity-50"
                style={{ 
                  backgroundColor: 'var(--bsky-bg-tertiary)',
                  border: '1px solid var(--bsky-border-primary)',
                  color: 'var(--bsky-text-primary)'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--bsky-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--bsky-border-primary)'}
                placeholder="Enter the code from your email"
                required
                autoFocus
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs" style={{ color: 'var(--bsky-text-tertiary)' }}>
                  Check your email for the verification code
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEmailCode('')
                    setShowEmailCode(false)
                    setError('')
                  }}
                  className="text-xs hover:underline"
                  style={{ color: 'var(--bsky-primary)' }}
                >
                  Try different credentials
                </button>
              </div>
            </div>
          )}

          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-sm flex items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--bsky-text-secondary)' }}
            >
              <span className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
              Advanced: Use a different PDS
            </button>
            
            {showAdvanced && (
              <div className="mt-3">
                <label htmlFor="pdsUrl" className="block text-sm font-medium mb-2" style={{ color: 'var(--bsky-text-secondary)' }}>
                  PDS Server URL
                </label>
                <input
                  type="url"
                  id="pdsUrl"
                  value={pdsUrl}
                  onChange={(e) => setPdsUrl(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-white transition-all
                           focus:outline-none focus:ring-2 focus:ring-opacity-50"
                  style={{ 
                    backgroundColor: 'var(--bsky-bg-tertiary)',
                    border: '1px solid var(--bsky-border-primary)',
                    color: 'var(--bsky-text-primary)'
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--bsky-primary)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--bsky-border-primary)'}
                  placeholder="https://bsky.social"
                />
                <p className="text-xs mt-1" style={{ color: 'var(--bsky-text-tertiary)' }}>
                  Default is https://bsky.social. Only change if you use a different PDS.
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bsky-button-primary text-white font-semibold
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : showEmailCode ? 'Verify Code' : 'Sign In'}
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