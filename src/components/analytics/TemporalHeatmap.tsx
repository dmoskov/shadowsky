import React from 'react'
import { motion } from 'framer-motion'
import type { TemporalPattern } from '../../services/atproto/analytics'

interface Props {
  patterns: TemporalPattern[]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export const TemporalHeatmap: React.FC<Props> = ({ patterns }) => {
  // Create a map for quick lookup
  const patternMap = new Map<string, TemporalPattern>()
  patterns.forEach(pattern => {
    const key = `${pattern.hour}-${pattern.dayOfWeek}`
    patternMap.set(key, pattern)
  })

  // Find max values for scaling
  const maxCount = Math.max(...patterns.map(p => p.count), 1)
  const maxEngagement = Math.max(...patterns.map(p => p.avgEngagement), 1)

  const getIntensity = (hour: number, day: number): number => {
    const pattern = patternMap.get(`${hour}-${day}`)
    if (!pattern) return 0
    
    // Combine count and engagement for intensity
    const countScore = pattern.count / maxCount
    const engagementScore = pattern.avgEngagement / maxEngagement
    return (countScore * 0.5 + engagementScore * 0.5) * 100
  }

  const getTooltipText = (hour: number, day: number): string => {
    const pattern = patternMap.get(`${hour}-${day}`)
    if (!pattern) return 'No posts'
    
    const hourStr = hour < 12 ? `${hour || 12}am` : `${hour === 12 ? 12 : hour - 12}pm`
    return `${DAYS[day]} ${hourStr}: ${pattern.count} posts, avg ${pattern.avgEngagement} engagement`
  }

  return (
    <div className="temporal-heatmap">
      <div className="heatmap-container">
        <div className="heatmap-grid">
          {/* Hour labels */}
          <div className="heatmap-labels-row">
            <div className="heatmap-corner"></div>
            {HOURS.map(hour => (
              <div key={hour} className="heatmap-hour-label">
                {hour === 0 ? '12a' : hour < 12 ? hour : hour === 12 ? '12p' : hour - 12}
              </div>
            ))}
          </div>
          
          {/* Day rows */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="heatmap-row">
              <div className="heatmap-day-label">{day}</div>
              {HOURS.map(hour => {
                const intensity = getIntensity(hour, dayIndex)
                const tooltipText = getTooltipText(hour, dayIndex)
                
                return (
                  <motion.div
                    key={`${hour}-${dayIndex}`}
                    className="heatmap-cell"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ 
                      delay: (dayIndex * 24 + hour) * 0.001,
                      duration: 0.2 
                    }}
                    whileHover={{ scale: 1.2 }}
                    title={tooltipText}
                  >
                    <div 
                      className="heatmap-cell-inner"
                      style={{
                        backgroundColor: `hsl(200, 70%, ${90 - intensity * 0.7}%)`,
                        opacity: intensity > 0 ? 1 : 0.2
                      }}
                    />
                  </motion.div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      
      <div className="heatmap-legend">
        <span className="legend-label">Less active</span>
        <div className="legend-gradient">
          {[0, 25, 50, 75, 100].map(value => (
            <div 
              key={value}
              className="legend-block"
              style={{
                backgroundColor: `hsl(200, 70%, ${90 - value * 0.7}%)`
              }}
            />
          ))}
        </div>
        <span className="legend-label">More active</span>
      </div>
      
      <div className="heatmap-insights">
        <p className="insight">
          <strong>Peak Activity:</strong> Your audience is most engaged during 
          {' ' + identifyPeakTimes(patterns)}
        </p>
      </div>
    </div>
  )
}

function identifyPeakTimes(patterns: TemporalPattern[]): string {
  if (patterns.length === 0) return 'insufficient data'
  
  // Find top 3 time slots by engagement
  const topSlots = [...patterns]
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, 3)
  
  if (topSlots.length === 0) return 'insufficient data'
  
  // Group by general time periods
  const timeGroups = {
    morning: topSlots.filter(s => s.hour >= 6 && s.hour < 12),
    afternoon: topSlots.filter(s => s.hour >= 12 && s.hour < 17),
    evening: topSlots.filter(s => s.hour >= 17 && s.hour < 22),
    night: topSlots.filter(s => s.hour >= 22 || s.hour < 6)
  }
  
  const dominantPeriod = Object.entries(timeGroups)
    .sort(([, a], [, b]) => b.length - a.length)[0]
  
  return `${dominantPeriod[0]} hours`
}