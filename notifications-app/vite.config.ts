import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/notifications-app/' : '/',
  plugins: [react()],
  server: {
    port: 5174 // Different port from main app
  },
  resolve: {
    alias: {
      '@bsky/shared': path.resolve(__dirname, '../packages/shared/src')
    }
  }
})