import React, { useState } from 'react'
import { 
  Bell, TrendingUp, MessageSquare, Clock, Zap, Shield, 
  BarChart3, Users, Image, Filter, Search, Database,
  Smartphone, ChevronRight, Star, Activity, Sparkles, Mail
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import butterflyIcon from '/butterfly-icon.svg'

export const LandingPage: React.FC = () => {
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
      if (err.message?.includes('sign in code has been sent') || 
          err.message?.includes('AuthFactorTokenRequired') ||
          err.status === 'AuthFactorTokenRequired') {
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
    <div className="min-h-screen bsky-font" style={{ background: 'var(--bsky-bg-primary)' }}>
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left side - Login and info */}
          <div>
            <div className="text-center lg:text-left mb-8">
              <div className="flex items-center gap-3 justify-center lg:justify-start mb-4">
                <img 
                  src={butterflyIcon} 
                  alt="ShadowSky Logo" 
                  className="w-16 h-16 rounded-xl shadow-md"
                />
                <div>
                  <h1 className="text-3xl font-bold bsky-gradient-text">ShadowSky</h1>
                  <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                    Free Bluesky Analytics & Notifications
                  </p>
                </div>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="bsky-card p-6 shadow-md mb-6">
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--bsky-text-primary)' }}>
                Sign in with your Bluesky account
              </h2>
              
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

              <div className="mb-4">
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
                <div className="mb-4">
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

              <div className="mb-4">
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

            {/* Security Info */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bsky-bg-secondary)' }}>
                <Shield size={18} style={{ color: 'var(--bsky-success)' }} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                    Your credentials go directly to Bluesky. We never store passwords.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bsky-bg-secondary)' }}>
                <Database size={18} style={{ color: 'var(--bsky-primary)' }} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                    All data stored locally on your device. Nothing sent to external servers.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Features */}
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--bsky-text-primary)' }}>
                What you'll get
              </h2>
              <p className="text-lg mb-6" style={{ color: 'var(--bsky-text-secondary)' }}>
                Transform your Bluesky notifications into insights. Track conversations, analyze engagement, never miss what matters.
              </p>
            </div>

            <div className="space-y-4">
              {/* Key Features */}
              <div className="bsky-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <Bell size={20} style={{ color: 'var(--bsky-primary)' }} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1" style={{ color: 'var(--bsky-text-primary)' }}>
                      Smart Notifications Feed
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                      All notifications organized with filters, aggregation, and unread tracking. See likes, reposts, follows, mentions, and replies in one place.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bsky-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <MessageSquare size={20} style={{ color: 'var(--bsky-success)' }} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1" style={{ color: 'var(--bsky-text-primary)' }}>
                      Conversation Tracking
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                      Never lose track of replies. See all conversations in threaded view with search and unread indicators.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bsky-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <BarChart3 size={20} style={{ color: 'rgb(168, 85, 247)' }} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1" style={{ color: 'var(--bsky-text-primary)' }}>
                      Engagement Analytics
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                      See trends, top engagers, and activity patterns. Understand when and how people interact with your content.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bsky-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <Zap size={20} style={{ color: 'rgb(250, 204, 21)' }} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1" style={{ color: 'var(--bsky-text-primary)' }}>
                      Lightning Fast & Works Offline
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                      Loads instantly with intelligent caching. Pre-fetches 4 weeks of data for offline access.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bsky-card p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <Activity size={20} style={{ color: 'rgb(251, 146, 60)' }} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1" style={{ color: 'var(--bsky-text-primary)' }}>
                      Visual Timeline
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                      Beautiful chronological view of your notifications with activity bursts and time gaps.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--bsky-bg-secondary)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} style={{ color: 'var(--bsky-primary)' }} />
                <span className="font-semibold" style={{ color: 'var(--bsky-text-primary)' }}>
                  100% Free & Open
                </span>
              </div>
              <p className="text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
                No ads, no tracking, no premium tiers. Just a useful tool for the Bluesky community.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}