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
      className="thread-reader-toggle"
      onClick={onToggleReaderMode}
      title="Enter reader mode"
    >
      <BookOpen size={20} />
    </button>
  )
}