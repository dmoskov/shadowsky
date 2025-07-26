import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { motion } from 'framer-motion'

export function ThemeToggleEnhanced() {
  const { theme, toggleTheme } = useTheme()
  
  return (
    <motion.button
      onClick={toggleTheme}
      className="header-theme-toggle"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div 
        className={`theme-toggle-slider ${theme}`}
        animate={{ x: theme === 'light' ? 28 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
      <div className="theme-toggle-icon-wrapper">
        <Moon size={16} className={theme === 'dark' ? 'active' : ''} />
        <Sun size={16} className={theme === 'light' ? 'active' : ''} />
      </div>
    </motion.button>
  )
}