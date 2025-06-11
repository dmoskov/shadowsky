#!/usr/bin/env node

import puppeteer from 'puppeteer'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const APP_URL = 'http://127.0.0.1:5173'

async function testThreadStructure() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 }
  })

  try {
    const page = await browser.newPage()
    console.log('📱 Testing thread structure...')

    // Navigate to app
    await page.goto(APP_URL)
    await page.waitForSelector('input[type="text"]', { timeout: 10000 })

    // Login
    console.log('🔐 Logging in...')
    await page.type('input[type="text"]', 'bskyclienttest.bsky.social')
    await page.type('input[type="password"]', 'test-client-123')
    await page.click('button[type="submit"]')

    // Wait for feed
    await page.waitForSelector('[class*="max-w-2xl"]', { timeout: 15000 })
    console.log('✅ Feed loaded')

    // Find a post with replies
    const postWithReplies = await page.evaluate(() => {
      const posts = document.querySelectorAll('article')
      for (const post of posts) {
        const replyCount = post.querySelector('button:has([class*="MessageCircle"]) span')
        if (replyCount && parseInt(replyCount.textContent) > 0) {
          return true
        }
      }
      return false
    })

    if (postWithReplies) {
      console.log('🔍 Found post with replies, clicking to view thread...')
      
      // Click on first post with replies
      await page.evaluate(() => {
        const posts = document.querySelectorAll('article')
        for (const post of posts) {
          const replyCount = post.querySelector('button:has([class*="MessageCircle"]) span')
          if (replyCount && parseInt(replyCount.textContent) > 0) {
            post.click()
            break
          }
        }
      })

      // Wait for thread view
      await page.waitForSelector('[class*="min-h-screen"]', { timeout: 10000 })
      console.log('✅ Thread view loaded')

      // Check thread structure
      const threadInfo = await page.evaluate(() => {
        const threadLines = document.querySelectorAll('[class*="absolute"][class*="bg-gray-800"]')
        const replyIndicators = document.querySelectorAll('span:contains("Replying to @")')
        const posts = document.querySelectorAll('article')
        const mainPost = document.querySelector('[class*="bg-gray-800/20"]')
        
        return {
          threadLineCount: threadLines.length,
          replyIndicatorCount: replyIndicators.length,
          postCount: posts.length,
          hasMainPost: !!mainPost,
          spacing: posts[0]?.classList.contains('py-2.5') || posts[0]?.classList.contains('py-3')
        }
      })

      console.log('\n📊 Thread Structure Analysis:')
      console.log(`- Thread lines: ${threadInfo.threadLineCount}`)
      console.log(`- Reply indicators: ${threadInfo.replyIndicatorCount}`)
      console.log(`- Posts in thread: ${threadInfo.postCount}`)
      console.log(`- Main post highlighted: ${threadInfo.hasMainPost}`)
      console.log(`- Proper spacing: ${threadInfo.spacing}`)

      // Take screenshot
      await page.screenshot({ 
        path: join(__dirname, '../test-screenshots/thread-structure-test.png'),
        fullPage: true
      })
      console.log('\n📸 Screenshot saved to test-screenshots/thread-structure-test.png')
    } else {
      console.log('⚠️ No posts with replies found in current feed')
    }

    console.log('\n✅ Thread structure test complete!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    throw error
  } finally {
    await browser.close()
  }
}

testThreadStructure().catch(console.error)