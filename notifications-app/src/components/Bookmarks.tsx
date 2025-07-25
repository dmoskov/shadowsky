import React from 'react'
import { Bookmark } from 'lucide-react'

export const Bookmarks: React.FC = () => {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <Bookmark className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Bookmarks</h1>
          <p className="text-gray-400">
            Save your favorite posts and notifications
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Bookmarks functionality would be implemented here
          </p>
        </div>
      </div>
    </div>
  )
}