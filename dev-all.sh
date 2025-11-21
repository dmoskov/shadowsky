#!/bin/bash

# Start both the API server and frontend dev server

echo "🚀 Starting ShadowSky development servers..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to cleanup background processes on exit
cleanup() {
  echo ""
  echo "🛑 Shutting down servers..."
  kill $(jobs -p) 2>/dev/null
  wait
  echo "✅ All servers stopped"
  exit 0
}

# Set trap to catch SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# Start API server (HTTP + WebSocket) in background
echo -e "${BLUE}[API Server]${NC} Starting on ports 3002 (HTTP) and 3001 (WebSocket)..."
npm run dev:api &
API_PID=$!

# Give API server a moment to start
sleep 2

# Start Vite dev server in background
echo -e "${GREEN}[Frontend]${NC} Starting on port 5174..."
npm run dev &
DEV_PID=$!

echo ""
echo "✅ All servers started!"
echo ""
echo "📡 API Server:      http://localhost:3002"
echo "🔌 WebSocket:       ws://localhost:3001"
echo "🌐 Frontend:        http://localhost:5174"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for all background processes
wait
