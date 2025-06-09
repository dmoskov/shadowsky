#!/bin/bash

echo "🎯 Capturing Visual Regression Baseline"
echo "======================================="
echo ""
echo "This will capture baseline screenshots of all components"
echo "BEFORE we start the Tailwind migration."
echo ""

# Check if server is running
if ! curl -s http://127.0.0.1:5173 > /dev/null; then
    echo "❌ Dev server is not running!"
    echo "Starting server..."
    ./scripts/dev-server.sh start
    sleep 5
fi

# Create baseline directory
BASELINE_DIR="tests/visual-regression-baseline"
mkdir -p $BASELINE_DIR

# Backup any existing baseline
if [ -d "$BASELINE_DIR" ] && [ "$(ls -A $BASELINE_DIR)" ]; then
    BACKUP_DIR="tests/visual-regression-backup-$(date +%Y%m%d-%H%M%S)"
    echo "📦 Backing up existing baseline to: $BACKUP_DIR"
    mv $BASELINE_DIR $BACKUP_DIR
    mkdir -p $BASELINE_DIR
fi

echo ""
echo "📸 Running visual regression tests..."
echo ""

# Run the baseline capture
npx playwright test tests/visual-regression-baseline.spec.ts \
    --project=chromium \
    --update-snapshots \
    --reporter=list

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Baseline captured successfully!"
    echo ""
    echo "📁 Screenshots saved to: tests/visual-regression-baseline/"
    echo ""
    
    # Count screenshots
    SCREENSHOT_COUNT=$(find tests/visual-regression-baseline -name "*.png" | wc -l)
    echo "📊 Total screenshots captured: $SCREENSHOT_COUNT"
    
    # Create manifest
    echo "Creating baseline manifest..."
    cat > tests/visual-regression-baseline/manifest.json << EOF
{
  "captureDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "totalScreenshots": $SCREENSHOT_COUNT,
  "gitCommit": "$(git rev-parse HEAD)",
  "gitBranch": "$(git branch --show-current)",
  "purpose": "Pre-Tailwind baseline for visual regression testing"
}
EOF
    
    echo ""
    echo "📝 Next steps:"
    echo "1. Review the screenshots in tests/visual-regression-baseline/"
    echo "2. Commit these baseline images to git"
    echo "3. Run 'npm run test:visual' after any changes to detect regressions"
    
else
    echo ""
    echo "❌ Failed to capture baseline!"
    echo "Please check the error messages above."
    exit 1
fi