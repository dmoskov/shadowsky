#!/bin/bash

echo "🔔 Starting Bluesky Notifications App..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🚀 Starting development server on port 5174..."
echo "🌐 Open http://localhost:5174 in your browser"
echo ""

npm run dev