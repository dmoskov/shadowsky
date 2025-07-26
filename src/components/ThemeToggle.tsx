import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  
  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun size={20} className="theme-toggle-icon" />
      ) : (
        <Moon size={20} className="theme-toggle-icon" />
      )}
    </button>
  )
}