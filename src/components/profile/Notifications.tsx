import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { 
  ArrowLeft,
  Heart,
  Repeat2,
  UserPlus,
  MessageCircle,
  AtSign,
  Quote,
  Users,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { useNotifications, useMarkNotificationsRead, getNotificationText } from '../../hooks/useNotifications'
import { LoadingSpinner } from '../ui/LoadingSpinner'
import { aggregateNotifications, getAggregatedText } from '../../utils/notification-helpers'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'
import type { ProcessedNotification } from '../../utils/notification-helpers'

export const Notifications: React.FC = () => {
  const navigate = useNavigate()
  
  // Tab state: 'all' or 'following'
  const [activeTab, setActiveTab] = useState<'all' | 'following'>(() => {
    const saved = localStorage.getItem('notifications-tab')
    return (saved === 'following' ? 'following' : 'all') as 'all' | 'following'
  })
  
  // Track expanded aggregations
  const [expandedAggregations, setExpandedAggregations] = useState<Set<string>>(new Set())
  
  const { data, isLoading, error } = useNotifications(activeTab === 'following')
  const { mutate: markAsRead } = useMarkNotificationsRead()
  
  // Process notifications for aggregation
  const processedNotifications = React.useMemo(() => {
    if (!data?.notifications) return []
    return aggregateNotifications(data.notifications)
  }, [data?.notifications])

  // Mark notifications as read when viewing the page
  useEffect(() => {
    if (data?.notifications && data.notifications.length > 0) {
      const timer = setTimeout(() => {
        markAsRead()
      }, 2000) // Mark as read after 2 seconds
      
      return () => clearTimeout(timer)
    }
  }, [data?.notifications, markAsRead])

  // Save tab preference to localStorage
  useEffect(() => {
    localStorage.setItem('notifications-tab', activeTab)
  }, [activeTab])

  const handleBack = () => {
    navigate('/')
  }

  const handleTabChange = (tab: 'all' | 'following') => {
    setActiveTab(tab)
  }

  const handleNotificationClick = (notification: Notification) => {
    if (notification.reason === 'follow') {
      navigate(`/profile/${notification.author.handle}`)
    } else if (notification.uri) {
      navigate(`/thread/${encodeURIComponent(notification.uri)}`)
    }
  }
  
  const toggleAggregation = (key: string) => {
    const newExpanded = new Set(expandedAggregations)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedAggregations(newExpanded)
  }

  const getNotificationIcon = (reason: string) => {
    const iconClasses = {
      like: "text-pink-500",
      repost: "text-green-500",
      follow: "text-blue-500",
      mention: "text-purple-500",
      reply: "text-sky-500",
      quote: "text-indigo-500"
    }
    
    switch (reason) {
      case 'like':
        return <Heart size={18} className={iconClasses.like} />
      case 'repost':
        return <Repeat2 size={18} className={iconClasses.repost} />
      case 'follow':
        return <UserPlus size={18} className={iconClasses.follow} />
      case 'mention':
        return <AtSign size={18} className={iconClasses.mention} />
      case 'reply':
        return <MessageCircle size={18} className={iconClasses.reply} />
      case 'quote':
        return <Quote size={18} className={iconClasses.quote} />
      default:
        return null
    }
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-red-400 mb-2">Failed to load notifications</h2>
          <p className="text-gray-400 mb-4">Please try again later.</p>
          <button 
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            onClick={handleBack}
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.header 
        className="sticky top-16 z-10 bg-gray-900 border-b border-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="px-4 py-3">
          <div className="flex items-center gap-4 mb-3">
            <motion.button
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              onClick={handleBack}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ArrowLeft size={20} />
            </motion.button>
            
            <h1 className="text-xl font-semibold">Notifications</h1>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex gap-1">
            <motion.button
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-all relative ${
                activeTab === 'all'
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => handleTabChange('all')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span>All notifications</span>
              {activeTab === 'all' && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                  layoutId="activeTab"
                />
              )}
            </motion.button>
            
            <motion.button
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-all relative ${
                activeTab === 'following'
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              onClick={() => handleTabChange('following')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              title="Show only notifications from people you follow"
            >
              <Users size={16} />
              <span>Following</span>
              {activeTab === 'following' && (
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                  layoutId="activeTab"
                />
              )}
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Notifications List */}
      <div className="divide-y divide-gray-800">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <LoadingSpinner size="lg" />
            <p className="text-gray-400 mt-4">Loading notifications...</p>
          </div>
        ) : processedNotifications.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {processedNotifications.map((item, index) => {
              if (item.type === 'aggregated') {
                const aggregationKey = `${item.reason}-${item.latestTimestamp}`
                const isExpanded = expandedAggregations.has(aggregationKey)
                
                return (
                  <div key={aggregationKey}>
                    {/* Aggregated notification header */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex gap-3 p-4 hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex-shrink-0 pt-1">
                        {getNotificationIcon(item.reason)}
                      </div>
                      
                      <div className="flex-1">
                        {/* Author avatars */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex -space-x-2">
                            {item.authors.slice(0, 4).map((author, idx) => (
                              <div key={idx} className="relative">
                                {author.avatar ? (
                                  <img 
                                    src={author.avatar} 
                                    alt={author.handle}
                                    className="w-8 h-8 rounded-full border-2 border-gray-900"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-xs font-medium">
                                    {author.handle.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                            ))}
                            {item.count > 4 && (
                              <div className="w-8 h-8 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-xs font-medium">
                                +{item.count - 4}
                              </div>
                            )}
                          </div>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleAggregation(aggregationKey)
                            }}
                            className="ml-auto p-1 rounded hover:bg-gray-700 transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                        
                        <p className="text-gray-100">
                          {getAggregatedText(item)}
                        </p>
                        
                        {item.postText && (
                          <p className="text-gray-400 text-sm mt-1 truncate">
                            {item.postText}
                          </p>
                        )}
                        
                        <time className="text-gray-500 text-xs mt-1 block">
                          {formatDistanceToNow(new Date(item.latestTimestamp), { addSuffix: true })}
                        </time>
                      </div>
                    </motion.div>
                    
                    {/* Expanded individual notifications */}
                    {isExpanded && (
                      <div className="ml-12 border-l-2 border-gray-700">
                        {item.notifications.map((notification) => (
                          <motion.div
                            key={`${notification.uri}-${notification.indexedAt}`}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex gap-3 p-4 pl-6 hover:bg-gray-800/50 cursor-pointer transition-colors"
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex-shrink-0">
                              {notification.author.avatar ? (
                                <img 
                                  src={notification.author.avatar} 
                                  alt={notification.author.handle}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-medium">
                                  {notification.author.handle.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1">
                              <p className="text-gray-300 text-sm">
                                <span className="font-medium">{notification.author.displayName || notification.author.handle}</span>
                              </p>
                              <time className="text-gray-500 text-xs">
                                {formatDistanceToNow(new Date(notification.indexedAt), { addSuffix: true })}
                              </time>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              } else {
                // Single notification
                const notification = item.notification
                return (
                  <motion.div
                    key={`${notification.uri}-${notification.indexedAt}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex gap-3 p-4 hover:bg-gray-800/50 cursor-pointer transition-colors ${
                      notification.isRead ? 'opacity-70' : 'bg-blue-900/10'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex-shrink-0 pt-1">
                      {getNotificationIcon(notification.reason)}
                    </div>
                    
                    <div className="flex gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        {notification.author.avatar ? (
                          <img 
                            src={notification.author.avatar} 
                            alt={notification.author.handle}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium">
                            {notification.author.handle.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-100">
                          {getNotificationText(notification)}
                        </p>
                        {notification.record && typeof notification.record === 'object' && 'text' in notification.record && (
                          <p className="text-gray-400 text-sm mt-1 truncate">
                            {(notification.record as { text?: string }).text}
                          </p>
                        )}
                        <time className="text-gray-500 text-xs mt-1 block">
                          {formatDistanceToNow(new Date(notification.indexedAt), { addSuffix: true })}
                        </time>
                      </div>
                    </div>
                  </motion.div>
                )
              }
            })}
          </AnimatePresence>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-300 mb-2">No notifications</h3>
            <p className="text-gray-500">You don't have any notifications yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}