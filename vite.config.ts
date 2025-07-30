import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/shadowsky/' : '/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  server: {
    port: 5174,
    // Configure the dev server to handle SPA routing
    middlewareMode: false,
    // This ensures that the dev server serves index.html for all routes
    // that don't match static files
    fs: {
      strict: false
    },
    // Headers required for FFmpeg with SharedArrayBuffer
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    // Proxy configuration for Bluesky CDN images to avoid CORS issues
    proxy: {
      '/bsky-cdn': {
        target: 'https://cdn.bsky.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bsky-cdn/, ''),
        headers: {
          'Referer': 'https://bsky.app',
        }
      }
    }
  },
  preview: {
    port: 5174
  },
  // Handle SPA routing - return index.html for all routes
  appType: 'spa'
})