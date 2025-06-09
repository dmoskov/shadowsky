import React from 'react'
import { ArrowLeft, BookOpen, X } from 'lucide-react'
import clsx from 'clsx'

interface ThreadViewHeaderProps {
  onBack: () => void
  isReaderMode: boolean
  isCompactMode: boolean
  onToggleReaderMode: () => void
  onToggleCompactMode: () => void
}

export const ThreadViewHeader: React.FC<ThreadViewHeaderProps> = ({
  onBack,
  isReaderMode,
  isCompactMode,
  onToggleReaderMode,
  onToggleCompactMode
}) => {
  return (
    <div className="sticky top-0 z-30 bg-gray-900 border-b border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-xl font-semibold">Thread</h2>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onToggleCompactMode}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              isCompactMode 
                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            )}
            title="Toggle compact mode"
          >
            Compact
          </button>
          <button 
            onClick={onToggleReaderMode}
            className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
            title={isReaderMode ? "Exit reader mode" : "Enter reader mode"}
          >
            {isReaderMode ? <X size={20} /> : <BookOpen size={20} />}
          </button>
        </div>
      </div>
    </div>
  )
}