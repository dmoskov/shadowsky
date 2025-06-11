#!/bin/bash

echo "📸 Capturing post-Tailwind screenshots for comparison"
echo "===================================================="
echo ""

# Create comparison directory
COMPARE_DIR="tests/visual-compare-tailwind"
mkdir -p $COMPARE_DIR

# Run the capture script with different output directory
cat > /tmp/capture-compare.mjs << 'EOF'
import { chromium } from '@playwright/test';

async function captureForComparison() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  const compareDir = 'tests/visual-compare-tailwind';
  
  console.log('1. Capturing login page...');
  await page.goto('http://127.0.0.1:5173');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${compareDir}/01-login-page.png`, fullPage: true });

  console.log('2. Logging in...');
  await page.fill('input[placeholder="Username or email"]', process.env.VITE_TEST_IDENTIFIER || 'your-test-account@email.com');
  await page.fill('input[type="password"]', process.env.VITE_TEST_PASSWORD || 'your-test-password');
  await page.click('button[type="submit"]');
  
  // Wait for feed to load
  try {
    await page.waitForSelector('.feed-container', { timeout: 30000 });
    await page.waitForTimeout(3000);
  } catch (e) {
    console.log('Feed container not found, continuing...');
  }

  console.log('3. Capturing feed view...');
  await page.screenshot({ path: `${compareDir}/02-feed-view.png`, fullPage: true });

  console.log('4. Capturing mobile view...');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${compareDir}/06-mobile-view.png`, fullPage: true });

  await browser.close();
  console.log('\n✅ Comparison screenshots captured!');
}

captureForComparison().catch(err => {
  console.error('❌ Error capturing screenshots:', err);
  process.exit(1);
});
EOF

node /tmp/capture-compare.mjs

if [ $? -eq 0 ]; then
    echo ""
    echo "📊 Visual Comparison:"
    echo "===================="
    echo ""
    echo "Baseline: tests/visual-baseline-simple/"
    echo "Current:  tests/visual-compare-tailwind/"
    echo ""
    
    # Simple file size comparison
    echo "File size comparison:"
    for file in tests/visual-baseline-simple/*.png; do
        basename=$(basename "$file")
        if [ -f "tests/visual-compare-tailwind/$basename" ]; then
            size1=$(ls -l "$file" | awk '{print $5}')
            size2=$(ls -l "tests/visual-compare-tailwind/$basename" | awk '{print $5}')
            diff=$((size2 - size1))
            printf "%-20s: %+d bytes\n" "$basename" "$diff"
        fi
    done
    
    echo ""
    echo "✅ Visual comparison complete!"
    echo ""
    echo "To manually compare screenshots:"
    echo "1. Open both directories side by side"
    echo "2. Look for any visual differences"
else
    echo ""
    echo "❌ Failed to capture comparison screenshots!"
    exit 1
fi