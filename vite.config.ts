import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/shadowsky/' : '/',
  plugins: [react()],
  server: {
    port: 5174,
    // Configure the dev server to handle SPA routing
    middlewareMode: false,
    // This ensures that the dev server serves index.html for all routes
    // that don't match static files
    fs: {
      strict: false
    }
  },
  preview: {
    port: 5174
  },
  // Handle SPA routing - return index.html for all routes
  appType: 'spa'
})