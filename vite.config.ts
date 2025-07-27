import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', // Bind to IPv4 localhost
    port: 5173,
    strictPort: true
  },
  resolve: {
    alias: {
      '@bsky/shared': path.resolve(__dirname, './packages/shared/src')
    }
  },
  // Handle SPA routing - return index.html for all routes
  appType: 'spa'
})
