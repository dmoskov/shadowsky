import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
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