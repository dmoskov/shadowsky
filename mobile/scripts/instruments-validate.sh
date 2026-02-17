#!/bin/bash
#
# instruments-validate.sh
# Automated Xcode Instruments validation for ShadowSky iOS performance fixes.
#
# Usage:
#   ./scripts/instruments-validate.sh <test-name> [options]
#
# Tests:
#   test1-sustained-scroll   - 5-minute sustained feed scroll (Allocations + Time Profiler)
#   test2-rapid-loadmore     - Rapid pagination (Time Profiler + Thread States)
#   test3-memory-pressure    - Memory pressure simulation (Allocations + VM Tracker)
#   test4-timer-audit        - Background timer audit (System Trace)
#   all                      - Run all tests sequentially
#
# Options:
#   --device <UDID>          - Target device UDID (auto-detects if one device connected)
#   --duration <seconds>     - Override test duration (default varies by test)
#   --output <dir>           - Output directory for traces (default: ./instruments-traces)
#   --app <bundle-id>        - App bundle ID (default: io.shadowsky.app)
#   --analyze                - Run post-capture analysis on existing traces
#
# Prerequisites:
#   - Xcode 16+ with xctrace CLI
#   - Physical iOS device connected via USB
#   - Release build of Asphodel installed on device
#
# Example:
#   ./scripts/instruments-validate.sh test1-sustained-scroll
#   ./scripts/instruments-validate.sh all --device 00008130-XXXX
#   ./scripts/instruments-validate.sh --analyze --output ./instruments-traces
#

set -euo pipefail

# Configuration
BUNDLE_ID="${APP_BUNDLE_ID:-io.shadowsky.app}"
OUTPUT_DIR="./instruments-traces"
DEVICE_UDID=""
DURATION_OVERRIDE=""
ANALYZE_ONLY=false
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test durations (seconds)
DURATION_SUSTAINED_SCROLL=300  # 5 minutes
DURATION_RAPID_LOADMORE=60     # 1 minute
DURATION_MEMORY_PRESSURE=120   # 2 minutes
DURATION_TIMER_AUDIT=120       # 2 minutes

# Pass/fail thresholds
MEMORY_PLATEAU_MB=150
MEMORY_GROWTH_RATE_MB_PER_MIN=1
JS_THREAD_UTIL_PCT=60
FRAME_RATE_MIN_FPS=55
MAIN_THREAD_BLOCK_MS=16
JSON_DECODE_MS=50

print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
}

print_pass() {
    echo -e "  ${GREEN}✓ PASS${NC}: $1"
}

print_fail() {
    echo -e "  ${RED}✗ FAIL${NC}: $1"
}

print_warn() {
    echo -e "  ${YELLOW}⚠ WARN${NC}: $1"
}

print_info() {
    echo -e "  ${BLUE}ℹ${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"

    # Check xctrace
    if ! command -v xctrace &> /dev/null; then
        echo -e "${RED}Error: xctrace not found. Install Xcode 16+ and ensure Command Line Tools are configured.${NC}"
        echo "  Run: xcode-select --install"
        exit 1
    fi
    print_pass "xctrace CLI available"

    # Check for connected devices
    local devices
    devices=$(xcrun xctrace list devices 2>/dev/null | grep -E "^\S.*\(.*\)" | grep -v "Simulator" || true)

    if [ -z "$devices" ]; then
        echo -e "${RED}Error: No physical iOS devices connected.${NC}"
        echo "  Connect an iOS device via USB and trust the computer."
        exit 1
    fi

    # Auto-detect device if not specified
    if [ -z "$DEVICE_UDID" ]; then
        local device_count
        device_count=$(echo "$devices" | wc -l | tr -d ' ')

        if [ "$device_count" -eq 1 ]; then
            DEVICE_UDID=$(echo "$devices" | grep -oE '\([A-F0-9-]+\)' | tr -d '()')
            local device_name
            device_name=$(echo "$devices" | sed 's/ (.*//')
            print_pass "Auto-detected device: $device_name ($DEVICE_UDID)"
        else
            echo -e "${YELLOW}Multiple devices connected. Specify one with --device <UDID>:${NC}"
            echo "$devices"
            exit 1
        fi
    else
        print_pass "Using specified device: $DEVICE_UDID"
    fi

    # Check if app is installed
    if xcrun devicectl device info apps --device "$DEVICE_UDID" 2>/dev/null | grep -q "$BUNDLE_ID"; then
        print_pass "App $BUNDLE_ID installed on device"
    else
        print_warn "Could not verify app installation (devicectl may not support this)"
        print_info "Make sure $BUNDLE_ID is installed on the device"
    fi

    # Create output directory
    mkdir -p "$OUTPUT_DIR"
    print_pass "Output directory: $OUTPUT_DIR"

    echo ""
}

# Get app PID on device
get_app_pid() {
    local pid
    pid=$(xcrun devicectl device info processes --device "$DEVICE_UDID" 2>/dev/null | grep "$BUNDLE_ID" | awk '{print $1}' || true)
    echo "$pid"
}

# Launch app on device
launch_app() {
    print_info "Launching $BUNDLE_ID on device..."
    xcrun devicectl device process launch --device "$DEVICE_UDID" "$BUNDLE_ID" 2>/dev/null || {
        print_warn "Could not auto-launch app. Please launch manually."
        echo ""
        echo "  Open the ShadowSky app on your device, then press Enter to continue."
        read -r
    }
    sleep 3  # Wait for app to settle
}

# Record an Instruments trace
record_trace() {
    local test_name="$1"
    local template="$2"
    local duration="$3"
    local trace_file="$OUTPUT_DIR/${test_name}_${TIMESTAMP}.trace"

    # Use duration override if set
    if [ -n "$DURATION_OVERRIDE" ]; then
        duration="$DURATION_OVERRIDE"
    fi

    print_info "Recording: $template for ${duration}s"
    print_info "Output: $trace_file"
    echo ""

    # Get app PID
    local pid
    pid=$(get_app_pid)
    if [ -z "$pid" ]; then
        print_warn "App not running. Launching..."
        launch_app
        pid=$(get_app_pid)
        if [ -z "$pid" ]; then
            echo -e "${RED}Error: Could not find app process. Launch the app manually and retry.${NC}"
            return 1
        fi
    fi

    print_info "Attaching to PID: $pid"
    echo ""
    echo -e "${YELLOW}>>> Perform the test actions on the device now <<<${NC}"
    echo -e "${YELLOW}>>> Recording will auto-stop after ${duration}s     <<<${NC}"
    echo ""

    # Record trace
    xctrace record \
        --device "$DEVICE_UDID" \
        --template "$template" \
        --attach "$pid" \
        --time-limit "${duration}s" \
        --output "$trace_file" \
        2>&1 || {
        echo -e "${RED}Error recording trace. Make sure the app is running and Instruments is not open.${NC}"
        return 1
    }

    print_pass "Trace saved: $trace_file"
    echo "$trace_file"
}

# Test 1: Sustained Feed Scroll
test1_sustained_scroll() {
    print_header "Test 1: Sustained Feed Scroll (5 min)"

    echo "Instructions:"
    echo "  1. Open the Home feed in ShadowSky"
    echo "  2. Wait for feed to fully load"
    echo "  3. When recording starts, scroll continuously downward at ~2 posts/sec"
    echo "  4. Continue scrolling for the full duration"
    echo ""
    echo "Press Enter when ready to start recording..."
    read -r

    # Record with Allocations template (includes Time Profiler data)
    local trace_file
    trace_file=$(record_trace "sustained-scroll" "Allocations" "$DURATION_SUSTAINED_SCROLL")

    echo ""
    print_header "Test 1: Post-Capture Analysis"

    # Export and analyze
    if [ -f "$trace_file" ]; then
        analyze_sustained_scroll "$trace_file"
    fi
}

# Test 2: Rapid Load-More
test2_rapid_loadmore() {
    print_header "Test 2: Rapid Load-More Pagination"

    echo "Instructions:"
    echo "  1. Open the Home feed in ShadowSky"
    echo "  2. When recording starts, scroll rapidly to trigger load-more"
    echo "  3. As soon as new content appears, immediately scroll to bottom again"
    echo "  4. Repeat 5+ times in quick succession"
    echo ""
    echo "Press Enter when ready to start recording..."
    read -r

    local trace_file
    trace_file=$(record_trace "rapid-loadmore" "Time Profiler" "$DURATION_RAPID_LOADMORE")

    echo ""
    print_header "Test 2: Post-Capture Analysis"

    if [ -f "$trace_file" ]; then
        analyze_rapid_loadmore "$trace_file"
    fi
}

# Test 3: Memory Pressure
test3_memory_pressure() {
    print_header "Test 3: Memory Pressure Test"

    echo "Instructions:"
    echo "  1. Open the Home feed in ShadowSky"
    echo "  2. Scroll through 10+ pages of content"
    echo "  3. After ~60s of scrolling, press Home to background the app"
    echo "  4. Wait 10 seconds"
    echo "  5. Open Camera or Maps (memory-intensive app)"
    echo "  6. Return to ShadowSky"
    echo ""
    echo "Press Enter when ready to start recording..."
    read -r

    local trace_file
    trace_file=$(record_trace "memory-pressure" "Allocations" "$DURATION_MEMORY_PRESSURE")

    echo ""
    print_header "Test 3: Post-Capture Analysis"

    if [ -f "$trace_file" ]; then
        analyze_memory_pressure "$trace_file"
    fi
}

# Test 4: Timer Audit
test4_timer_audit() {
    print_header "Test 4: Background Timer Audit"

    echo "Instructions:"
    echo "  1. Open the Home feed in ShadowSky"
    echo "  2. Scroll continuously for the full duration"
    echo "  3. Watch for any visible stutters or hitches"
    echo ""
    echo "Press Enter when ready to start recording..."
    read -r

    local trace_file
    trace_file=$(record_trace "timer-audit" "System Trace" "$DURATION_TIMER_AUDIT")

    echo ""
    print_header "Test 4: Post-Capture Analysis"

    if [ -f "$trace_file" ]; then
        print_info "System Trace analysis requires manual inspection in Instruments."
        print_info "Open: $trace_file"
        echo ""
        echo "  Check for:"
        echo "  - Timer callbacks on Main Thread during scroll"
        echo "  - Notification polling interval (should be 30s or 120s)"
        echo "  - No timer handler blocking main thread >5ms"
    fi
}

# Analyze sustained scroll trace
analyze_sustained_scroll() {
    local trace_file="$1"

    print_info "Analyzing trace: $trace_file"
    print_info "(Full analysis requires opening in Instruments GUI)"
    echo ""

    # Export basic statistics via xctrace
    local export_file="$OUTPUT_DIR/sustained-scroll_${TIMESTAMP}_export.xml"
    xctrace export --input "$trace_file" --xpath '/trace-toc/run/data/table[@schema="alloc-statistics"]' --output "$export_file" 2>/dev/null || {
        print_warn "Could not export allocation statistics (trace format may differ)"
    }

    echo "Manual checks required in Instruments:"
    echo ""
    echo "  1. MEMORY PLATEAU (Target: ≤${MEMORY_PLATEAU_MB} MB)"
    echo "     → Allocations > Statistics > All Heap & Anonymous VM > Persistent Bytes"
    echo "     → Look for plateau (flat line) after initial ~30s ramp-up"
    echo ""
    echo "  2. MEMORY GROWTH RATE (Target: <${MEMORY_GROWTH_RATE_MB_PER_MIN} MB/min)"
    echo "     → Select time range from 2:00 to 5:00 in Allocations"
    echo "     → Calculate: (end bytes - start bytes) / 3 minutes"
    echo ""
    echo "  3. JS THREAD UTILIZATION (Target: <${JS_THREAD_UTIL_PCT}%)"
    echo "     → Time Profiler > Thread: com.facebook.react.JavaScript"
    echo "     → Check CPU % in bottom panel"
    echo ""
    echo "  4. FRAME RATE (Target: >${FRAME_RATE_MIN_FPS} fps)"
    echo "     → Core Animation > FPS gauge"
    echo "     → Check for sustained drops below 55 fps"
    echo ""
    echo "  5. P0 FIX VALIDATION (visiblePostUris ref)"
    echo "     → Time Profiler > Call Tree > search 'FeedList'"
    echo "     → Should NOT see continuous FeedList.render during scroll"
    echo "     → Should NOT see React.setState from scroll handler"
    echo ""
    echo "  6. P1 FIX VALIDATION (regex cache)"
    echo "     → Time Profiler > JS Thread > search 'RegExp' or 'compile'"
    echo "     → Total time should be <5ms across full recording"
    echo ""
    echo "  7. P2 FIX VALIDATION (SDWebImage cache)"
    echo "     → Allocations > filter 'UIImage' or 'CG raster data'"
    echo "     → Should plateau at ~80-100MB (not grow unbounded)"
}

# Analyze rapid load-more trace
analyze_rapid_loadmore() {
    local trace_file="$1"

    print_info "Analyzing trace: $trace_file"
    echo ""

    echo "Manual checks required in Instruments:"
    echo ""
    echo "  1. MAIN THREAD BLOCKS (Target: <${MAIN_THREAD_BLOCK_MS}ms)"
    echo "     → Time Profiler > Main Thread > Heaviest Stack Trace"
    echo "     → Look for blocks >16ms during load-more events"
    echo ""
    echo "  2. JSON DECODE TIME (Target: <${JSON_DECODE_MS}ms/page)"
    echo "     → Time Profiler > search 'JSONDecoder' in call tree"
    echo "     → Each decode should be <50ms"
    echo ""
    echo "  3. NSLOCK CONTENTION (Target: <5ms)"
    echo "     → Thread States > Main Thread > look for 'Blocked' state"
    echo "     → Should not block >5ms waiting on feedDataLock"
    echo ""
    echo "  4. P6 FIX VALIDATION (consolidated struct copies)"
    echo "     → Time Profiler > search 'SerializedPost.init'"
    echo "     → Should see 1 init per post per update, NOT 3"
    echo "     → Total SerializedPost time <10ms per batch"
}

# Analyze memory pressure trace
analyze_memory_pressure() {
    local trace_file="$1"

    print_info "Analyzing trace: $trace_file"
    echo ""

    echo "Manual checks required in Instruments:"
    echo ""
    echo "  1. MEMORY DROP ON BACKGROUND (Target: >30% reduction)"
    echo "     → Allocations > Persistent Bytes"
    echo "     → Compare value before and after backgrounding"
    echo "     → (peak - post_background) / peak × 100 should be >30%"
    echo ""
    echo "  2. CG RASTER DATA (Target: decreases on background)"
    echo "     → VM Tracker > filter 'CG raster data'"
    echo "     → Should show clear drop when app backgrounds"
    echo ""
    echo "  3. POST-PRESSURE MEMORY (Target: <120 MB)"
    echo "     → Allocations > Persistent Bytes after returning to app"
    echo "     → Should be lower than pre-background peak"
    echo ""
    echo "  4. APP SURVIVAL (Target: no OOM crash)"
    echo "     → App should still be running after memory pressure"
    echo "     → Check Console.app for any jetsam events"
}

# Parse arguments
parse_args() {
    local test_name=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            test1-sustained-scroll|test2-rapid-loadmore|test3-memory-pressure|test4-timer-audit|all)
                test_name="$1"
                shift
                ;;
            --device)
                DEVICE_UDID="$2"
                shift 2
                ;;
            --duration)
                DURATION_OVERRIDE="$2"
                shift 2
                ;;
            --output)
                OUTPUT_DIR="$2"
                shift 2
                ;;
            --app)
                BUNDLE_ID="$2"
                shift 2
                ;;
            --analyze)
                ANALYZE_ONLY=true
                shift
                ;;
            --help|-h)
                head -40 "$0" | tail -35
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown argument: $1${NC}"
                echo "Run with --help for usage information."
                exit 1
                ;;
        esac
    done

    if [ -z "$test_name" ] && [ "$ANALYZE_ONLY" = false ]; then
        echo "Usage: $0 <test-name> [options]"
        echo ""
        echo "Tests: test1-sustained-scroll, test2-rapid-loadmore, test3-memory-pressure, test4-timer-audit, all"
        echo "Run with --help for full usage information."
        exit 1
    fi

    echo "$test_name"
}

# Main
main() {
    local test_name
    test_name=$(parse_args "$@")

    if [ "$ANALYZE_ONLY" = true ]; then
        print_header "Analyzing Existing Traces"
        for trace in "$OUTPUT_DIR"/*.trace; do
            if [ -f "$trace" ]; then
                print_info "Found: $trace"
            fi
        done
        echo ""
        echo "Open traces in Instruments for detailed analysis."
        exit 0
    fi

    check_prerequisites

    case "$test_name" in
        test1-sustained-scroll)
            test1_sustained_scroll
            ;;
        test2-rapid-loadmore)
            test2_rapid_loadmore
            ;;
        test3-memory-pressure)
            test3_memory_pressure
            ;;
        test4-timer-audit)
            test4_timer_audit
            ;;
        all)
            test1_sustained_scroll
            test2_rapid_loadmore
            test3_memory_pressure
            test4_timer_audit

            print_header "All Tests Complete"
            echo "Traces saved to: $OUTPUT_DIR"
            echo ""
            echo "Open each trace in Instruments for detailed analysis:"
            ls -la "$OUTPUT_DIR"/*.trace 2>/dev/null || true
            ;;
    esac

    echo ""
    print_header "Validation Complete"
    echo "Review the analysis instructions above and fill in the results template"
    echo "in mobile/docs/ON_DEVICE_VALIDATION_PLAN.md"
}

main "$@"
