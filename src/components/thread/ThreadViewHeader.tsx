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
    <div className="thread-header">
      <button onClick={onBack} className="btn btn-icon btn-ghost">
        <ArrowLeft size={20} />
      </button>
      <h2 className="thread-title">Thread</h2>
      <div className="thread-header-controls">
        <button 
          onClick={onToggleCompactMode}
          className={clsx("btn btn-sm", isCompactMode ? "btn-primary" : "btn-ghost")}
          title="Toggle compact mode"
        >
          Compact
        </button>
        <button 
          onClick={onToggleReaderMode}
          className="btn btn-icon btn-ghost"
          title={isReaderMode ? "Exit reader mode" : "Enter reader mode"}
        >
          {isReaderMode ? <X size={20} /> : <BookOpen size={20} />}
        </button>
      </div>
    </div>
  )
}