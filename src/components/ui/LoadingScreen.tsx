import React from 'react'
import { Cloud } from 'lucide-react'

export const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-blue-500 rounded-full opacity-10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-purple-500 rounded-full opacity-10 blur-3xl animate-pulse animation-delay-2000" />
      </div>
      
      <div className="relative z-10 text-center">
        {/* Animated logo */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full shadow-2xl animate-float">
            <Cloud className="w-14 h-14 text-white" strokeWidth={2} />
          </div>
        </div>
        
        {/* Loading text */}
        <h2 className="text-2xl font-bold text-white mb-4">Welcome to Bluesky</h2>
        <p className="text-gray-300 mb-8">Setting up your experience...</p>
        
        {/* Animated progress dots */}
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        
        {/* Fun loading messages that cycle */}
        <div className="mt-8">
          <LoadingMessage />
        </div>
      </div>
    </div>
  )
}

const LoadingMessage: React.FC = () => {
  const messages = [
    "Connecting to the decentralized web...",
    "Loading your timeline...",
    "Fetching the latest posts...",
    "Preparing your personalized feed...",
    "Almost there..."
  ]
  
  const [currentMessage, setCurrentMessage] = React.useState(0)
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % messages.length)
    }, 2000)
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <p className="text-sm text-gray-400 transition-opacity duration-500">
      {messages[currentMessage]}
    </p>
  )
}