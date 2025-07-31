import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util']
  },
  resolve: {
    alias: {
      '@bsky/shared': path.resolve(__dirname, './src/shared/index.ts')
    }
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
      'Cross-Origin-Embedder-Policy': 'credentialless',
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
      },
      '/bsky-video': {
        target: 'https://video.bsky.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bsky-video/, ''),
        headers: {
          'Referer': 'https://bsky.app',
        },
        configure: (proxy, options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Add CORS headers to allow the resource
            proxyRes.headers['Cross-Origin-Resource-Policy'] = 'cross-origin';
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
          });
        }
      },
      '/bsky-video-cdn': {
        target: 'https://video.cdn.bsky.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bsky-video-cdn/, ''),
        headers: {
          'Referer': 'https://bsky.app',
        },
        configure: (proxy, options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Add CORS headers to allow the resource
            proxyRes.headers['Cross-Origin-Resource-Policy'] = 'cross-origin';
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
          });
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