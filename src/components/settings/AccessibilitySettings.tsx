import React from 'react'
import { motion } from 'framer-motion'
import { 
  Eye, 
  Palette, 
  Type, 
  Volume2, 
  Keyboard,
  Monitor,
  RefreshCw
} from 'lucide-react'
import { useAccessibility } from '../../contexts/AccessibilityContext'
import { useToast } from '../../components/ui/Toast'

export const AccessibilitySettings: React.FC = () => {
  const { settings, updateSetting, resetSettings } = useAccessibility()
  const toast = useToast()

  const handleReset = () => {
    resetSettings()
    toast.success('Accessibility settings reset to defaults')
  }

  return (
    <div className="settings-section">
      <h2 className="settings-section-title">
        <Eye className="inline-block mr-2" size={20} aria-hidden="true" />
        Accessibility
      </h2>

      {/* Visual Settings */}
      <div className="settings-group">
        <h3 className="settings-group-title">Visual Preferences</h3>
        
        {/* High Contrast Mode */}
        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="high-contrast" className="setting-label">
              <Monitor className="inline-block mr-2" size={16} aria-hidden="true" />
              High Contrast Mode
            </label>
            <p className="setting-description">
              Increase contrast between text and backgrounds for better visibility
            </p>
          </div>
          <motion.button
            id="high-contrast"
            className={`toggle-switch ${settings.highContrast ? 'active' : ''}`}
            onClick={() => updateSetting('highContrast', !settings.highContrast)}
            whileTap={{ scale: 0.95 }}
            role="switch"
            aria-checked={settings.highContrast}
            aria-label="Toggle high contrast mode"
          >
            <motion.div 
              className="toggle-thumb"
              animate={{ x: settings.highContrast ? 20 : 0 }}
            />
          </motion.button>
        </div>

        {/* Colorblind Mode */}
        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="colorblind-mode" className="setting-label">
              <Palette className="inline-block mr-2" size={16} aria-hidden="true" />
              Colorblind-Friendly Colors
            </label>
            <p className="setting-description">
              Use colors that are distinguishable for people with color vision deficiencies
            </p>
          </div>
          <motion.button
            id="colorblind-mode"
            className={`toggle-switch ${settings.colorblindMode ? 'active' : ''}`}
            onClick={() => updateSetting('colorblindMode', !settings.colorblindMode)}
            whileTap={{ scale: 0.95 }}
            role="switch"
            aria-checked={settings.colorblindMode}
            aria-label="Toggle colorblind-friendly colors"
          >
            <motion.div 
              className="toggle-thumb"
              animate={{ x: settings.colorblindMode ? 20 : 0 }}
            />
          </motion.button>
        </div>

        {/* Font Size */}
        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="font-size" className="setting-label">
              <Type className="inline-block mr-2" size={16} aria-hidden="true" />
              Text Size
            </label>
            <p className="setting-description">
              Adjust the size of text throughout the application
            </p>
          </div>
          <select
            id="font-size"
            value={settings.fontSize}
            onChange={(e) => updateSetting('fontSize', e.target.value as any)}
            className="setting-select"
            aria-label="Select text size"
          >
            <option value="normal">Normal</option>
            <option value="large">Large</option>
            <option value="extra-large">Extra Large</option>
          </select>
        </div>

        {/* Reduced Motion */}
        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="reduced-motion" className="setting-label">
              <RefreshCw className="inline-block mr-2" size={16} aria-hidden="true" />
              Reduce Motion
            </label>
            <p className="setting-description">
              Minimize animations and transitions (respects system preference)
            </p>
          </div>
          <motion.button
            id="reduced-motion"
            className={`toggle-switch ${settings.reducedMotion ? 'active' : ''}`}
            onClick={() => updateSetting('reducedMotion', !settings.reducedMotion)}
            whileTap={{ scale: 0.95 }}
            role="switch"
            aria-checked={settings.reducedMotion}
            aria-label="Toggle reduced motion"
          >
            <motion.div 
              className="toggle-thumb"
              animate={{ x: settings.reducedMotion ? 20 : 0 }}
            />
          </motion.button>
        </div>
      </div>

      {/* Screen Reader Settings */}
      <div className="settings-group">
        <h3 className="settings-group-title">Screen Reader Support</h3>
        
        {/* Screen Reader Announcements */}
        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="screen-reader" className="setting-label">
              <Volume2 className="inline-block mr-2" size={16} aria-hidden="true" />
              Screen Reader Announcements
            </label>
            <p className="setting-description">
              Enable announcements for dynamic content updates
            </p>
          </div>
          <motion.button
            id="screen-reader"
            className={`toggle-switch ${settings.screenReaderAnnouncements ? 'active' : ''}`}
            onClick={() => updateSetting('screenReaderAnnouncements', !settings.screenReaderAnnouncements)}
            whileTap={{ scale: 0.95 }}
            role="switch"
            aria-checked={settings.screenReaderAnnouncements}
            aria-label="Toggle screen reader announcements"
          >
            <motion.div 
              className="toggle-thumb"
              animate={{ x: settings.screenReaderAnnouncements ? 20 : 0 }}
            />
          </motion.button>
        </div>

        {/* Verbose Mode */}
        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="verbose-mode" className="setting-label">
              Verbose Descriptions
            </label>
            <p className="setting-description">
              Provide more detailed descriptions for screen reader users
            </p>
          </div>
          <motion.button
            id="verbose-mode"
            className={`toggle-switch ${settings.verboseMode ? 'active' : ''}`}
            onClick={() => updateSetting('verboseMode', !settings.verboseMode)}
            whileTap={{ scale: 0.95 }}
            role="switch"
            aria-checked={settings.verboseMode}
            aria-label="Toggle verbose descriptions"
          >
            <motion.div 
              className="toggle-thumb"
              animate={{ x: settings.verboseMode ? 20 : 0 }}
            />
          </motion.button>
        </div>
      </div>

      {/* Keyboard Navigation */}
      <div className="settings-group">
        <h3 className="settings-group-title">Keyboard Navigation</h3>
        
        {/* Keyboard Shortcuts */}
        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="keyboard-shortcuts" className="setting-label">
              <Keyboard className="inline-block mr-2" size={16} aria-hidden="true" />
              Keyboard Shortcuts
            </label>
            <p className="setting-description">
              Enable keyboard shortcuts for common actions (press ? to view)
            </p>
          </div>
          <motion.button
            id="keyboard-shortcuts"
            className={`toggle-switch ${settings.keyboardShortcuts ? 'active' : ''}`}
            onClick={() => updateSetting('keyboardShortcuts', !settings.keyboardShortcuts)}
            whileTap={{ scale: 0.95 }}
            role="switch"
            aria-checked={settings.keyboardShortcuts}
            aria-label="Toggle keyboard shortcuts"
          >
            <motion.div 
              className="toggle-thumb"
              animate={{ x: settings.keyboardShortcuts ? 20 : 0 }}
            />
          </motion.button>
        </div>

        {/* Focus Indicators */}
        <div className="setting-item">
          <div className="setting-info">
            <label htmlFor="focus-indicators" className="setting-label">
              Focus Indicators
            </label>
            <p className="setting-description">
              Visual indicators when navigating with keyboard
            </p>
          </div>
          <select
            id="focus-indicators"
            value={settings.focusIndicators}
            onChange={(e) => updateSetting('focusIndicators', e.target.value as any)}
            className="setting-select"
            aria-label="Select focus indicator style"
          >
            <option value="default">Default</option>
            <option value="enhanced">Enhanced</option>
          </select>
        </div>
      </div>

      {/* Reset Button */}
      <div className="settings-actions">
        <motion.button
          className="btn btn-secondary"
          onClick={handleReset}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Reset to Defaults
        </motion.button>
      </div>
    </div>
  )
}