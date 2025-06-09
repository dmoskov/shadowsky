import React from 'react'
import { motion } from 'framer-motion'
import type { NetworkMetrics } from '../../services/atproto/analytics'

interface Props {
  metrics: NetworkMetrics
}

export const NetworkGraph: React.FC<Props> = ({ metrics }) => {
  const { topEngagers } = metrics
  
  // Simple network visualization without D3
  const maxInteractions = topEngagers.length > 0 
    ? Math.max(...topEngagers.map(e => e.interactions), 1) 
    : 1
  
  if (topEngagers.length === 0) {
    return (
      <div className="network-graph">
        <div className="network-empty-state">
          <h4>Active Engagers</h4>
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 'var(--spacing-xl)' }}>
            No engagement data available yet. Post more content to see who interacts with your posts!
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="network-graph">
      <div className="engagers-list">
        <h4>Most Active Engagers</h4>
        <div className="engager-items">
          {topEngagers.slice(0, 10).map((engager, index) => {
            const intensity = engager.interactions / maxInteractions
            
            return (
              <motion.div
                key={engager.did}
                className="engager-item"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="engager-avatar">
                  <div 
                    className="avatar-placeholder"
                    style={{
                      backgroundColor: `hsl(${index * 36}, 70%, 50%)`,
                      transform: `scale(${0.8 + intensity * 0.4})`
                    }}
                  >
                    {engager.handle.charAt(0).toUpperCase()}
                  </div>
                </div>
                
                <div className="engager-info">
                  <span className="engager-handle">@{engager.handle}</span>
                  <div className="interaction-bar">
                    <motion.div 
                      className="interaction-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${intensity * 100}%` }}
                      transition={{ duration: 0.8, delay: index * 0.05 }}
                    />
                  </div>
                </div>
                
                <div className="interaction-count">
                  {engager.interactions} interactions
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
      
      {/* Simple network visualization */}
      <div className="network-visual">
        <svg viewBox="0 0 300 200" className="network-svg">
          {/* Center node (you) */}
          <motion.circle
            cx="150"
            cy="100"
            r="20"
            fill="var(--color-primary)"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
          />
          
          {/* Connected nodes */}
          {topEngagers.slice(0, 8).map((engager, index) => {
            const angle = (index / 8) * 2 * Math.PI
            const distance = 60 + (1 - engager.interactions / maxInteractions) * 30
            const x = 150 + Math.cos(angle) * distance
            const y = 100 + Math.sin(angle) * distance
            const nodeSize = 10 + (engager.interactions / maxInteractions) * 10
            
            return (
              <g key={engager.did}>
                {/* Connection line */}
                <motion.line
                  x1="150"
                  y1="100"
                  x2={x}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeWidth="1"
                  opacity="0.3"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                />
                
                {/* Node */}
                <motion.circle
                  cx={x}
                  cy={y}
                  r={nodeSize}
                  fill={`hsl(${index * 45}, 70%, 50%)`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ 
                    type: "spring", 
                    duration: 0.5, 
                    delay: index * 0.1 
                  }}
                  whileHover={{ scale: 1.2 }}
                  title={`@${engager.handle}`}
                />
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}