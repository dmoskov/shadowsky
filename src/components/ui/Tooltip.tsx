import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  maxWidth?: number
  delay?: number
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  maxWidth = 250,
  delay = 200
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number>()

  const handleMouseEnter = () => {
    timeoutRef.current = window.setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const scrollX = window.scrollX
        const scrollY = window.scrollY

        let x = rect.left + scrollX
        let y = rect.top + scrollY

        switch (position) {
          case 'top':
            x = rect.left + rect.width / 2 + scrollX
            y = rect.top + scrollY - 8
            break
          case 'bottom':
            x = rect.left + rect.width / 2 + scrollX
            y = rect.bottom + scrollY + 8
            break
          case 'left':
            x = rect.left + scrollX - 8
            y = rect.top + rect.height / 2 + scrollY
            break
          case 'right':
            x = rect.right + scrollX + 8
            y = rect.top + rect.height / 2 + scrollY
            break
        }

        setCoords({ x, y })
        setIsVisible(true)
      }
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
        style={{ display: 'inline-block' }}
      >
        {children}
      </div>
      {isVisible && createPortal(
        <div
          className={`tooltip tooltip-${position}`}
          style={{
            position: 'absolute',
            left: coords.x,
            top: coords.y,
            maxWidth,
            transform: position === 'top' ? 'translate(-50%, -100%)' :
                      position === 'bottom' ? 'translate(-50%, 0)' :
                      position === 'left' ? 'translate(-100%, -50%)' :
                      'translate(0, -50%)',
            zIndex: 1000
          }}
        >
          <div className="tooltip-content">
            {content}
          </div>
        </div>,
        document.body
      )}
      <style jsx>{`
        .tooltip {
          background-color: var(--color-bg-secondary);
          color: var(--color-text-primary);
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.5;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border: 1px solid var(--color-border);
          pointer-events: none;
          animation: tooltip-fade-in 0.2s ease-out;
        }

        .tooltip-content {
          position: relative;
        }

        .tooltip-content h4 {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 600;
        }

        .tooltip-content p {
          margin: 0 0 8px 0;
        }

        .tooltip-content p:last-child {
          margin-bottom: 0;
        }

        .tooltip-content .formula {
          background-color: var(--color-bg-tertiary);
          padding: 8px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 13px;
          margin: 8px 0;
        }

        .tooltip-content .scale-info {
          font-size: 13px;
          color: var(--color-text-secondary);
          line-height: 1.6;
        }

        @keyframes tooltip-fade-in {
          from {
            opacity: 0;
            transform: translate(-50%, -100%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -100%) scale(1);
          }
        }

        .tooltip-bottom {
          animation-name: tooltip-fade-in-bottom;
        }

        @keyframes tooltip-fade-in-bottom {
          from {
            opacity: 0;
            transform: translate(-50%, 0) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
          }
        }

        .tooltip-left {
          animation-name: tooltip-fade-in-left;
        }

        @keyframes tooltip-fade-in-left {
          from {
            opacity: 0;
            transform: translate(-100%, -50%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-100%, -50%) scale(1);
          }
        }

        .tooltip-right {
          animation-name: tooltip-fade-in-right;
        }

        @keyframes tooltip-fade-in-right {
          from {
            opacity: 0;
            transform: translate(0, -50%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(0, -50%) scale(1);
          }
        }
      `}</style>
    </>
  )
}