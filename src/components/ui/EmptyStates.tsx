import React from 'react'
import { motion } from 'framer-motion'
import { 
  Search,
  Bell,
  FileText,
  Users,
  Image,
  Heart,
  MessageCircle,
  Sparkles
} from 'lucide-react'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

const EmptyStateBase: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <motion.div 
    className="flex flex-col items-center justify-center text-center py-16 px-4"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className="text-gray-600 mb-4">
      {icon}
    </div>
    <h2 className="text-xl font-semibold mb-2">{title}</h2>
    <p className="text-gray-400 max-w-md mb-6">{description}</p>
    {action && (
      <motion.button
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        onClick={action.onClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {action.label}
      </motion.button>
    )}
  </motion.div>
)

export const NotificationsEmpty: React.FC = () => (
  <EmptyStateBase
    icon={<Bell size={48} />}
    title="No notifications yet"
    description="When someone likes, reposts, or replies to your posts, you'll see it here."
  />
)

export const SearchEmpty: React.FC = () => (
  <EmptyStateBase
    icon={<Search size={48} />}
    title="Search Bluesky"
    description="Find posts and users across the network. Try searching for topics, hashtags, or people."
  />
)

export const SearchNoResults: React.FC<{ query: string }> = ({ query }) => (
  <EmptyStateBase
    icon={<Search size={48} />}
    title="No results found"
    description={`We couldn't find anything for "${query}". Try different keywords or check your spelling.`}
  />
)

export const ProfilePostsEmpty: React.FC<{ isOwnProfile?: boolean }> = ({ isOwnProfile }) => (
  <EmptyStateBase
    icon={<FileText size={48} />}
    title="No posts yet"
    description={isOwnProfile 
      ? "Share your thoughts with the world. Your posts will appear here."
      : "This user hasn't posted anything yet."}
    action={isOwnProfile ? {
      label: "Create your first post",
      onClick: () => document.querySelector<HTMLButtonElement>('.compose-fab')?.click()
    } : undefined}
  />
)

export const ProfileRepliesEmpty: React.FC = () => (
  <EmptyStateBase
    icon={<MessageCircle size={48} />}
    title="No replies yet"
    description="Replies to other posts will appear here."
  />
)

export const ProfileMediaEmpty: React.FC = () => (
  <EmptyStateBase
    icon={<Image size={48} />}
    title="No media posts"
    description="Posts with images or videos will appear here."
  />
)

export const ProfileLikesEmpty: React.FC = () => (
  <EmptyStateBase
    icon={<Heart size={48} />}
    title="No liked posts"
    description="Posts you've liked will appear here."
  />
)

export const FollowersEmpty: React.FC<{ type: 'followers' | 'following' }> = ({ type }) => (
  <EmptyStateBase
    icon={<Users size={48} />}
    title={type === 'followers' ? "No followers yet" : "Not following anyone"}
    description={type === 'followers' 
      ? "When people follow you, they'll appear here."
      : "Follow users to see their posts in your timeline."}
  />
)

export const FeedEmpty: React.FC = () => (
  <EmptyStateBase
    icon={<Sparkles size={48} />}
    title="Your feed is empty"
    description="Follow some users to see their posts here, or check out the discover feed."
    action={{
      label: "Find people to follow",
      onClick: () => window.location.href = '/search'
    }}
  />
)

export const ThreadEmpty: React.FC = () => (
  <EmptyStateBase
    icon={<MessageCircle size={48} />}
    title="No replies yet"
    description="Be the first to reply to this post."
  />
)