import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface DataPoint {
  date: string
  count: number
}

interface Props {
  currentFollowers: number
  timeRange: string
  historicalData?: Array<{
    date: string
    followersCount: number
  }>
}

export const FollowerGrowthChart: React.FC<Props> = ({ currentFollowers, timeRange, historicalData }) => {
  // Use real historical data if available, otherwise generate simulated data
  const generateHistoricalData = (): DataPoint[] => {
    if (historicalData && historicalData.length > 0) {
      return historicalData.map(snapshot => ({
        date: snapshot.date,
        count: snapshot.followersCount
      }))
    }
    
    // Fallback to simulated data if no historical data
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
    const data: DataPoint[] = []
    const today = new Date()
    
    // Simulate growth pattern (generally upward with some variance)
    const dailyGrowthRate = 0.002 + Math.random() * 0.003 // 0.2-0.5% daily growth
    const volatility = 0.1 // 10% volatility
    
    let followers = currentFollowers
    for (let i = days; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      
      // Add some realistic variance
      const variance = 1 + (Math.random() - 0.5) * volatility
      followers = Math.round(followers / (1 + dailyGrowthRate * variance))
      
      data.push({
        date: date.toISOString().split('T')[0],
        count: followers
      })
    }
    
    // Ensure the last point matches current followers
    data[data.length - 1].count = currentFollowers
    
    return data
  }
  
  const data = generateHistoricalData()
  
  // Check if we have enough historical data
  const hasHistoricalData = historicalData && historicalData.length > 1
  
  if (!hasHistoricalData) {
    return (
      <div className="follower-growth-chart">
        <div className="chart-header">
          <h4>Follower Growth</h4>
        </div>
        <div className="chart-no-data">
          <p>Historical data is building. Check back tomorrow to see your follower growth trends!</p>
          <div className="current-followers">
            <span className="followers-label">Current followers:</span>
            <span className="followers-count">{currentFollowers.toLocaleString()}</span>
          </div>
        </div>
      </div>
    )
  }
  
  const minCount = Math.min(...data.map(d => d.count))
  const maxCount = Math.max(...data.map(d => d.count))
  const range = maxCount - minCount || 1 // Avoid division by zero
  
  // Calculate growth metrics
  const startCount = data[0].count
  const growth = currentFollowers - startCount
  const growthPercent = ((growth / startCount) * 100).toFixed(1)
  const isGrowing = growth > 0
  const averageDaily = data.length > 1 ? Math.round(growth / (data.length - 1)) : 0
  
  // SVG dimensions
  const width = 400
  const height = 200
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  
  // Create SVG path
  const createPath = () => {
    return data.map((point, index) => {
      const x = (index / (data.length - 1)) * chartWidth + padding.left
      const y = height - padding.bottom - ((point.count - minCount) / range) * chartHeight
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
  }
  
  // Create area path (for gradient fill)
  const createAreaPath = () => {
    const linePath = createPath()
    const firstX = padding.left
    const lastX = chartWidth + padding.left
    return `${linePath} L ${lastX} ${height - padding.bottom} L ${firstX} ${height - padding.bottom} Z`
  }
  
  return (
    <div className="follower-growth-chart">
      <div className="chart-header">
        <h4>Follower Growth</h4>
        <div className="growth-stats">
          <div className="growth-stat">
            <span className={`growth-value ${isGrowing ? 'positive' : growth < 0 ? 'negative' : 'neutral'}`}>
              {isGrowing ? <TrendingUp size={16} /> : growth < 0 ? <TrendingDown size={16} /> : <Minus size={16} />}
              {isGrowing ? '+' : ''}{growth.toLocaleString()}
            </span>
            <span className="growth-label">({growthPercent}%)</span>
          </div>
          <div className="growth-stat">
            <span className="stat-label">Avg/day:</span>
            <span className="stat-value">{isGrowing ? '+' : ''}{averageDaily}</span>
          </div>
        </div>
      </div>
      
      <div className="chart-container">
        <svg width={width} height={height} className="growth-svg">
          <defs>
            <linearGradient id="followerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const y = padding.top + (1 - ratio) * chartHeight
            const value = Math.round(minCount + ratio * range)
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeOpacity="0.2"
                />
                <text
                  x={padding.left - 10}
                  y={y + 5}
                  textAnchor="end"
                  fill="var(--color-text-secondary)"
                  fontSize="12"
                >
                  {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                </text>
              </g>
            )
          })}
          
          {/* Area fill */}
          <motion.path
            d={createAreaPath()}
            fill="url(#followerGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
          
          {/* Line */}
          <motion.path
            d={createPath()}
            fill="none"
            stroke="var(--color-brand-primary)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />
          
          {/* Data points */}
          {data.map((point, index) => {
            const x = (index / (data.length - 1)) * chartWidth + padding.left
            const y = height - padding.bottom - ((point.count - minCount) / range) * chartHeight
            
            // Only show points at intervals
            if (index % Math.ceil(data.length / 7) !== 0 && index !== data.length - 1) return null
            
            return (
              <motion.circle
                key={index}
                cx={x}
                cy={y}
                r="4"
                fill="var(--color-brand-primary)"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.05, type: "spring" }}
                whileHover={{ scale: 1.5 }}
                style={{ cursor: 'pointer' }}
              >
                <title>{`${point.date}: ${point.count.toLocaleString()} followers`}</title>
              </motion.circle>
            )
          })}
          
          {/* X-axis labels */}
          {data.filter((_, i) => i % Math.ceil(data.length / 5) === 0 || i === data.length - 1).map((point, _index, _filtered) => {
            const originalIndex = data.indexOf(point)
            const x = (originalIndex / (data.length - 1)) * chartWidth + padding.left
            const date = new Date(point.date)
            const label = timeRange === '7d' 
              ? date.toLocaleDateString('en', { weekday: 'short' })
              : date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
            
            return (
              <text
                key={originalIndex}
                x={x}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                fill="var(--color-text-secondary)"
                fontSize="12"
              >
                {label}
              </text>
            )
          })}
        </svg>
      </div>
      
      <div className="chart-insights">
        <p className="insight-text">
          {isGrowing ? (
            <>Your audience has grown by <strong>{growthPercent}%</strong> in the last {timeRange === '7d' ? 'week' : timeRange === '30d' ? 'month' : '3 months'}.</>
          ) : growth < 0 ? (
            <>Your follower count decreased by <strong>{Math.abs(parseFloat(growthPercent))}%</strong> in the last {timeRange === '7d' ? 'week' : timeRange === '30d' ? 'month' : '3 months'}.</>
          ) : (
            <>Your follower count has remained stable over the last {timeRange === '7d' ? 'week' : timeRange === '30d' ? 'month' : '3 months'}.</>
          )}
        </p>
      </div>
    </div>
  )
}