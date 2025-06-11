#!/usr/bin/env node

import { chromium } from '@playwright/test'

const APP_URL = 'http://127.0.0.1:5173'

async function testFeedDisplay() {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  try {
    console.log('📱 Testing feed display...')
    
    // Navigate to app
    await page.goto(APP_URL)
    await page.waitForSelector('input[type="text"]', { timeout: 10000 })

    // Login
    console.log('🔐 Logging in...')
    await page.fill('input[type="text"]', 'bskyclienttest.bsky.social')
    await page.fill('input[type="password"]', 'test-client-123')
    await page.click('button[type="submit"]')

    // Wait for feed
    await page.waitForSelector('article', { timeout: 15000 })
    console.log('✅ Feed loaded')

    // Take screenshot of feed
    await page.screenshot({ 
      path: 'test-screenshots/feed-display-test.png',
      fullPage: false
    })
    console.log('📸 Feed screenshot saved')

    // Find and click on a post with replies
    const postWithReplies = await page.locator('article').filter({ 
      has: page.locator('button span').filter({ hasText: /^[1-9]/ })
    }).first()

    if (await postWithReplies.count() > 0) {
      console.log('🔍 Found post with replies, clicking...')
      await postWithReplies.click()
      
      // Wait for thread view
      await page.waitForTimeout(2000)
      
      // Take screenshot of thread
      await page.screenshot({ 
        path: 'test-screenshots/thread-display-test.png',
        fullPage: true
      })
      console.log('📸 Thread screenshot saved')
    }

    console.log('\n✅ Test complete! Check test-screenshots/ folder')
    
    // Keep browser open for manual inspection
    await page.waitForTimeout(30000)
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    await page.screenshot({ path: 'test-screenshots/error-state.png' })
  } finally {
    await browser.close()
  }
}

testFeedDisplay().catch(console.error)