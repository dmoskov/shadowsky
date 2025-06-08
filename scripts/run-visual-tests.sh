#!/bin/bash

# Visual Regression Test Runner
# This script runs visual regression tests with proper setup

set -e

echo "🎨 Visual Regression Test Runner"
echo "================================"

# Check if dev server is running
if ! curl -s http://localhost:5173 > /dev/null; then
  echo "❌ Dev server is not running!"
  echo "Please start it with: npm run dev"
  exit 1
fi

echo "✅ Dev server is running"

# Check if .test-credentials exists
if [ ! -f ".test-credentials" ]; then
  echo "❌ .test-credentials file not found!"
  echo "Please create it with your test account credentials"
  exit 1
fi

echo "✅ Test credentials found"

# Parse command line arguments
UPDATE_SNAPSHOTS=""
UI_MODE=""
HEADED=""
TEST_FILTER=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --update)
      UPDATE_SNAPSHOTS="--update-snapshots"
      echo "📸 Will update baseline screenshots"
      shift
      ;;
    --ui)
      UI_MODE="--ui"
      echo "🖥️  Will run in UI mode"
      shift
      ;;
    --headed)
      HEADED="--headed"
      echo "👀 Will run with visible browser"
      shift
      ;;
    --grep)
      TEST_FILTER="--grep $2"
      echo "🔍 Will filter tests: $2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo ""
      echo "Usage: $0 [options]"
      echo "Options:"
      echo "  --update    Update baseline screenshots"
      echo "  --ui        Run in UI mode"
      echo "  --headed    Run with visible browser"
      echo "  --grep      Filter tests by name"
      exit 1
      ;;
  esac
done

# Run the tests
echo ""
echo "🧪 Running visual regression tests..."
echo ""

npx playwright test tests/visual-regression.spec.ts \
  $UPDATE_SNAPSHOTS \
  $UI_MODE \
  $HEADED \
  $TEST_FILTER

# Check exit code
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All visual tests passed!"
else
  echo ""
  echo "❌ Some visual tests failed"
  echo "Check the playwright-report for details"
  echo "Run 'npx playwright show-report' to view the report"
fi