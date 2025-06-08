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
  const timeoutRef = useRef<NodeJS.Timeout>()

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const scrollX = window.scrollX
      const scrollY = window.scrollY
      
      let x = rect.left + scrollX + rect.width / 2
      let y = rect.top + scrollY
      
      switch (position) {
        case 'bottom':
          y = rect.bottom + scrollY
          break
        case 'left':
          x = rect.left + scrollX
          y = rect.top + scrollY + rect.height / 2
          break
        case 'right':
          x = rect.right + scrollX
          y = rect.top + scrollY + rect.height / 2
          break
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

  const getTooltipStyle = () => {
    const style: React.CSSProperties = {
      position: 'absolute',
      maxWidth,
      zIndex: 9999,
    }
    
    switch (position) {
      case 'top':
        style.bottom = '100%'
        style.left = '50%'
        style.transform = 'translateX(-50%)'
        style.marginBottom = '8px'
        break
      case 'bottom':
        style.top = '100%'
        style.left = '50%'
        style.transform = 'translateX(-50%)'
        style.marginTop = '8px'
        break
      case 'left':
        style.right = '100%'
        style.top = '50%'
        style.transform = 'translateY(-50%)'
        style.marginRight = '8px'
        break
      case 'right':
        style.left = '100%'
        style.top = '50%'
        style.transform = 'translateY(-50%)'
        style.marginLeft = '8px'
        break
    }
    
    return style
  }

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
            left: coords.x,
            top: coords.y,
            pointerEvents: 'none',
            zIndex: 'var(--z-tooltip)',
            opacity: isVisible ? 1 : 0,
            transition: 'opacity var(--transition-hover)',
          }}
        >
          <div style={{ position: 'relative' }}>
            <div 
              className="tooltip-content"
              style={{
                ...getTooltipStyle(),
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)',
                padding: 'var(--spacing-1) var(--spacing-2)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-sm)',
                whiteSpace: 'nowrap',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {content}
            </div>
          </div>
        </div>
      )}
    </>
  )
}