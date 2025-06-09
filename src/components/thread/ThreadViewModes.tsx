import React from 'react'
import { BookOpen } from 'lucide-react'

interface ThreadViewModesProps {
  isReaderMode: boolean
  onToggleReaderMode: () => void
}

export const ThreadViewModes: React.FC<ThreadViewModesProps> = ({
  isReaderMode,
  onToggleReaderMode
}) => {
  if (isReaderMode) return null
  
  return (
    <button 
      className="fixed bottom-6 right-6 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all hover:scale-110 z-20"
      onClick={onToggleReaderMode}
      title="Enter reader mode"
    >
      <BookOpen size={20} />
    </button>
  )
}