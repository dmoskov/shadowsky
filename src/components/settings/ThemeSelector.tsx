import React from 'react'
import { motion } from 'framer-motion'
import { Palette, Zap, Megaphone, Eye, EyeOff } from 'lucide-react'
import { useTheme, useProtestFeatures } from '../../contexts/ThemeContext'

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme, themeConfig } = useTheme()
  const { useResistanceMode, emergencyMode, protestFilters } = useProtestFeatures()
  const { isResistanceMode, toggleResistanceMode } = useResistanceMode()

  const themes = [
    {
      id: 'default',
      name: 'Default',
      description: 'Clean, modern interface optimized for readability',
      preview: 'bg-gray-900 border-gray-700',
      icon: <Palette size={20} />
    },
    {
      id: 'protest',
      name: 'Digital Resistance',
      description: 'Bold protest-inspired theme for digital activism',
      preview: 'bg-protest-primary border-orange-500',
      icon: <Zap size={20} />
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Theme Selection</h3>
        <div className="grid gap-4">
          {themes.map((themeOption) => (
            <motion.div
              key={themeOption.id}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                theme === themeOption.id
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
              onClick={() => setTheme(themeOption.id as 'default' | 'protest')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-8 rounded ${themeOption.preview} flex items-center justify-center`}>
                  {themeOption.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium">{themeOption.name}</h4>
                    {theme === themeOption.id && (
                      <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{themeOption.description}</p>
                  
                  {/* Theme Features */}
                  {themeOption.id === theme && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 space-y-2"
                    >
                      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Features
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {themeConfig.features.map((feature, index) => (
                          <span
                            key={index}
                            className="px-2 py-0.5 bg-gray-800 text-gray-300 text-xs rounded"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Protest Theme Specific Settings */}
      {theme === 'protest' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-900/20 border border-red-500/50 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Megaphone size={18} className="text-red-400" />
            <h4 className="font-semibold text-red-400">Resistance Features</h4>
          </div>
          
          {/* Resistance Mode Toggle */}
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium">Resistance Mode</div>
                <div className="text-sm text-gray-400">
                  Enhanced privacy with automatic content blurring
                </div>
              </div>
              <button
                onClick={toggleResistanceMode}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isResistanceMode ? 'bg-red-600' : 'bg-gray-600'
                }`}
              >
                <motion.div
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                  animate={{
                    left: isResistanceMode ? '1.5rem' : '0.25rem'
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </label>

            {/* Emergency Broadcast Mode */}
            {emergencyMode.isEnabled && (
              <div className="pt-2 border-t border-red-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span className="text-sm font-medium text-red-400">
                    Emergency Broadcast Mode Available
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  Rapid alert system for urgent community information
                </div>
              </div>
            )}

            {/* Timeline Filters Preview */}
            <div className="pt-2 border-t border-red-500/30">
              <div className="text-sm font-medium text-red-400 mb-2">
                Enhanced Timeline Filters
              </div>
              <div className="grid grid-cols-2 gap-2">
                {protestFilters.map((filter) => (
                  <div
                    key={filter.id}
                    className="flex items-center gap-2 px-2 py-1 bg-gray-800/50 rounded text-xs"
                  >
                    <span>{filter.icon}</span>
                    <span>{filter.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Accessibility Notice */}
      <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Eye size={16} className="text-blue-400" />
          <h4 className="font-medium text-blue-400">Accessibility</h4>
        </div>
        <div className="text-sm text-gray-400 space-y-1">
          <p>All themes maintain high contrast ratios and support screen readers.</p>
          <p>Use your system's reduced motion settings to disable animations.</p>
          {theme === 'protest' && (
            <p className="text-yellow-400">
              ⚠️ Protest theme includes bold visuals - toggle Resistance Mode for subtler styling.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}