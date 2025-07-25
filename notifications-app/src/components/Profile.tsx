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
          <div className="h-48 bg-gray-800 rounded-t-lg"></div>
          <div className="bg-gray-900 rounded-b-lg p-6">
            <div className="w-24 h-24 bg-gray-700 rounded-full -mt-16 mb-4"></div>
            <div className="h-6 bg-gray-700 rounded w-48 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-32"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4 text-red-400">
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
          <div className="w-full h-48 bg-gradient-to-r from-blue-600 to-purple-600"></div>
        )}
      </div>

      {/* Profile Info */}
      <div className="bg-gray-900 px-6 pb-6">
        <div className="flex justify-between items-start -mt-16 mb-4">
          {/* Avatar */}
          <div className="relative">
            {profile.avatar ? (
              <img 
                src={profile.avatar} 
                alt={profile.handle}
                className="w-32 h-32 rounded-full border-4 border-gray-900"
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 border-gray-900 bg-gray-700 flex items-center justify-center text-3xl font-bold">
                {profile.handle.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Follow Button */}
          <button className="mt-20 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors">
            Follow
          </button>
        </div>

        {/* Name and Handle */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold">{profile.displayName || profile.handle}</h1>
          <p className="text-gray-400">@{profile.handle}</p>
        </div>

        {/* Bio */}
        {profile.description && (
          <p className="text-gray-300 mb-4 whitespace-pre-wrap">{profile.description}</p>
        )}

        {/* Stats */}
        <div className="flex gap-6 mb-4">
          <div>
            <span className="font-bold">{profile.postsCount || 0}</span>
            <span className="text-gray-400 ml-1">posts</span>
          </div>
          <div>
            <span className="font-bold">{profile.followersCount || 0}</span>
            <span className="text-gray-400 ml-1">followers</span>
          </div>
          <div>
            <span className="font-bold">{profile.followsCount || 0}</span>
            <span className="text-gray-400 ml-1">following</span>
          </div>
        </div>

        {/* Metadata */}
        <div className="flex flex-wrap gap-4 text-sm text-gray-400">
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
        <div className="text-center text-gray-400 py-8">
          Posts feed will be implemented here
        </div>
      </div>
    </div>
  )
}