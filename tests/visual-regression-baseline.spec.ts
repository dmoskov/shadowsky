import { test, expect } from '@playwright/test';
import path from 'path';

// Configuration for visual regression tests
const VISUAL_CONFIG = {
  fullPage: true,
  animations: 'disabled',
  mask: ['.timestamp', '.dynamic-content'], // Mask dynamic elements
};

// Helper to login if needed
async function loginIfNeeded(page: any) {
  // Check if we're on login page
  const loginInput = await page.locator('input[placeholder="Username or email"]').count();
  if (loginInput > 0) {
    await page.fill('input[placeholder="Username or email"]', 'traviskimmel+bsky@gmail.com');
    await page.fill('input[type="password"]', 'C%;,!2iO"]Wu%11T9+Y8');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.feed-container', { timeout: 10000 });
    await page.waitForTimeout(2000); // Let the feed stabilize
  }
}

test.describe('Visual Regression Baseline - Pre-Tailwind', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await page.waitForLoadState('networkidle');
  });

  test('01 - Login Page', async ({ page }) => {
    await expect(page).toHaveScreenshot('01-login-page.png', VISUAL_CONFIG);
  });

  test('02 - Feed View', async ({ page }) => {
    await loginIfNeeded(page);
    await expect(page).toHaveScreenshot('02-feed-view.png', VISUAL_CONFIG);
    
    // Also capture individual post card
    const firstPost = page.locator('.post-card').first();
    await expect(firstPost).toHaveScreenshot('02-feed-post-card.png');
  });

  test('03 - Post Interactions', async ({ page }) => {
    await loginIfNeeded(page);
    
    // Hover states
    const firstPost = page.locator('.post-card').first();
    await firstPost.hover();
    await expect(firstPost).toHaveScreenshot('03-post-hover.png');
    
    // Like button hover
    const likeButton = firstPost.locator('.like-button').first();
    await likeButton.hover();
    await expect(firstPost).toHaveScreenshot('03-like-hover.png');
  });

  test('04 - Header Component', async ({ page }) => {
    await loginIfNeeded(page);
    const header = page.locator('.header-container');
    await expect(header).toHaveScreenshot('04-header.png');
    
    // Search bar focus
    await page.click('.search-bar input');
    await expect(header).toHaveScreenshot('04-header-search-focus.png');
  });

  test('05 - Sidebar Navigation', async ({ page }) => {
    await loginIfNeeded(page);
    const sidebar = page.locator('.sidebar-container');
    await expect(sidebar).toHaveScreenshot('05-sidebar.png');
    
    // Hover states
    const navItems = ['Home', 'Search', 'Notifications', 'Profile'];
    for (const item of navItems) {
      const navItem = sidebar.locator(`text="${item}"`).first();
      await navItem.hover();
      await expect(sidebar).toHaveScreenshot(`05-sidebar-${item.toLowerCase()}-hover.png`);
    }
  });

  test('06 - Compose Modal', async ({ page }) => {
    await loginIfNeeded(page);
    
    // Open compose modal
    await page.click('button:has-text("Compose")');
    await page.waitForSelector('.compose-modal', { timeout: 5000 });
    
    const modal = page.locator('.compose-modal');
    await expect(modal).toHaveScreenshot('06-compose-modal.png');
    
    // Type some text
    await page.fill('.compose-modal textarea', 'This is a test post for visual regression');
    await expect(modal).toHaveScreenshot('06-compose-modal-with-text.png');
  });

  test('07 - Thread View', async ({ page }) => {
    await loginIfNeeded(page);
    
    // Click on first post with replies
    const postWithReplies = page.locator('.post-card').filter({ hasText: 'replies' }).first();
    await postWithReplies.click();
    
    await page.waitForSelector('.thread-view', { timeout: 5000 });
    await page.waitForTimeout(2000); // Let thread load
    
    await expect(page).toHaveScreenshot('07-thread-view.png', VISUAL_CONFIG);
  });

  test('08 - Profile Page', async ({ page }) => {
    await loginIfNeeded(page);
    
    // Click profile in sidebar
    await page.click('.sidebar-container >> text="Profile"');
    await page.waitForSelector('.profile-container', { timeout: 5000 });
    
    await expect(page).toHaveScreenshot('08-profile-page.png', VISUAL_CONFIG);
  });

  test('09 - Settings Page', async ({ page }) => {
    await loginIfNeeded(page);
    
    // Click settings in sidebar
    await page.click('.sidebar-container >> text="Settings"');
    await page.waitForSelector('.settings-container', { timeout: 5000 });
    
    await expect(page).toHaveScreenshot('09-settings-page.png', VISUAL_CONFIG);
  });

  test('10 - Analytics Dashboard', async ({ page }) => {
    await loginIfNeeded(page);
    
    // Click analytics in sidebar
    await page.click('.sidebar-container >> text="Analytics"');
    await page.waitForSelector('.analytics-container', { timeout: 5000 });
    await page.waitForTimeout(3000); // Let charts render
    
    await expect(page).toHaveScreenshot('10-analytics-dashboard.png', VISUAL_CONFIG);
    
    // Capture individual metric cards
    const metricCard = page.locator('.metric-card').first();
    await expect(metricCard).toHaveScreenshot('10-analytics-metric-card.png');
  });

  test('11 - Mobile Viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginIfNeeded(page);
    
    await expect(page).toHaveScreenshot('11-mobile-feed.png', VISUAL_CONFIG);
    
    // Mobile menu
    await page.click('.mobile-menu-button');
    await expect(page).toHaveScreenshot('11-mobile-menu-open.png', VISUAL_CONFIG);
  });

  test('12 - Tablet Viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginIfNeeded(page);
    
    await expect(page).toHaveScreenshot('12-tablet-feed.png', VISUAL_CONFIG);
  });

  test('13 - Error States', async ({ page }) => {
    // Force an error by going to a bad route
    await page.goto('http://127.0.0.1:5173/nonexistent');
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('13-error-state.png', VISUAL_CONFIG);
  });

  test('14 - Loading States', async ({ page }) => {
    // Capture skeleton loaders
    await page.goto('http://127.0.0.1:5173');
    
    // Don't wait for network idle to capture loading state
    await expect(page).toHaveScreenshot('14-loading-skeleton.png', VISUAL_CONFIG);
  });

  test('15 - Toast Notifications', async ({ page }) => {
    await loginIfNeeded(page);
    
    // Trigger a toast by liking a post
    const likeButton = page.locator('.like-button').first();
    await likeButton.click();
    
    // Wait for toast to appear
    await page.waitForSelector('.toast-container', { timeout: 5000 });
    
    await expect(page).toHaveScreenshot('15-toast-notification.png', VISUAL_CONFIG);
  });
});

// Component-specific detail tests
test.describe('Component Details - Pre-Tailwind', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:5173');
    await loginIfNeeded(page);
  });

  test('Button States', async ({ page }) => {
    // Find all button types
    const buttons = [
      { selector: '.btn-primary', name: 'primary' },
      { selector: '.btn-secondary', name: 'secondary' },
      { selector: '.btn-ghost', name: 'ghost' },
      { selector: '.like-button', name: 'like' },
      { selector: '.repost-button', name: 'repost' },
    ];

    for (const btn of buttons) {
      const button = page.locator(btn.selector).first();
      if (await button.count() > 0) {
        // Normal state
        await expect(button).toHaveScreenshot(`button-${btn.name}-normal.png`);
        
        // Hover state
        await button.hover();
        await expect(button).toHaveScreenshot(`button-${btn.name}-hover.png`);
      }
    }
  });

  test('Form Inputs', async ({ page }) => {
    // Go to settings for form inputs
    await page.click('.sidebar-container >> text="Settings"');
    await page.waitForSelector('.settings-container');
    
    const input = page.locator('input[type="text"]').first();
    
    // Normal state
    await expect(input).toHaveScreenshot('input-normal.png');
    
    // Focus state
    await input.click();
    await expect(input).toHaveScreenshot('input-focus.png');
    
    // With value
    await input.fill('Test value');
    await expect(input).toHaveScreenshot('input-with-value.png');
  });

  test('Cards and Containers', async ({ page }) => {
    // Analytics has various card styles
    await page.click('.sidebar-container >> text="Analytics"');
    await page.waitForSelector('.analytics-container');
    await page.waitForTimeout(2000);
    
    const cards = [
      { selector: '.metric-card', name: 'metric' },
      { selector: '.chart-card', name: 'chart' },
      { selector: '.eqs-card', name: 'engagement' },
    ];

    for (const card of cards) {
      const element = page.locator(card.selector).first();
      if (await element.count() > 0) {
        await expect(element).toHaveScreenshot(`card-${card.name}.png`);
      }
    }
  });
});