import puppeteer from 'puppeteer'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { getTestCredentials } = require('../src/lib/test-credentials.js')

async function testTimelineWithLogin() {
  console.log('Testing timeline with automatic login...')
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 })
    
    // Navigate to app
    await page.goto('http://127.0.0.1:5173/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    })
    
    console.log('✅ Page loaded')
    
    // Check if login form is visible
    const loginForm = await page.$('form')
    if (loginForm) {
      console.log('📝 Login form found - attempting automatic login...')
      
      // Get test credentials
      const credentials = getTestCredentials()
      if (!credentials.username || !credentials.password) {
        console.error('❌ Test credentials not configured. Please set TEST_USERNAME and TEST_PASSWORD environment variables.')
        return
      }
      
      // Fill in login form
      await page.type('input[type="text"], input[type="email"], input[placeholder*="username" i], input[placeholder*="email" i]', credentials.username)
      await page.type('input[type="password"]', credentials.password)
      
      console.log('✅ Credentials entered')
      
      // Submit form
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        page.click('button[type="submit"]')
      ])
      
      console.log('✅ Login submitted')
      
      // Wait a moment for the feed to load
      await page.waitForTimeout(3000)
    }
    
    // Check if feed is visible
    const feedElement = await page.$('[class*="feed"], [class*="Feed"], [data-testid="feed"], .border-t.border-gray-800')
    if (feedElement) {
      console.log('✅ Feed container found')
      
      // Wait for posts to load
      try {
        await page.waitForSelector('[class*="post"], [class*="Post"], article, .bg-gray-900.border-b', {
          timeout: 10000
        })
        console.log('✅ Posts are loading successfully!')
        
        // Count posts
        const posts = await page.$$('[class*="post"], [class*="Post"], article, .bg-gray-900.border-b')
        console.log(`✅ Found ${posts.length} posts in the timeline`)
        
      } catch (error) {
        console.log('❌ No posts found - timeline might not be loading')
        
        // Check for error messages
        const errorElement = await page.$('[class*="error"], [class*="Error"]')
        if (errorElement) {
          const errorText = await page.evaluate(el => el.textContent, errorElement)
          console.log('❌ Error message found:', errorText)
        }
        
        // Check for loading state
        const loadingElement = await page.$('[class*="loading"], [class*="Loading"], [class*="skeleton"]')
        if (loadingElement) {
          console.log('⏳ Feed appears to be stuck in loading state')
        }
      }
      
      // Take screenshot
      await page.screenshot({ 
        path: 'tests/screenshots/timeline-debug-feed-loaded.png',
        fullPage: true 
      })
      
      console.log('📸 Screenshot saved to tests/screenshots/timeline-debug-feed-loaded.png')
    } else {
      console.log('❌ No feed element found after login')
      
      // Check current URL
      const currentUrl = page.url()
      console.log('Current URL:', currentUrl)
      
      // Take screenshot for debugging
      await page.screenshot({ 
        path: 'tests/screenshots/timeline-debug-after-login.png',
        fullPage: true 
      })
      
      console.log('📸 Debug screenshot saved to tests/screenshots/timeline-debug-after-login.png')
    }
    
    // Listen for console errors
    const errors = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
        console.error('Browser console error:', msg.text())
      }
    })
    
    // Wait a bit to catch any console errors
    await page.waitForTimeout(2000)
    
    if (errors.length > 0) {
      console.log(`\n❌ Found ${errors.length} console errors`)
    }
    
  } catch (error) {
    console.error('Error during test:', error)
  } finally {
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser is open for manual inspection. Press Ctrl+C to close.')
  }
}

testTimelineWithLogin().catch(console.error)