import React, { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { ATProtoError, RateLimitError, AuthenticationError } from '@bsky/shared'
import { performanceTracker } from '@bsky/shared'
import { Cloud, Sparkles, Users, Lock, Globe, MessageSquare, Shield, ArrowRight, Server, Smartphone } from 'lucide-react'

export const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [touched, setTouched] = useState({ identifier: false, password: false })
  const [showSecurityInfo, setShowSecurityInfo] = useState(false)
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
        setError(
          `Too many login attempts. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`
        )
      } else if (err instanceof AuthenticationError) {
        setError('Invalid username or password. Please check your credentials.')
      } else if (err instanceof ATProtoError) {
        setError(err.message || 'Login failed. Please try again.')
      } else {
        setError(
          'Unable to connect to Bluesky. Please check your internet connection and try again.'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-blue-500 rounded-full opacity-5 blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-purple-500 rounded-full opacity-5 blur-3xl animate-pulse animation-delay-2000" />
      </div>
      
      <div className="relative z-10 w-full max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-2xl mb-4 transform hover:scale-110 transition-transform duration-300">
            <Cloud className="w-12 h-12 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-4xl font-bold text-primary mb-2">Bluesky</h1>
          <p className="text-lg text-secondary">Connect with the open social web</p>
        </div>
        
        {/* Features showcase */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Globe className="w-6 h-6 text-blue-400" />
            </div>
            <p className="text-xs text-tertiary">Decentralized</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <p className="text-xs text-tertiary">Community</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 bg-pink-500/20 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Lock className="w-6 h-6 text-pink-400" />
            </div>
            <p className="text-xs text-tertiary">Your Data</p>
          </div>
        </div>
        
        {/* Security Trust Banner */}
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowSecurityInfo(!showSecurityInfo)}
            className="w-full bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-left hover:bg-green-500/15 transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-green-400" />
                <span className="text-sm font-medium text-green-400">Your credentials are safe</span>
              </div>
              <ArrowRight className={`w-4 h-4 text-green-400 transition-transform duration-200 ${showSecurityInfo ? 'rotate-90' : ''}`} />
            </div>
          </button>
          
          {showSecurityInfo && (
            <div className="mt-4 space-y-4 animate-in slide-in-from-top-2 duration-300">
              {/* Security Diagram */}
              <div className="bg-secondary/30 rounded-xl p-6 border border-border">
                <h3 className="text-sm font-semibold text-primary mb-4 text-center">How Your Login Works</h3>
                
                {/* Simple flow diagram */}
                <div className="flex items-center justify-between max-w-sm mx-auto">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Smartphone className="w-8 h-8 text-blue-400" />
                    </div>
                    <p className="text-xs text-secondary">Your Device</p>
                    <p className="text-xs text-tertiary mt-1">This client</p>
                  </div>
                  
                  <div className="flex-1 px-4">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-dashed border-green-400/40"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <ArrowRight className="w-6 h-6 text-green-400 bg-primary" />
                      </div>
                    </div>
                    <p className="text-xs text-green-400 text-center mt-2">Direct & Secure</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Server className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="text-xs text-secondary">Bluesky</p>
                    <p className="text-xs text-tertiary mt-1">Official servers</p>
                  </div>
                </div>
              </div>
              
              {/* Trust points */}
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                  </div>
                  <div>
                    <p className="text-sm text-primary font-medium">No credential storage</p>
                    <p className="text-xs text-tertiary">We never store your password - it goes directly to Bluesky</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                  </div>
                  <div>
                    <p className="text-sm text-primary font-medium">Open source client</p>
                    <p className="text-xs text-tertiary">This is just a frontend that talks to Bluesky's official API</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                  </div>
                  <div>
                    <p className="text-sm text-primary font-medium">Session-based auth</p>
                    <p className="text-xs text-tertiary">After login, we only keep a session token from Bluesky</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Login Card */}
        <div className="login-card backdrop-blur-xl rounded-2xl shadow-2xl p-8 border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-primary">Welcome back</h2>
            <Sparkles className="w-5 h-5 text-yellow-400" />
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Username or Email
              </label>
              <input
                type="text"
                placeholder="Enter your username or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onBlur={() => setTouched({ ...touched, identifier: true })}
                required
                disabled={loading}
                className={`login-input w-full rounded-lg border px-4 py-3 text-base transition-all duration-200 bg-tertiary text-primary ${
                  touched.identifier && !identifier.trim()
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-opacity-50 focus:border-blue-500'
                } ${
                  loading ? 'cursor-not-allowed opacity-50' : 'cursor-text'
                } focus:ring-2 focus:ring-blue-500/20 focus:outline-none`}
              />
              {touched.identifier && !identifier.trim() && (
                <div className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <span className="w-1 h-1 bg-red-400 rounded-full" />
                  Username or email is required
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched({ ...touched, password: true })}
                required
                disabled={loading}
                className={`login-input w-full rounded-lg border px-4 py-3 text-base transition-all duration-200 bg-tertiary text-primary ${
                  touched.password && !password
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-opacity-50 focus:border-blue-500'
                } ${
                  loading ? 'cursor-not-allowed opacity-50' : 'cursor-text'
                } focus:ring-2 focus:ring-blue-500/20 focus:outline-none`}
              />
              {touched.password && !password && (
                <div className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <span className="w-1 h-1 bg-red-400 rounded-full" />
                  Password is required
                </div>
              )}
            </div>
            
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-base font-medium text-white transition-all duration-200 ${
                loading 
                  ? 'cursor-not-allowed opacity-60' 
                  : 'cursor-pointer hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02]'
              } focus:ring-2 focus:ring-blue-500/50 focus:outline-none shadow-lg`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          
          {/* Additional options */}
          <div className="mt-6 pt-6 border-t">
            <p className="text-center text-sm text-tertiary">
              New to Bluesky?{' '}
              <a 
                href="https://bsky.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Create an account
              </a>
            </p>
          </div>
        </div>
        
        {/* Social proof */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <MessageSquare className="w-4 h-4" />
            <span>Join millions sharing their thoughts freely</span>
          </div>
        </div>
      </div>
    </div>
  )
}
