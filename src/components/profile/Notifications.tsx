import React, { useEffect } from 'react'
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
  Quote
} from 'lucide-react'
import { useNotifications, useMarkNotificationsRead, getNotificationText } from '../../hooks/useNotifications'
import { NotificationsEmpty } from '../ui/EmptyStates'
import { PageLoader } from '../ui/SkeletonLoaders'
import type { Notification } from '@atproto/api/dist/client/types/app/bsky/notification/listNotifications'

export const Notifications: React.FC = () => {
  const navigate = useNavigate()
  const { data, isLoading, error } = useNotifications()
  const { mutate: markAsRead } = useMarkNotificationsRead()

  // Mark notifications as read when viewing the page
  useEffect(() => {
    if (data?.notifications && data.notifications.length > 0) {
      const timer = setTimeout(() => {
        markAsRead()
      }, 2000) // Mark as read after 2 seconds
      
      return () => clearTimeout(timer)
    }
  }, [data?.notifications, markAsRead])

  const handleBack = () => {
    navigate('/')
  }

  const handleNotificationClick = (notification: Notification) => {
    if (notification.reason === 'follow') {
      navigate(`/profile/${notification.author.handle}`)
    } else if (notification.uri) {
      navigate(`/thread/${encodeURIComponent(notification.uri)}`)
    }
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
        className="sticky top-16 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="flex items-center gap-4">
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
      </motion.header>

      {/* Notifications List */}
      <div className="divide-y divide-gray-800">
        {isLoading ? (
          <PageLoader message="Loading notifications..." />
        ) : data?.notifications && data.notifications.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {data.notifications.map((notification, index) => (
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
            ))}
          </AnimatePresence>
        ) : (
          <NotificationsEmpty />
        )}
      </div>
    </div>
  )
}