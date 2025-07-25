import React from 'react'
import { MessageSquare, Lock, MessageCircle } from 'lucide-react'

export const Messages: React.FC = () => {
  // Note: Direct messages are not yet part of the AT Protocol public API
  // This is a placeholder UI for when the feature becomes available

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>

      <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Lock className="text-yellow-500 mt-1" size={20} />
          <div>
            <h3 className="font-medium text-yellow-400">Coming Soon</h3>
            <p className="text-sm text-gray-400 mt-1">
              Direct messaging is not yet available in the AT Protocol public API. 
              This feature will be enabled once the protocol supports it.
            </p>
          </div>
        </div>
      </div>

      {/* Mock UI for future implementation */}
      <div className="bg-gray-800 rounded-lg">
        {/* Message list header */}
        <div className="border-b border-gray-700 p-4">
          <h2 className="font-semibold">Conversations</h2>
        </div>

        {/* Empty state */}
        <div className="p-12 text-center">
          <MessageCircle className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No messages yet</h3>
          <p className="text-sm text-gray-500">
            When direct messaging becomes available, your conversations will appear here
          </p>
        </div>

        {/* Mock conversation items for UI preview */}
        <div className="divide-y divide-gray-700 opacity-50 pointer-events-none">
          {['alice.bsky.social', 'bob.bsky.social', 'carol.bsky.social'].map((handle) => (
            <div key={handle} className="flex items-center gap-3 p-4 hover:bg-gray-700/50 transition-colors">
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                {handle.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">@{handle}</h4>
                    <p className="text-sm text-gray-400 mt-0.5">Preview message text...</p>
                  </div>
                  <span className="text-xs text-gray-500">2h ago</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}