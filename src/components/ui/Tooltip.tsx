import React, { useState, useRef, useEffect } from 'react'

interface Props {
  content: React.ReactNode
  children: React.ReactNode
  delay?: number
  position?: 'top' | 'bottom' | 'left' | 'right'
  maxWidth?: number
}

export const Tooltip: React.FC<Props> = ({ 
  content, 
  children, 
  delay = 200,
  position = 'top',
  maxWidth = 200
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      
      // Use fixed positioning coordinates (no scroll offset needed)
      let x = rect.left + rect.width / 2
      let y = rect.top
      
      // Adjust position based on prop
      switch (position) {
        case 'bottom':
          y = rect.bottom
          break
        case 'left':
          x = rect.left
          y = rect.top + rect.height / 2
          break
        case 'right':
          x = rect.right
          y = rect.top + rect.height / 2
          break
      }
      
      // Ensure tooltip stays within viewport bounds
      // Account for tooltip being centered
      const halfWidth = maxWidth / 2
      if (x - halfWidth < 10) {
        x = halfWidth + 10
      } else if (x + halfWidth > viewportWidth - 10) {
        x = viewportWidth - halfWidth - 10
      }
      
      // Ensure vertical bounds
      if (position === 'top' && y < 100) {
        // Not enough space above, flip to bottom
        y = rect.bottom
      } else if (position === 'bottom' && y + 100 > viewportHeight) {
        // Not enough space below, flip to top
        y = rect.top
      }
      
      setCoords({ x, y })
    }
    
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
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

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
      
      {isVisible && (
        <div
          className="tooltip-container"
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        >
          <div 
            ref={tooltipRef}
            className="tooltip-content"
            style={{
              position: 'absolute',
              left: coords.x,
              top: coords.y,
              transform: position === 'top' || position === 'bottom' 
                ? 'translate(-50%, ' + (position === 'top' ? '-100%' : '0') + ')' 
                : 'translate(' + (position === 'left' ? '-100%' : '0') + ', -50%)',
              marginTop: position === 'top' ? '-8px' : position === 'bottom' ? '8px' : '0',
              marginLeft: position === 'left' ? '-8px' : position === 'right' ? '8px' : '0',
              maxWidth: maxWidth + 'px',
              // Only apply default styles if content is a string
              ...(typeof content === 'string' ? {
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)',
                padding: 'var(--spacing-2) var(--spacing-3)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-sm)',
                lineHeight: '1.4',
                whiteSpace: 'normal',
                wordWrap: 'break-word',
                boxShadow: 'var(--shadow-md)',
                border: '1px solid var(--color-border-secondary)',
              } : {}),
              opacity: isVisible ? 1 : 0,
              transition: 'opacity 200ms ease-in-out',
            }}
          >
            {content}
          </div>
        </div>
      )}
    </>
  )
}