import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'

interface Props {
  content: React.ReactNode
  children: React.ReactNode
  delay?: number
  position?: 'top' | 'bottom' | 'left' | 'right'
  maxWidth?: number
  className?: string
}

export const Tooltip: React.FC<Props> = ({ 
  content, 
  children, 
  delay = 200,
  position = 'top',
  maxWidth = 250,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    
    let x = 0
    let y = 0

    // Calculate base position
    switch (position) {
      case 'top':
        x = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2)
        y = triggerRect.top - tooltipRect.height - 8
        break
      case 'bottom':
        x = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2)
        y = triggerRect.bottom + 8
        break
      case 'left':
        x = triggerRect.left - tooltipRect.width - 8
        y = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2)
        break
      case 'right':
        x = triggerRect.right + 8
        y = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2)
        break
    }

    // Keep tooltip within viewport
    const padding = 10
    x = Math.max(padding, Math.min(x, window.innerWidth - tooltipRect.width - padding))
    y = Math.max(padding, Math.min(y, window.innerHeight - tooltipRect.height - padding))

    setCoords({ x, y })
  }

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    if (isVisible) {
      calculatePosition()
    }
  }, [isVisible])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const tooltipElement = isVisible && (
    <div
      ref={tooltipRef}
      className={`bsky-tooltip ${className}`}
      style={{
        position: 'fixed',
        left: `${coords.x}px`,
        top: `${coords.y}px`,
        zIndex: 10000,
        maxWidth: `${maxWidth}px`,
        opacity: coords.x === 0 && coords.y === 0 ? 0 : 1,
        transition: 'opacity 200ms ease-in-out',
        pointerEvents: 'none',
      }}
    >
      {/* Use div wrapper for complex content, span for simple text */}
      {typeof content === 'string' ? (
        <span className="bsky-tooltip-text">{content}</span>
      ) : (
        <div className="bsky-tooltip-content">{content}</div>
      )}
    </div>
  )

  return (
    <>
      <div 
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'inline-block', cursor: 'help' }}
      >
        {children}
      </div>
      {tooltipElement && ReactDOM.createPortal(tooltipElement, document.body)}
    </>
  )
}