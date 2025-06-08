# Visual Regression Testing

This document explains the visual regression testing setup for the Bluesky client.

## Overview

Visual regression tests capture screenshots of the application and compare them against baseline images to detect unintended visual changes.

## Test Structure

### Main Test Suites

1. **Visual Regression Tests** - Full page screenshots
   - Login page
   - Feed view
   - Thread view (with and without replies)
   - Mobile views
   - Profile, Search, Compose modal

2. **Component Visual Tests** - Focused component screenshots
   - Post card states (normal, hover)
   - Engagement buttons with tooltips
   - Thread hierarchy elements

3. **Responsive Design Tests** - Multiple viewport sizes
   - Desktop Large (1920x1080)
   - Desktop (1280x720)
   - Tablet (768x1024)
   - Mobile (375x667)

## Running Tests

```bash
# Run all visual tests
npx playwright test visual-regression.spec.ts

# Run with UI mode for debugging
npx playwright test visual-regression.spec.ts --ui

# Update baseline screenshots
npx playwright test visual-regression.spec.ts --update-snapshots

# Run specific test
npx playwright test visual-regression.spec.ts -g "Thread view styling"
```

## Screenshot Storage

Screenshots are stored in:
- **Baseline**: `tests/visual-regression.spec.ts-snapshots/`
- **Actual**: Generated during test runs
- **Diff**: Created when tests fail

## Best Practices

### When to Update Baselines

Update baseline screenshots when:
1. Intentional design changes are made
2. New features are added
3. CSS refactoring is complete

### Writing New Tests

```typescript
test('New component styling', async ({ page }) => {
  // Navigate to component
  await page.goto('/path/to/component');
  
  // Wait for specific elements
  await page.waitForSelector('.component-class');
  
  // Take screenshot
  await expect(page).toHaveScreenshot('component-name.png', {
    fullPage: false,
    animations: 'disabled'
  });
});
```

### Test Stability Tips

1. **Disable animations**: Use `animations: 'disabled'` to avoid flaky tests
2. **Wait for content**: Ensure dynamic content is loaded before screenshots
3. **Use stable selectors**: Prefer data attributes over classes when possible
4. **Set viewport**: Explicitly set viewport size for consistent results

## CI Integration

To run in CI:

```yaml
- name: Run visual tests
  run: npx playwright test visual-regression.spec.ts
  
- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Common Issues

1. **Flaky tests**: Add explicit waits for dynamic content
2. **Font differences**: Ensure consistent font loading across environments
3. **Color differences**: Check color profiles and monitor calibration
4. **Timing issues**: Use `waitForLoadState('networkidle')` for complex pages

### Debugging Failed Tests

1. Run with `--ui` flag to see visual comparison
2. Check diff images in test results
3. Use `--headed` to watch test execution
4. Add `page.pause()` for debugging

## Maintenance

### Regular Tasks

1. **Review failures**: Check if changes are intentional
2. **Update baselines**: After confirming visual changes
3. **Clean old screenshots**: Remove outdated baseline images
4. **Monitor test duration**: Optimize slow tests

### Adding New Pages/Components

When adding new UI:
1. Write visual test for the component
2. Generate initial baseline
3. Review baseline for correctness
4. Commit baseline with feature