#!/bin/bash

# Deploy notifications-app to GitHub Pages

echo "🚀 Deploying to GitHub Pages..."

# Build the app
echo "📦 Building app..."
npm run build || npx vite build

# Add base path to vite config for GitHub Pages
echo "⚙️  Configuring for GitHub Pages..."
cat > vite.config.gh-pages.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/notifications-app/',
  plugins: [react()],
  server: {
    port: 5174
  },
  resolve: {
    alias: {
      '@bsky/shared': path.resolve(__dirname, '../packages/shared/src')
    }
  }
})
EOF

# Build with GitHub Pages config
mv vite.config.ts vite.config.ts.bak
mv vite.config.gh-pages.ts vite.config.ts
npx vite build
mv vite.config.ts.bak vite.config.ts
rm -f vite.config.gh-pages.ts

# Create a temporary directory for deployment
echo "📂 Preparing deployment..."
TEMP_DIR=$(mktemp -d)
cp -r dist/* $TEMP_DIR/

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# Create gh-pages branch if it doesn't exist
if ! git show-ref --verify --quiet refs/heads/gh-pages; then
    echo "Creating gh-pages branch..."
    git checkout --orphan gh-pages
    git rm -rf .
    echo "# GitHub Pages" > README.md
    git add README.md
    git commit -m "Initial gh-pages commit"
    git checkout $CURRENT_BRANCH
fi

# Switch to gh-pages branch
echo "🔄 Switching to gh-pages branch..."
git checkout gh-pages

# Clear old files and copy new build
rm -rf *
cp -r $TEMP_DIR/* .

# Commit and push
echo "📤 Pushing to GitHub..."
git add -A
git commit -m "Deploy notifications-app to GitHub Pages"
git push origin gh-pages

# Switch back to original branch
git checkout $CURRENT_BRANCH

# Clean up
rm -rf $TEMP_DIR

echo "✅ Deployment complete!"
echo "🌐 Your app will be available at: https://[YOUR-USERNAME].github.io/notifications-app/"
echo ""
echo "⚠️  Note: Make sure GitHub Pages is enabled in your repository settings:"
echo "   Settings > Pages > Source: Deploy from a branch > Branch: gh-pages"