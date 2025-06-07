#!/usr/bin/env node

import { chromium } from 'playwright';
import fs from 'fs/promises';

const testToasts = async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    // Login
    await page.goto('http://127.0.0.1:5173/');
    
    // Read credentials
    const credentials = await fs.readFile('.test-credentials', 'utf-8');
    const [username, password] = credentials.trim().split('\n');
    
    // Wait for login form
    await page.waitForSelector('input[type="text"]', { timeout: 5000 });
    
    // Fill login form
    await page.fill('input[type="text"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    // Wait for navigation or feed to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give time for app to render
    
    // Debug: take screenshot to see current state
    await page.screenshot({ path: 'test-screenshots/current-state.png', fullPage: false });
    
    // Check if we're logged in by looking for the header
    const headerExists = await page.$('.header');
    if (!headerExists) {
      console.log('Login might have failed, checking page content...');
      const content = await page.content();
      console.log('Page title:', await page.title());
      throw new Error('Could not find header after login');
    }
    
    // Click on user menu
    await page.click('.user-menu-trigger');
    await page.waitForSelector('.dropdown-menu');
    
    // Test bookmark toast
    await page.click('button:has-text("Bookmarks")');
    
    // Take screenshot after toast appears
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-screenshots/toast-info.png', fullPage: false });
    
    // Click on user menu again
    await page.click('.user-menu-trigger');
    await page.waitForSelector('.dropdown-menu');
    
    // Test settings toast
    await page.click('button:has-text("Settings")');
    
    // Take screenshot after toast appears
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-screenshots/toast-warning.png', fullPage: false });
    
    console.log('Toast screenshots captured successfully!');
    
  } catch (error) {
    console.error('Error testing toasts:', error);
  } finally {
    await browser.close();
  }
};

testToasts();