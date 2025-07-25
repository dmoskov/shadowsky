import React from 'react'
import { useParams } from 'react-router-dom'
import { User } from 'lucide-react'

export const Profile: React.FC = () => {
  const { handle } = useParams<{ handle: string }>()

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <User className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Profile</h1>
          <p className="text-gray-400">
            Viewing profile: @{handle === 'me' ? 'your-profile' : handle}
          </p>
          <p className="text-sm text-gray-500 mt-4">
            Profile functionality would be implemented here
          </p>
        </div>
      </div>
    </div>
  )
}