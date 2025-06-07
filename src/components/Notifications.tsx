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
import { useNotifications, useMarkNotificationsRead, getNotificationText } from '../hooks/useNotifications'
import { NotificationsEmpty } from './EmptyStates'
import { PageLoader } from './SkeletonLoaders'
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
    switch (reason) {
      case 'like':
        return <Heart size={18} className="notification-icon like" />
      case 'repost':
        return <Repeat2 size={18} className="notification-icon repost" />
      case 'follow':
        return <UserPlus size={18} className="notification-icon follow" />
      case 'mention':
        return <AtSign size={18} className="notification-icon mention" />
      case 'reply':
        return <MessageCircle size={18} className="notification-icon reply" />
      case 'quote':
        return <Quote size={18} className="notification-icon quote" />
      default:
        return null
    }
  }

  if (error) {
    return (
      <div className="container">
        <div className="error-state">
          <h2>Failed to load notifications</h2>
          <p>Please try again later.</p>
          <button className="btn btn-primary" onClick={handleBack}>
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="notifications-page">
      {/* Header */}
      <motion.header 
        className="notifications-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="notifications-header-nav">
          <motion.button
            className="btn btn-icon btn-ghost"
            onClick={handleBack}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ArrowLeft size={20} />
          </motion.button>
          
          <h1 className="text-h3">Notifications</h1>
        </div>
      </motion.header>

      {/* Notifications List */}
      <div className="notifications-list">
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
                className={`notification-item ${notification.isRead ? 'read' : 'unread'}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="notification-icon-wrapper">
                  {getNotificationIcon(notification.reason)}
                </div>
                
                <div className="notification-content">
                  <div className="notification-author">
                    {notification.author.avatar ? (
                      <img 
                        src={notification.author.avatar} 
                        alt={notification.author.handle}
                        className="notification-avatar"
                      />
                    ) : (
                      <div className="notification-avatar placeholder">
                        {notification.author.handle.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  <div className="notification-details">
                    <p className="notification-text">
                      {getNotificationText(notification)}
                    </p>
                    {notification.record && typeof notification.record === 'object' && 'text' in notification.record && (
                      <p className="notification-preview text-secondary">
                        {(notification.record as { text?: string }).text}
                      </p>
                    )}
                    <time className="notification-time text-tertiary text-caption">
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