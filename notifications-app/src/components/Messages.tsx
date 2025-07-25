import React from 'react'
import { MessageSquare } from 'lucide-react'

export const Messages: React.FC = () => {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <MessageSquare className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Messages</h1>
          <p className="text-gray-400">
            Your direct messages and conversations
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Messages functionality would be implemented here
          </p>
        </div>
      </div>
    </div>
  )
}