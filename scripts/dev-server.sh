#!/bin/bash

# Robust dev server management script

LOG_FILE="/tmp/vite-output.log"
PID_FILE="/tmp/vite.pid"

# Function to check if server is running
is_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Function to start the server
start_server() {
    echo "🚀 Starting Vite dev server..."
    
    # Clear old log
    > "$LOG_FILE"
    
    # Start server in background
    npm run dev > "$LOG_FILE" 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > "$PID_FILE"
    
    # Wait for server to start
    echo -n "Waiting for server to start"
    for i in {1..30}; do
        if grep -q "ready in" "$LOG_FILE" 2>/dev/null; then
            echo " ✅"
            echo "Server ready at http://localhost:5173/"
            return 0
        fi
        echo -n "."
        sleep 1
    done
    
    echo " ❌"
    echo "Server failed to start. Check $LOG_FILE for errors."
    return 1
}

# Function to stop the server
stop_server() {
    if is_running; then
        echo "🛑 Stopping Vite dev server..."
        PID=$(cat "$PID_FILE")
        kill "$PID" 2>/dev/null
        rm -f "$PID_FILE"
        echo "Server stopped."
    else
        echo "Server is not running."
    fi
}

# Function to restart the server
restart_server() {
    stop_server
    sleep 1
    start_server
}

# Function to check server health
check_health() {
    if is_running; then
        # Check for recent errors
        RECENT_ERRORS=$(tail -100 "$LOG_FILE" | grep -E "(Error|error:|failed)" | tail -5)
        if [ -n "$RECENT_ERRORS" ]; then
            echo "⚠️  Server is running but has errors:"
            echo "$RECENT_ERRORS"
            return 1
        else
            echo "✅ Server is running healthy"
            return 0
        fi
    else
        echo "❌ Server is not running"
        return 1
    fi
}

# Main command handler
case "${1:-status}" in
    start)
        if is_running; then
            echo "Server is already running."
        else
            start_server
        fi
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        check_health
        ;;
    log)
        tail -f "$LOG_FILE"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|log}"
        exit 1
        ;;
esac