import React, { useState, useEffect } from 'react'
import { Bookmark, BookmarkCheck, Trash2, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface BookmarkedItem {
  id: string
  type: 'post' | 'notification'
  uri: string
  author: {
    handle: string
    displayName?: string
    avatar?: string
  }
  text: string
  savedAt: string
}

export const Bookmarks: React.FC = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([])

  useEffect(() => {
    // Load bookmarks from localStorage
    const saved = localStorage.getItem('bsky-bookmarks')
    if (saved) {
      setBookmarks(JSON.parse(saved))
    }
  }, [])

  const removeBookmark = (id: string) => {
    const updated = bookmarks.filter(b => b.id !== id)
    setBookmarks(updated)
    localStorage.setItem('bsky-bookmarks', JSON.stringify(updated))
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Bookmarks</h1>
        <div className="text-sm text-gray-400">
          {bookmarks.length} saved items
        </div>
      </div>

      {bookmarks.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-12 text-center">
          <Bookmark className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No bookmarks yet</h3>
          <p className="text-sm text-gray-500">
            Save posts and notifications to easily find them later
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookmarks.map((bookmark) => (
            <div key={bookmark.id} className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                {bookmark.author.avatar ? (
                  <img 
                    src={bookmark.author.avatar} 
                    alt={bookmark.author.handle}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                    {bookmark.author.handle.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {bookmark.author.displayName || bookmark.author.handle}
                        </span>
                        <span className="text-sm text-gray-400">@{bookmark.author.handle}</span>
                        <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                          {bookmark.type}
                        </span>
                      </div>
                      <p className="text-gray-300 whitespace-pre-wrap">{bookmark.text}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>
                          Saved {formatDistanceToNow(new Date(bookmark.savedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                        title="Open in Bluesky"
                      >
                        <ExternalLink size={18} />
                      </button>
                      <button
                        onClick={() => removeBookmark(bookmark.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                        title="Remove bookmark"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-8 bg-blue-900/20 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <BookmarkCheck className="text-blue-500 mt-1" size={20} />
          <div>
            <h3 className="font-medium text-blue-400">Local Storage</h3>
            <p className="text-sm text-gray-400 mt-1">
              Bookmarks are saved locally in your browser. They won't sync across devices 
              and will be lost if you clear your browser data.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}