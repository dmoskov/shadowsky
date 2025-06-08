import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Sparkline } from './Sparkline'

interface Props {
  icon: React.ReactNode
  title: string | React.ReactNode
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  subtitle?: string
  sparklineData?: number[]
}

export const MetricCard: React.FC<Props> = ({ 
  icon, 
  title, 
  value, 
  change, 
  trend = 'neutral',
  subtitle,
  sparklineData 
}) => {
  return (
    <motion.div 
      className="metric-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      <div className="metric-icon">{icon}</div>
      <div className="metric-content">
        <h4 className="metric-title">{title}</h4>
        <div className="metric-value">{value}</div>
        {subtitle && <p className="metric-subtitle">{subtitle}</p>}
        {change && (
          <div className={`metric-change ${trend}`}>
            {trend === 'up' && <TrendingUp size={14} />}
            {trend === 'down' && <TrendingDown size={14} />}
            <span>{change}</span>
          </div>
        )}
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="metric-sparkline">
          <Sparkline 
            data={sparklineData} 
            color={trend === 'up' ? 'var(--color-success)' : trend === 'down' ? 'var(--color-error)' : 'var(--color-brand-primary)'}
          />
        </div>
      )}
    </motion.div>
  )
}