import React from 'react'
import { motion } from 'framer-motion'

interface Props {
  data: number[]
  width?: number
  height?: number
  color?: string
  strokeWidth?: number
}

export const Sparkline: React.FC<Props> = ({ 
  data, 
  width = 80, 
  height = 30,
  color = 'var(--color-brand-primary)',
  strokeWidth = 2
}) => {
  if (data.length === 0) return null
  
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  
  // Add padding
  const padding = 2
  const chartWidth = width - (padding * 2)
  const chartHeight = height - (padding * 2)
  
  // Create SVG path
  const createPath = () => {
    return data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth
      const y = padding + (1 - (value - min) / range) * chartHeight
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
  }
  
  // Create gradient area path
  const createAreaPath = () => {
    const linePath = createPath()
    const lastX = padding + chartWidth
    const bottomY = padding + chartHeight
    return `${linePath} L ${lastX} ${bottomY} L ${padding} ${bottomY} Z`
  }
  
  // Determine trend
  const firstThird = data.slice(0, Math.floor(data.length / 3))
  const lastThird = data.slice(-Math.floor(data.length / 3))
  const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length
  const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length
  const trend = lastAvg > firstAvg ? 'up' : lastAvg < firstAvg ? 'down' : 'flat'
  
  return (
    <div className="sparkline" style={{ width, height }}>
      <svg width={width} height={height} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={`sparklineGradient-${data.join('')}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        {/* Area fill */}
        <motion.path
          d={createAreaPath()}
          fill={`url(#sparklineGradient-${data.join('')})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
        
        {/* Line */}
        <motion.path
          d={createPath()}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
        
        {/* End point */}
        <motion.circle
          cx={padding + chartWidth}
          cy={padding + (1 - (data[data.length - 1] - min) / range) * chartHeight}
          r="3"
          fill={color}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring" }}
        />
      </svg>
    </div>
  )
}