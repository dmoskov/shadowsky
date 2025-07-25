import React, { useState, useEffect } from 'react';
import { getErrorCount, getErrorSummary, clearErrors } from '@bsky/shared';

/**
 * Floating error badge for local development
 * Shows error count and provides quick access to error summary
 */
export const ErrorBadge: React.FC = () => {
  const [errorCount, setErrorCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Poll for error count updates
  useEffect(() => {
    const updateCount = () => {
      setErrorCount(getErrorCount());
    };
    
    // Initial count
    updateCount();
    
    // Poll every 2 seconds
    const interval = setInterval(updateCount, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Don't show if no errors
  if (errorCount === 0 && !isExpanded) return null;
  
  const handleClick = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      getErrorSummary();
    } else {
      setIsExpanded(false);
    }
  };
  
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearErrors();
    setErrorCount(0);
    setIsExpanded(false);
  };
  
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
      }}
    >
      <button
        onClick={handleClick}
        style={{
          background: errorCount > 0 ? '#ff4444' : '#00aaff',
          color: 'white',
          border: 'none',
          borderRadius: isExpanded ? '12px' : '50%',
          width: isExpanded ? 'auto' : '48px',
          height: isExpanded ? 'auto' : '48px',
          padding: isExpanded ? '12px 16px' : '0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          transition: 'all 0.2s ease',
          gap: '8px',
        }}
        title="Click to show error summary in console"
      >
        <span>🐛</span>
        {!isExpanded && errorCount > 0 && <span>{errorCount}</span>}
        {isExpanded && (
          <>
            <span>Check Console</span>
            <button
              onClick={handleClear}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'white',
              }}
            >
              Clear
            </button>
          </>
        )}
      </button>
    </div>
  );
};