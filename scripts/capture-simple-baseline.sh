#!/bin/bash

echo "🎯 Capturing Simple Visual Baseline"
echo "==================================="
echo ""

# Check if server is running
if ! curl -s http://127.0.0.1:5173 > /dev/null; then
    echo "❌ Dev server is not running!"
    echo "Starting server..."
    ./scripts/dev-server.sh start
    sleep 5
fi

# Create baseline directory
BASELINE_DIR="tests/visual-baseline-simple"
mkdir -p $BASELINE_DIR

echo "📸 Capturing essential screenshots..."
echo ""

# Run a simple Playwright script
cat > /tmp/capture-baseline.mjs << 'EOF'
import { chromium } from '@playwright/test';

async function captureBaseline() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  console.log('1. Capturing login page...');
  await page.goto('http://127.0.0.1:5173');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'tests/visual-baseline-simple/01-login-page.png', fullPage: true });

  console.log('2. Logging in...');
  await page.fill('input[placeholder="Username or email"]', process.env.VITE_TEST_IDENTIFIER || 'your-test-account@email.com');
  await page.fill('input[type="password"]', process.env.VITE_TEST_PASSWORD || 'your-test-password');
  await page.click('button[type="submit"]');
  
  // Wait for feed to load
  await page.waitForSelector('.feed-container', { timeout: 30000 });
  await page.waitForTimeout(3000);

  console.log('3. Capturing feed view...');
  await page.screenshot({ path: 'tests/visual-baseline-simple/02-feed-view.png', fullPage: true });

  console.log('4. Capturing header...');
  const header = await page.$('.header-container');
  if (header) {
    await header.screenshot({ path: 'tests/visual-baseline-simple/03-header.png' });
  }

  console.log('5. Capturing sidebar...');
  const sidebar = await page.$('.sidebar-container');
  if (sidebar) {
    await sidebar.screenshot({ path: 'tests/visual-baseline-simple/04-sidebar.png' });
  }

  console.log('6. Capturing first post...');
  const post = await page.$('.post-card');
  if (post) {
    await post.screenshot({ path: 'tests/visual-baseline-simple/05-post-card.png' });
  }

  console.log('7. Capturing mobile view...');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/visual-baseline-simple/06-mobile-view.png', fullPage: true });

  console.log('8. Capturing tablet view...');
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/visual-baseline-simple/07-tablet-view.png', fullPage: true });

  await browser.close();
  console.log('\n✅ Baseline captured successfully!');
}

captureBaseline().catch(err => {
  console.error('❌ Error capturing baseline:', err);
  process.exit(1);
});
EOF

# Run the capture script
node /tmp/capture-baseline.mjs

if [ $? -eq 0 ]; then
    echo ""
    echo "📊 Screenshots captured:"
    ls -la tests/visual-baseline-simple/*.png | wc -l
    echo ""
    echo "📁 Baseline saved to: tests/visual-baseline-simple/"
    echo ""
    echo "✅ Simple baseline captured successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Review the screenshots in tests/visual-baseline-simple/"
    echo "2. Proceed with Tailwind installation"
else
    echo ""
    echo "❌ Failed to capture baseline!"
    exit 1
fi