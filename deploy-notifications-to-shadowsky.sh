#!/bin/bash

echo "🚀 Deploying notifications-app to shadowsky.io..."

# Build the app
echo "📦 Building notifications-app..."
cd notifications-app

# Build with root base path for custom domain
VITE_BASE=/ npm run build || npx vite build --base=/

# Create a temporary directory
TEMP_DIR=$(mktemp -d)

# Copy only the built files
cp -r dist/* $TEMP_DIR/
echo "shadowsky.io" > $TEMP_DIR/CNAME
touch $TEMP_DIR/.nojekyll

# Save current branch
CURRENT_BRANCH=$(git branch --show-current)

# Create orphan gh-pages branch
git checkout --orphan gh-pages

# Remove all files from tracking
git rm -rf .

# Copy built files to root
cp -r $TEMP_DIR/* .

# Add and commit
git add -A
git commit -m "Deploy notifications-app to GitHub Pages"

# Push to GitHub
git push origin gh-pages --force

# Switch back to original branch
git checkout $CURRENT_BRANCH

# Clean up
rm -rf $TEMP_DIR

echo "✅ Deployment complete!"
echo "🌐 Your app will be available at: https://shadowsky.io"