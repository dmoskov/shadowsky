import React, { useEffect, useState } from 'react'
import { BarChart3, TrendingUp, Users, Clock, Activity, Zap, Database } from 'lucide-react'
import { analytics } from '../services/analytics'

interface AnalyticsEvent {
  category: string
  action: string
  label?: string
  value?: number
  timestamp: Date
}

interface PerformanceMetric {
  name: string
  value: number
  count: number
  average: number
  min: number
  max: number
}

export const AnalyticsDashboard: React.FC = () => {
  const [events, setEvents] = useState<AnalyticsEvent[]>([])
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([])
  const [userBehavior, setUserBehavior] = useState<Record<string, number>>({})

  // This is a mock implementation - in production, you would fetch this from your analytics backend
  useEffect(() => {
    // Mock data for demonstration
    const mockEvents: AnalyticsEvent[] = [
      { category: 'authentication', action: 'login', label: 'bluesky', timestamp: new Date() },
      { category: 'notifications', action: 'view', label: 'all', value: 150, timestamp: new Date() },
      { category: 'features', action: 'filter_changed', label: 'likes', timestamp: new Date() },
      { category: 'conversations', action: 'view', value: 5, timestamp: new Date() },
    ]
    
    const mockPerformance: PerformanceMetric[] = [
      { name: 'notification_load', value: 1200, count: 45, average: 1200, min: 800, max: 2500 },
      { name: 'cache_load', value: 150, count: 120, average: 150, min: 50, max: 300 },
      { name: 'background_load', value: 5000, count: 10, average: 5000, min: 3000, max: 8000 },
    ]
    
    const mockBehavior = {
      total_sessions: 150,
      avg_session_duration: 12.5,
      pages_per_session: 4.2,
      bounce_rate: 15,
      feature_adoption: 78,
    }
    
    setEvents(mockEvents)
    setPerformanceMetrics(mockPerformance)
    setUserBehavior(mockBehavior)
  }, [])

  const MetricCard: React.FC<{ icon: any; label: string; value: string | number; color: string; subtitle?: string }> = ({ 
    icon: Icon, label, value, color, subtitle 
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg bg-${color}-100 dark:bg-${color}-900/20`}>
          <Icon size={24} className={`text-${color}-600 dark:text-${color}-400`} />
        </div>
      </div>
      <div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Analytics Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor user behavior and application performance
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={Users}
          label="Total Sessions"
          value={userBehavior.total_sessions || 0}
          color="blue"
          subtitle="Last 30 days"
        />
        <MetricCard
          icon={Clock}
          label="Avg Session Duration"
          value={`${userBehavior.avg_session_duration || 0}m`}
          color="green"
        />
        <MetricCard
          icon={Activity}
          label="Feature Adoption"
          value={`${userBehavior.feature_adoption || 0}%`}
          color="purple"
        />
        <MetricCard
          icon={Zap}
          label="Avg Load Time"
          value={`${performanceMetrics[0]?.average || 0}ms`}
          color="yellow"
        />
      </div>

      {/* Performance Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <BarChart3 size={24} />
          Performance Metrics
        </h2>
        <div className="space-y-4">
          {performanceMetrics.map((metric) => (
            <div key={metric.name} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-gray-900 dark:text-white">
                  {metric.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h3>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {metric.count} samples
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Average: </span>
                  <span className="font-medium text-gray-900 dark:text-white">{metric.average}ms</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Min: </span>
                  <span className="font-medium text-gray-900 dark:text-white">{metric.min}ms</span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Max: </span>
                  <span className="font-medium text-gray-900 dark:text-white">{metric.max}ms</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Database size={24} />
          Recent Events
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Category</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Action</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Label</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Value</th>
                <th className="text-left py-2 px-3 text-sm font-medium text-gray-700 dark:text-gray-300">Time</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event, index) => (
                <tr key={index} className="border-b border-gray-100 dark:border-gray-700/50">
                  <td className="py-2 px-3 text-sm text-gray-900 dark:text-gray-300">{event.category}</td>
                  <td className="py-2 px-3 text-sm text-gray-900 dark:text-gray-300">{event.action}</td>
                  <td className="py-2 px-3 text-sm text-gray-900 dark:text-gray-300">{event.label || '-'}</td>
                  <td className="py-2 px-3 text-sm text-gray-900 dark:text-gray-300">{event.value || '-'}</td>
                  <td className="py-2 px-3 text-sm text-gray-600 dark:text-gray-400">
                    {event.timestamp.toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Note */}
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Note:</strong> This dashboard shows mock data for demonstration. 
          Connect to Google Analytics or your analytics backend to see real data.
        </p>
      </div>
    </div>
  )
}