#!/bin/bash

echo "🔍 Running Visual Regression Tests"
echo "================================="
echo ""

# Check if baseline exists
if [ ! -d "tests/visual-regression-baseline" ] || [ -z "$(ls -A tests/visual-regression-baseline)" ]; then
    echo "❌ No baseline found!"
    echo "Run './scripts/capture-baseline.sh' first to create baseline screenshots."
    exit 1
fi

# Check if server is running
if ! curl -s http://127.0.0.1:5173 > /dev/null; then
    echo "❌ Dev server is not running!"
    echo "Starting server..."
    ./scripts/dev-server.sh start
    sleep 5
fi

echo "📸 Comparing against baseline..."
echo ""

# Run tests without updating snapshots
npx playwright test tests/visual-regression-baseline.spec.ts \
    --project=chromium \
    --reporter=html

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ All visual regression tests passed!"
    echo "No visual changes detected."
else
    echo ""
    echo "⚠️  Visual differences detected!"
    echo ""
    echo "To view the differences:"
    echo "1. Open: npx playwright show-report"
    echo "2. Review each failed test to see the diff"
    echo ""
    echo "If the changes are intentional:"
    echo "- Run: npx playwright test tests/visual-regression-baseline.spec.ts --update-snapshots"
    echo "- This will update the baseline with the new screenshots"
fi

exit $EXIT_CODE