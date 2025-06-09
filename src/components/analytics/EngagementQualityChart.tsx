import React from 'react'
import { motion } from 'framer-motion'
import { HelpCircle } from 'lucide-react'
import type { EngagementQualityScore } from '../../services/atproto/analytics'
import { Tooltip } from '../ui/Tooltip'

interface Props {
  data: EngagementQualityScore
}

export const EngagementQualityChart: React.FC<Props> = ({ data }) => {
  const metrics = [
    { 
      label: 'Conversation Depth', 
      value: data.conversationDepth,
      color: 'var(--color-brand-primary)',
      description: 'How deeply people engage with your content',
      tooltip: (
        <>
          <h4>Conversation Depth</h4>
          <p>Measures meaningful discussions your posts generate through replies and quotes.</p>
          <div className="formula">
            Score = (Reply Score × 60%) + (Quote Score × 40%)
          </div>
          <p className="scale-info">
            • 0.5 replies/post = 50 points<br/>
            • 1 reply/post = 69 points<br/>
            • 2 replies/post = 80 points<br/>
            • 5 replies/post = 91 points
          </p>
          <p className="scale-info">Uses logarithmic scaling to prevent gaming with excessive replies.</p>
        </>
      )
    },
    { 
      label: 'Content Resonance', 
      value: data.contentResonance,
      color: 'var(--color-brand-secondary)',
      description: 'How well your content connects with your audience',
      tooltip: (
        <>
          <h4>Content Resonance</h4>
          <p>Measures how strongly your content connects with your audience through engagement.</p>
          <div className="formula">
            Score = √(Engagement Rate × 100) × 10
          </div>
          <p className="scale-info">
            • 0.1% engagement = 32 points<br/>
            • 0.5% engagement = 71 points<br/>
            • 1% engagement = 100 points
          </p>
          <p className="scale-info">Based on total engagements per post relative to follower count.</p>
        </>
      )
    },
    { 
      label: 'Network Amplification', 
      value: data.networkAmplification,
      color: 'var(--color-success)',
      description: 'How far your content spreads beyond direct followers',
      tooltip: (
        <>
          <h4>Network Amplification</h4>
          <p>Measures how effectively your content spreads beyond your immediate network.</p>
          <div className="formula">
            Score = √(Amplification Rate × 200) × 10
          </div>
          <p className="scale-info">
            • Amplification Rate = (Reposts + Quotes×0.5) / Followers<br/>
            • 0.05% amplification = 32 points<br/>
            • 0.25% amplification = 71 points<br/>
            • 0.5% amplification = 100 points
          </p>
          <p className="scale-info">Quotes weighted at 50% since they add context.</p>
        </>
      )
    },
    { 
      label: 'Consistency', 
      value: data.consistency,
      color: 'var(--color-warning)',
      description: 'Your posting regularity and rhythm',
      tooltip: (
        <>
          <h4>Consistency</h4>
          <p>Measures how regularly you post to maintain audience engagement.</p>
          <div className="formula">
            Based on average days between posts
          </div>
          <p className="scale-info">
            • ≤3 days = 100 points (daily posting)<br/>
            • ≤7 days = 80 points (weekly)<br/>
            • ≤14 days = 60 points (bi-weekly)<br/>
            • ≤30 days = 40 points (monthly)<br/>
            • &gt;30 days = 20 points (irregular)
          </p>
          <p className="scale-info">Regular posting helps maintain audience engagement.</p>
        </>
      )
    }
  ]

  return (
    <div className="eqs-chart">
      <div className="eqs-breakdown">
        {metrics.map((metric, index) => (
          <motion.div 
            key={metric.label}
            className="eqs-metric"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="metric-header">
              <Tooltip content={metric.tooltip} position="top" maxWidth={350} className="analytics-tooltip">
                <span className="metric-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {metric.label}
                  <HelpCircle size={14} style={{ opacity: 0.5 }} />
                </span>
              </Tooltip>
              <span className="metric-value">{metric.value}</span>
            </div>
            <div className="metric-bar">
              <motion.div 
                className="metric-bar-fill"
                style={{ backgroundColor: metric.color }}
                initial={{ width: 0 }}
                animate={{ width: `${metric.value}%` }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
              />
            </div>
            <p className="metric-description">{metric.description}</p>
          </motion.div>
        ))}
      </div>
      
      {/* Radar Chart Alternative - Simple Visual */}
      <div className="eqs-visual">
        <svg viewBox="0 0 200 200" className="eqs-radar">
          <defs>
            <linearGradient id="eqsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--color-brand-secondary)" stopOpacity="0.3" />
            </linearGradient>
          </defs>
          
          {/* Background circles */}
          {[20, 40, 60, 80, 100].map(radius => (
            <circle
              key={radius}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="1"
              opacity="0.2"
            />
          ))}
          
          {/* Score polygon */}
          <motion.polygon
            points={calculatePolygonPoints(metrics.map(m => m.value))}
            fill="url(#eqsGradient)"
            stroke="var(--color-brand-primary)"
            strokeWidth="2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.8, type: "spring" }}
          />
        </svg>
      </div>
    </div>
  )
}

function calculatePolygonPoints(values: number[]): string {
  const center = 100
  const angleStep = (2 * Math.PI) / values.length
  
  return values
    .map((value, index) => {
      const angle = index * angleStep - Math.PI / 2
      const x = center + value * Math.cos(angle)
      const y = center + value * Math.sin(angle)
      return `${x},${y}`
    })
    .join(' ')
}