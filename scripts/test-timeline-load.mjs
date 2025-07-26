import puppeteer from 'puppeteer'

async function testTimelineLoad() {
  console.log('Testing timeline load...')
  
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
      console.log('📝 Login form found - user needs to authenticate')
      
      // Take screenshot
      await page.screenshot({ 
        path: 'tests/screenshots/timeline-debug-login.png',
        fullPage: true 
      })
      
      console.log('📸 Screenshot saved to tests/screenshots/timeline-debug-login.png')
      console.log('ℹ️  Please log in manually and check if the timeline loads')
    } else {
      // Check if feed is visible
      const feedElement = await page.$('[class*="feed"], [class*="Feed"], [data-testid="feed"]')
      if (feedElement) {
        console.log('✅ Feed element found')
        
        // Wait for posts to load
        await page.waitForSelector('[class*="post"], [class*="Post"], article', {
          timeout: 10000
        }).then(() => {
          console.log('✅ Posts are loading!')
        }).catch(() => {
          console.log('❌ No posts found - timeline might not be loading')
        })
        
        // Take screenshot
        await page.screenshot({ 
          path: 'tests/screenshots/timeline-debug-feed.png',
          fullPage: true 
        })
        
        console.log('📸 Screenshot saved to tests/screenshots/timeline-debug-feed.png')
      } else {
        console.log('❌ No feed element found')
        
        // Take screenshot for debugging
        await page.screenshot({ 
          path: 'tests/screenshots/timeline-debug-error.png',
          fullPage: true 
        })
        
        console.log('📸 Debug screenshot saved to tests/screenshots/timeline-debug-error.png')
      }
    }
    
    // Check console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('Browser console error:', msg.text())
      }
    })
    
    // Wait a bit to catch any console errors
    await new Promise(resolve => setTimeout(resolve, 2000))
    
  } catch (error) {
    console.error('Error during test:', error)
  } finally {
    // Keep browser open for manual inspection
    console.log('\n🔍 Browser is open for manual inspection. Press Ctrl+C to close.')
  }
}

testTimelineLoad().catch(console.error)