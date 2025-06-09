import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  User, 
  Shield, 
  Eye, 
  MessageSquare, 
  Palette,
  Info,
  Save,
  Check
} from 'lucide-react'
import type { 
  AppBskyActorDefs
} from '@atproto/api'

type FeedViewPref = AppBskyActorDefs.FeedViewPref
type ThreadViewPref = AppBskyActorDefs.ThreadViewPref
type MutedWord = AppBskyActorDefs.MutedWord
type MutedWordsPref = AppBskyActorDefs.MutedWordsPref


export const Settings: React.FC = () => {
  const navigate = useNavigate()
  const { agent, logout } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('general')
  const [isSaving, setIsSaving] = useState(false)
  const [savedMessage, setSavedMessage] = useState(false)

  // Fetch current preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['preferences'],
    queryFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      const response = await agent.app.bsky.actor.getPreferences()
      return response.data
    },
    enabled: !!agent
  })

  // State for preferences
  const [feedPrefs, setFeedPrefs] = useState<FeedViewPref>({
    $type: 'app.bsky.actor.defs#feedViewPref',
    feed: 'home',
    hideReplies: false,
    hideRepliesByUnfollowed: true,
    hideRepliesByLikeCount: 0,
    hideReposts: false,
    hideQuotePosts: false
  })

  const [threadPrefs, setThreadPrefs] = useState<ThreadViewPref>({
    $type: 'app.bsky.actor.defs#threadViewPref',
    sort: 'oldest',
    prioritizeFollowedUsers: true
  })

  const [mutedWords, setMutedWords] = useState<MutedWord[]>([])
  const [newMutedWord, setNewMutedWord] = useState('')

  // Load preferences when data is available
  useEffect(() => {
    if (preferences?.preferences) {
      preferences.preferences.forEach(pref => {
        if (pref.$type === 'app.bsky.actor.defs#feedViewPref') {
          setFeedPrefs(pref as FeedViewPref)
        } else if (pref.$type === 'app.bsky.actor.defs#threadViewPref') {
          setThreadPrefs(pref as ThreadViewPref)
        } else if (pref.$type === 'app.bsky.actor.defs#mutedWordsPref') {
          setMutedWords((pref as MutedWordsPref).items || [])
        }
      })
    }
  }, [preferences])

  // Save preferences mutation
  const savePreferencesMutation = useMutation({
    mutationFn: async () => {
      if (!agent) throw new Error('Not authenticated')
      
      const prefsToSave = [
        feedPrefs,
        threadPrefs,
        {
          $type: 'app.bsky.actor.defs#mutedWordsPref',
          items: mutedWords
        }
      ]

      await agent.app.bsky.actor.putPreferences({
        preferences: prefsToSave
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences'] })
      setSavedMessage(true)
      setTimeout(() => setSavedMessage(false), 3000)
    }
  })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await savePreferencesMutation.mutateAsync()
    } finally {
      setIsSaving(false)
    }
  }

  const addMutedWord = () => {
    if (newMutedWord.trim()) {
      const word: MutedWord = {
        $type: 'app.bsky.actor.defs#mutedWord',
        id: Date.now().toString(),
        value: newMutedWord.trim(),
        targets: ['content', 'tag'],
        actorTarget: 'all'
      }
      setMutedWords([...mutedWords, word])
      setNewMutedWord('')
    }
  }

  const removeMutedWord = (id: string) => {
    setMutedWords(mutedWords.filter(word => word.id !== id))
  }

  const tabs = [
    { id: 'general', label: 'General', icon: User },
    { id: 'feed', label: 'Feed', icon: Eye },
    { id: 'threads', label: 'Threads', icon: MessageSquare },
    { id: 'muted', label: 'Muted Words', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'about', label: 'About', icon: Info }
  ]

  if (isLoading) {
    return (
      <div className="settings-container">
        <div className="settings-loading">
          <div className="spinner spinner-lg"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <button 
          onClick={() => navigate(-1)}
          className="btn-icon"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1>Settings</h1>
        <button 
          onClick={handleSave}
          className="btn btn-primary"
          disabled={isSaving}
        >
          {isSaving ? (
            <span className="spinner spinner-sm" />
          ) : savedMessage ? (
            <>
              <Check size={16} />
              Saved
            </>
          ) : (
            <>
              <Save size={16} />
              Save Changes
            </>
          )}
        </button>
      </div>

      <div className="settings-content">
        <div className="settings-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="settings-panel">
          {activeTab === 'general' && (
            <motion.div 
              className="settings-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <h2>General Settings</h2>
              
              <div className="settings-group">
                <h3>Account</h3>
                <p className="text-secondary">
                  Logged in as @{agent?.session?.handle}
                </p>
                <button 
                  onClick={logout}
                  className="btn btn-secondary btn-danger"
                >
                  Log Out
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'feed' && (
            <motion.div 
              className="settings-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <h2>Feed Preferences</h2>
              
              <div className="settings-group">
                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={feedPrefs.hideReplies || false}
                    onChange={(e) => setFeedPrefs({
                      ...feedPrefs,
                      hideReplies: e.target.checked
                    })}
                  />
                  <span>Hide all replies</span>
                </label>

                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={feedPrefs.hideRepliesByUnfollowed}
                    onChange={(e) => setFeedPrefs({
                      ...feedPrefs,
                      hideRepliesByUnfollowed: e.target.checked
                    })}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Hide replies by people you don't follow</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={feedPrefs.hideReposts || false}
                    onChange={(e) => setFeedPrefs({
                      ...feedPrefs,
                      hideReposts: e.target.checked
                    })}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Hide reposts</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={feedPrefs.hideQuotePosts || false}
                    onChange={(e) => setFeedPrefs({
                      ...feedPrefs,
                      hideQuotePosts: e.target.checked
                    })}
                    className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Hide quote posts</span>
                </label>

                <div className="pt-4">
                  <label htmlFor="reply-threshold" className="block text-sm font-medium mb-2">
                    Hide replies with fewer than X likes
                  </label>
                  <input
                    id="reply-threshold"
                    type="number"
                    min="0"
                    value={feedPrefs.hideRepliesByLikeCount || 0}
                    onChange={(e) => setFeedPrefs({
                      ...feedPrefs,
                      hideRepliesByLikeCount: parseInt(e.target.value) || 0
                    })}
                    className="w-20 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'threads' && (
            <motion.div 
              className="settings-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <h2>Thread Preferences</h2>
              
              <div className="settings-group">
                <div className="settings-field">
                  <label htmlFor="thread-sort">Reply sort order</label>
                  <select
                    id="thread-sort"
                    value={threadPrefs.sort || 'oldest'}
                    onChange={(e) => setThreadPrefs({
                      ...threadPrefs,
                      sort: e.target.value as any
                    })}
                    className="select"
                  >
                    <option value="oldest">Oldest first</option>
                    <option value="newest">Newest first</option>
                    <option value="most-likes">Most liked</option>
                    <option value="random">Random</option>
                    <option value="hotness">Hot</option>
                  </select>
                </div>

                <label className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={threadPrefs.prioritizeFollowedUsers || false}
                    onChange={(e) => setThreadPrefs({
                      ...threadPrefs,
                      prioritizeFollowedUsers: e.target.checked
                    })}
                  />
                  <span>Show replies from people you follow first</span>
                </label>
              </div>
            </motion.div>
          )}

          {activeTab === 'muted' && (
            <motion.div 
              className="settings-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <h2>Muted Words</h2>
              <p className="text-secondary">
                Posts containing these words will be hidden from your feeds.
              </p>
              
              <div className="settings-group">
                <div className="muted-word-input">
                  <input
                    type="text"
                    placeholder="Add a word or phrase to mute"
                    value={newMutedWord}
                    onChange={(e) => setNewMutedWord(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addMutedWord()}
                    className="input"
                  />
                  <button 
                    onClick={addMutedWord}
                    className="btn btn-primary"
                    disabled={!newMutedWord.trim()}
                  >
                    Add
                  </button>
                </div>

                <div className="muted-words-list">
                  {mutedWords.length === 0 ? (
                    <p className="empty-state">No muted words</p>
                  ) : (
                    mutedWords.map(word => (
                      <div key={word.id} className="muted-word-item">
                        <span>{word.value}</span>
                        <button
                          onClick={() => removeMutedWord(word.id!)}
                          className="btn-icon btn-sm"
                          aria-label={`Remove ${word.value}`}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'appearance' && (
            <motion.div 
              className="settings-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <h2>Appearance</h2>
              
              <div className="settings-group">
                <p className="text-secondary">
                  Theme settings coming soon. Currently using dark theme.
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'about' && (
            <motion.div 
              className="settings-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <h2>About</h2>
              
              <div className="settings-group">
                <h3>Bluesky Client</h3>
                <p className="text-secondary">
                  A custom Bluesky client built with React and the AT Protocol.
                </p>
                
                <div className="about-info">
                  <div className="info-item">
                    <span className="label">Version</span>
                    <span>0.1.0</span>
                  </div>
                  <div className="info-item">
                    <span className="label">AT Protocol</span>
                    <span>@atproto/api</span>
                  </div>
                  <div className="info-item">
                    <span className="label">License</span>
                    <span>MIT</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}