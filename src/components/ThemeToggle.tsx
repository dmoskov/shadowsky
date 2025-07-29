import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg transition-all hover:bg-white hover:bg-opacity-10"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun size={20} style={{ color: 'var(--bsky-text-primary)' }} />
      ) : (
        <Moon size={20} style={{ color: 'var(--bsky-text-primary)' }} />
      )}
    </button>
  )
}