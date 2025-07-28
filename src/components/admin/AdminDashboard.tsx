import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { ErrorMessage } from '../ui/ErrorMessage'
import { Button } from '../ui/Button'
import { Shield, Users, Activity, Settings, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { debug } from '@bsky/shared'

interface SystemStats {
  totalUsers: number
  activeUsers: number
  totalPosts: number
  rateLimit: {
    remaining: number
    reset: Date
  }
  serverHealth: 'healthy' | 'degraded' | 'down'
}

export const AdminDashboard: React.FC = () => {
  const { session, client } = useAuth()
  const [selectedTab, setSelectedTab] = useState<'overview' | 'users' | 'content' | 'settings'>('overview')

  // Check if user is admin
  debug.log('Current session handle:', session?.handle)
  const isAdmin = session?.handle === 'moskov.goodventures.org'
  debug.log('Is admin check:', isAdmin)

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      // Mock data for now - replace with actual API calls
      return {
        totalUsers: 15234,
        activeUsers: 3421,
        totalPosts: 89432,
        rateLimit: {
          remaining: 2985,
          reset: new Date(Date.now() + 3600000)
        },
        serverHealth: 'healthy'
      } as SystemStats
    },
    enabled: isAdmin,
    refetchInterval: 30000 // Refresh every 30 seconds
  })

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="bg-red-950 border-red-900">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-200 mb-2">Access Denied</h2>
            <p className="text-red-300">You do not have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <ErrorMessage error={error as Error} />
      </div>
    )
  }

  const healthIcon = stats?.serverHealth === 'healthy' ? 
    <CheckCircle className="w-5 h-5 text-green-500" /> : 
    stats?.serverHealth === 'degraded' ? 
    <AlertTriangle className="w-5 h-5 text-yellow-500" /> : 
    <XCircle className="w-5 h-5 text-red-500" />

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-8 h-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-100">Admin Dashboard</h1>
        </div>
        <p className="text-gray-400">Welcome back, @{session?.handle}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-8 border-b border-gray-800">
        <button
          onClick={() => setSelectedTab('overview')}
          className={`pb-4 px-2 font-medium transition-colors ${
            selectedTab === 'overview' 
              ? 'text-blue-500 border-b-2 border-blue-500' 
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setSelectedTab('users')}
          className={`pb-4 px-2 font-medium transition-colors ${
            selectedTab === 'users' 
              ? 'text-blue-500 border-b-2 border-blue-500' 
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Users
        </button>
        <button
          onClick={() => setSelectedTab('content')}
          className={`pb-4 px-2 font-medium transition-colors ${
            selectedTab === 'content' 
              ? 'text-blue-500 border-b-2 border-blue-500' 
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Content
        </button>
        <button
          onClick={() => setSelectedTab('settings')}
          className={`pb-4 px-2 font-medium transition-colors ${
            selectedTab === 'settings' 
              ? 'text-blue-500 border-b-2 border-blue-500' 
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Settings
        </button>
      </div>

      {/* Content */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Server Health */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Server Health
                {healthIcon}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-100 capitalize">
                {stats?.serverHealth || 'Unknown'}
              </p>
            </CardContent>
          </Card>

          {/* Total Users */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-400" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-100">
                {stats?.totalUsers.toLocaleString()}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {stats?.activeUsers.toLocaleString()} active today
              </p>
            </CardContent>
          </Card>

          {/* Total Posts */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-gray-400" />
                Total Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-100">
                {stats?.totalPosts.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {/* Rate Limits */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle>Rate Limit Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-100">
                {stats?.rateLimit.remaining.toLocaleString()}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Resets {new Date(stats?.rateLimit.reset || 0).toLocaleTimeString()}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === 'users' && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400">User management features coming soon...</p>
          </CardContent>
        </Card>
      )}

      {selectedTab === 'content' && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>Content Moderation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400">Content moderation features coming soon...</p>
          </CardContent>
        </Card>
      )}

      {selectedTab === 'settings' && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle>Admin Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400">Admin settings coming soon...</p>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Clear Cache
          </Button>
          <Button variant="outline" size="sm">
            <Activity className="w-4 h-4 mr-2" />
            Export Analytics
          </Button>
          <Button variant="outline" size="sm">
            <Users className="w-4 h-4 mr-2" />
            View Logs
          </Button>
        </div>
      </div>
    </div>
  )
}