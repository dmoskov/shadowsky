import React, { useState, useEffect } from 'react'
import { Bell, Volume2, Filter, Clock, Save } from 'lucide-react'

interface NotificationSettings {
  soundEnabled: boolean
  desktopNotifications: boolean
  autoRefresh: boolean
  refreshInterval: number
  priorityOnly: boolean
  hideLikes: boolean
  hideReposts: boolean
  hideFollows: boolean
}

export const NotificationsSettings: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    const saved = localStorage.getItem('notification-settings')
    return saved ? JSON.parse(saved) : {
      soundEnabled: true,
      desktopNotifications: false,
      autoRefresh: true,
      refreshInterval: 30,
      priorityOnly: false,
      hideLikes: false,
      hideReposts: false,
      hideFollows: false
    }
  })

  const [saved, setSaved] = useState(false)

  useEffect(() => {
    localStorage.setItem('notification-settings', JSON.stringify(settings))
    setSaved(true)
    const timer = setTimeout(() => setSaved(false), 2000)
    return () => clearTimeout(timer)
  }, [settings])

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const handleIntervalChange = (value: number) => {
    setSettings(prev => ({ ...prev, refreshInterval: value }))
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Notification Settings</h1>
        <p style={{ color: 'var(--bsky-text-secondary)' }}>Customize how you receive and view notifications</p>
      </div>

      {/* General Settings */}
      <div className="bsky-card p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Bell size={20} />
          General
        </h2>

        <SettingToggle
          label="Sound Notifications"
          description="Play a sound when new notifications arrive"
          icon={<Volume2 size={18} />}
          checked={settings.soundEnabled}
          onChange={() => handleToggle('soundEnabled')}
        />

        <SettingToggle
          label="Desktop Notifications"
          description="Show browser notifications for new activity"
          icon={<Bell size={18} />}
          checked={settings.desktopNotifications}
          onChange={() => handleToggle('desktopNotifications')}
        />

        <SettingToggle
          label="Auto Refresh"
          description="Automatically check for new notifications"
          icon={<Clock size={18} />}
          checked={settings.autoRefresh}
          onChange={() => handleToggle('autoRefresh')}
        />

        {settings.autoRefresh && (
          <div className="ml-10">
            <label className="block text-sm font-medium mb-2">
              Refresh Interval
            </label>
            <select
              value={settings.refreshInterval}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: 'var(--bsky-bg-tertiary)',
                border: '1px solid var(--bsky-border-primary)',
                color: 'var(--bsky-text-primary)'
              }}
            >
              <option value={15}>15 seconds</option>
              <option value={30}>30 seconds</option>
              <option value={60}>1 minute</option>
              <option value={120}>2 minutes</option>
              <option value={300}>5 minutes</option>
            </select>
          </div>
        )}
      </div>

      {/* Filter Settings */}
      <div className="bsky-card p-6 space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Filter size={20} />
          Filters
        </h2>

        <SettingToggle
          label="Priority Only"
          description="Only show notifications from people you follow"
          checked={settings.priorityOnly}
          onChange={() => handleToggle('priorityOnly')}
        />

        <div className="border-t pt-4" style={{ borderColor: 'var(--bsky-border-light)' }}>
          <p className="text-sm mb-3" style={{ color: 'var(--bsky-text-secondary)' }}>Hide notification types:</p>
          
          <SettingToggle
            label="Hide Likes"
            description="Don't show when someone likes your posts"
            checked={settings.hideLikes}
            onChange={() => handleToggle('hideLikes')}
          />

          <SettingToggle
            label="Hide Reposts"
            description="Don't show when someone reposts your posts"
            checked={settings.hideReposts}
            onChange={() => handleToggle('hideReposts')}
          />

          <SettingToggle
            label="Hide Follows"
            description="Don't show when someone follows you"
            checked={settings.hideFollows}
            onChange={() => handleToggle('hideFollows')}
          />
        </div>
      </div>

      {/* Save indicator */}
      {saved && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 animate-pulse">
          <Save size={18} />
          Settings saved
        </div>
      )}
    </div>
  )
}

interface SettingToggleProps {
  label: string
  description: string
  icon?: React.ReactNode
  checked: boolean
  onChange: () => void
}

const SettingToggle: React.FC<SettingToggleProps> = ({
  label,
  description,
  icon,
  checked,
  onChange
}) => {
  return (
    <div className="flex items-start justify-between py-2">
      <div className="flex gap-3">
        {icon && <div className="mt-0.5" style={{ color: 'var(--bsky-text-secondary)' }}>{icon}</div>}
        <div>
          <label className="font-medium text-sm cursor-pointer" onClick={onChange}>
            {label}
          </label>
          <p className="text-xs mt-0.5" style={{ color: 'var(--bsky-text-secondary)' }}>{description}</p>
        </div>
      </div>
      <button
        onClick={onChange}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
        style={{
          backgroundColor: checked ? 'var(--bsky-primary)' : 'var(--bsky-bg-hover)'
        }}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}