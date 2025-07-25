import React from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { Calendar, Link as LinkIcon, MapPin, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export const Profile: React.FC = () => {
  const { handle } = useParams<{ handle: string }>()
  const { agent } = useAuth()

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', handle],
    queryFn: async () => {
      if (!agent || !handle) throw new Error('Not authenticated')
      const response = await agent.getProfile({ actor: handle })
      return response.data
    },
    enabled: !!agent && !!handle
  })

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-48 rounded-t-lg" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
          <div className="rounded-b-lg p-6" style={{ backgroundColor: 'var(--bsky-bg-secondary)' }}>
            <div className="w-24 h-24 rounded-full -mt-16 mb-4" style={{ backgroundColor: 'var(--bsky-bg-hover)' }}></div>
            <div className="h-6 rounded w-48 mb-2" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
            <div className="h-4 rounded w-32" style={{ backgroundColor: 'var(--bsky-bg-tertiary)' }}></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bsky-card p-4" style={{ borderColor: 'var(--bsky-error)', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--bsky-error)' }}>
          Failed to load profile
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header/Banner */}
      <div className="relative">
        {profile.banner ? (
          <img 
            src={profile.banner} 
            alt="Profile banner"
            className="w-full h-48 object-cover"
          />
        ) : (
          <div className="w-full h-48" style={{ background: 'linear-gradient(135deg, var(--bsky-primary), var(--bsky-accent))' }}></div>
        )}
      </div>

      {/* Profile Info */}
      <div className="px-6 pb-6" style={{ backgroundColor: 'var(--bsky-bg-secondary)' }}>
        <div className="flex justify-between items-start -mt-16 mb-4">
          {/* Avatar */}
          <div className="relative">
            {profile.avatar ? (
              <img 
                src={profile.avatar} 
                alt={profile.handle}
                className="w-32 h-32 rounded-full border-4"
                style={{ borderColor: 'var(--bsky-bg-secondary)' }}
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 flex items-center justify-center text-3xl font-bold" style={{ borderColor: 'var(--bsky-bg-secondary)', backgroundColor: 'var(--bsky-bg-hover)' }}>
                {profile.handle.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Follow Button */}
          <button className="mt-20 px-6 py-2 bsky-button-primary rounded-full">
            Follow
          </button>
        </div>

        {/* Name and Handle */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold">{profile.displayName || profile.handle}</h1>
          <p style={{ color: 'var(--bsky-text-secondary)' }}>@{profile.handle}</p>
        </div>

        {/* Bio */}
        {profile.description && (
          <p className="mb-4 whitespace-pre-wrap" style={{ color: 'var(--bsky-text-primary)' }}>{profile.description}</p>
        )}

        {/* Stats */}
        <div className="flex gap-6 mb-4">
          <div>
            <span className="font-bold">{profile.postsCount || 0}</span>
            <span className="ml-1" style={{ color: 'var(--bsky-text-secondary)' }}>posts</span>
          </div>
          <div>
            <span className="font-bold">{profile.followersCount || 0}</span>
            <span className="ml-1" style={{ color: 'var(--bsky-text-secondary)' }}>followers</span>
          </div>
          <div>
            <span className="font-bold">{profile.followsCount || 0}</span>
            <span className="ml-1" style={{ color: 'var(--bsky-text-secondary)' }}>following</span>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--bsky-text-secondary)' }}>
          {profile.indexedAt && (
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>Joined {formatDistanceToNow(new Date(profile.indexedAt), { addSuffix: true })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Posts Feed */}
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Posts</h2>
        <div className="text-center py-8" style={{ color: 'var(--bsky-text-secondary)' }}>
          Posts feed will be implemented here
        </div>
      </div>
    </div>
  )
}