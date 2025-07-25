import React, { useState } from 'react'
import { Cloud, CheckCircle, Users, MessageSquare, Settings, ArrowRight, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface WelcomeScreenProps {
  onComplete: () => void
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  
  const steps = [
    {
      icon: Cloud,
      title: "Welcome to Bluesky!",
      description: "Your journey on the decentralized social web starts here. Let's get you set up in just a few steps.",
      color: "from-blue-500 to-blue-600"
    },
    {
      icon: Users,
      title: "Connect with People",
      description: "Follow interesting people, discover communities, and join conversations that matter to you.",
      color: "from-purple-500 to-purple-600"
    },
    {
      icon: MessageSquare,
      title: "Share Your Thoughts",
      description: "Post updates, share images, and engage with others. Your content, your control.",
      color: "from-pink-500 to-pink-600"
    },
    {
      icon: Settings,
      title: "Customize Your Experience",
      description: "Personalize your feed, manage privacy settings, and make Bluesky truly yours.",
      color: "from-green-500 to-green-600"
    }
  ]
  
  const currentStepData = steps[currentStep]
  const Icon = currentStepData.icon
  
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      onComplete()
    }
  }
  
  const handleSkip = () => {
    onComplete()
  }
  
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-blue-500 rounded-full opacity-10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-purple-500 rounded-full opacity-10 blur-3xl animate-pulse animation-delay-2000" />
      </div>
      
      <div className="relative z-10 w-full max-w-lg">
        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
          aria-label="Skip onboarding"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1 rounded-full transition-all duration-300 ${
                index === currentStep
                  ? 'w-8 bg-white'
                  : index < currentStep
                  ? 'w-4 bg-white/60'
                  : 'w-4 bg-white/20'
              }`}
            />
          ))}
        </div>
        
        {/* Content */}
        <div className="text-center">
          {/* Animated icon */}
          <div className="mb-8 relative">
            <div className={`inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br ${currentStepData.color} rounded-full shadow-2xl transform transition-all duration-500 hover:scale-110`}>
              <Icon className="w-16 h-16 text-white" strokeWidth={1.5} />
            </div>
            {currentStep > 0 && (
              <div className="absolute -right-4 -top-4 bg-green-500 rounded-full p-2 shadow-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
          
          {/* Text content */}
          <h2 className="text-3xl font-bold text-white mb-4 transition-all duration-300">
            {currentStep === 0 && user?.displayName && (
              <span>Hi {user.displayName}! 👋</span>
            )}
            {currentStep === 0 && !user?.displayName && currentStepData.title}
            {currentStep > 0 && currentStepData.title}
          </h2>
          <p className="text-lg text-gray-300 mb-8 leading-relaxed">
            {currentStepData.description}
          </p>
          
          {/* Action buttons */}
          <div className="flex gap-4 justify-center">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-6 py-3 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-200"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-8 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center gap-2"
            >
              {currentStep === steps.length - 1 ? "Let's Go!" : 'Next'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Tips at the bottom */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-400">
            {currentStep === 0 && "This will only take a minute"}
            {currentStep === 1 && "You can always change who you follow later"}
            {currentStep === 2 && "Your first post can be anything!"}
            {currentStep === 3 && "You can skip this and set up later"}
          </p>
        </div>
      </div>
    </div>
  )
}