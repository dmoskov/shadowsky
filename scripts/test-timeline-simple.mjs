import puppeteer from 'puppeteer'

async function testTimelineSimple() {
  console.log('Testing timeline (manual login required)...')
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 })
    
    // Enable console logging
    page.on('console', msg => {
      const type = msg.type()
      const text = msg.text()
      if (type === 'error') {
        console.error('❌ Browser error:', text)
      } else if (type === 'warning') {
        console.warn('⚠️  Browser warning:', text)
      }
    })
    
    // Listen for network errors
    page.on('pageerror', error => {
      console.error('❌ Page error:', error.message)
    })
    
    // Navigate to app
    console.log('Navigating to http://127.0.0.1:5173/')
    await page.goto('http://127.0.0.1:5173/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    })
    
    console.log('✅ Page loaded')
    
    // Wait for any element to appear
    await page.waitForSelector('body', { timeout: 5000 })
    
    // Check what's on the page
    const bodyContent = await page.evaluate(() => {
      return {
        title: document.title,
        hasLoginForm: !!document.querySelector('form'),
        hasFeed: !!document.querySelector('[class*="feed"], [class*="Feed"]'),
        hasError: !!document.querySelector('[class*="error"], [class*="Error"]'),
        visibleText: document.body.innerText.substring(0, 200)
      }
    })
    
    console.log('\n📊 Page analysis:')
    console.log('- Title:', bodyContent.title)
    console.log('- Has login form:', bodyContent.hasLoginForm)
    console.log('- Has feed:', bodyContent.hasFeed)
    console.log('- Has error:', bodyContent.hasError)
    console.log('- Visible text preview:', bodyContent.visibleText)
    
    if (bodyContent.hasLoginForm) {
      console.log('\n📝 Login form detected. Please log in manually in the browser.')
      console.log('After logging in, the timeline should load automatically.')
      
      // Take screenshot
      await page.screenshot({ 
        path: 'tests/screenshots/timeline-current-state.png',
        fullPage: true 
      })
      console.log('📸 Screenshot saved to tests/screenshots/timeline-current-state.png')
      
      // Wait for user to log in
      console.log('\n⏳ Waiting for login... (checking every 2 seconds)')
      
      let attempts = 0
      while (attempts < 30) { // Wait up to 60 seconds
        await page.waitForTimeout(2000)
        
        const stillHasLoginForm = await page.$('form')
        if (!stillHasLoginForm) {
          console.log('✅ Login detected! Checking for timeline...')
          break
        }
        
        attempts++
        if (attempts % 5 === 0) {
          console.log(`Still waiting... (${attempts * 2} seconds elapsed)`)
        }
      }
      
      // Check again after login
      const afterLogin = await page.evaluate(() => {
        return {
          hasFeed: !!document.querySelector('[class*="feed"], [class*="Feed"], .border-t.border-gray-800'),
          hasPosts: document.querySelectorAll('[class*="post"], [class*="Post"], article, .bg-gray-900').length,
          hasError: !!document.querySelector('[class*="error"], [class*="Error"]'),
          hasLoading: !!document.querySelector('[class*="loading"], [class*="Loading"], [class*="skeleton"]')
        }
      })
      
      console.log('\n📊 After login analysis:')
      console.log('- Has feed container:', afterLogin.hasFeed)
      console.log('- Number of posts:', afterLogin.hasPosts)
      console.log('- Has error:', afterLogin.hasError)
      console.log('- Is loading:', afterLogin.hasLoading)
      
      if (afterLogin.hasPosts > 0) {
        console.log('\n✅ Timeline is loading successfully! Found', afterLogin.hasPosts, 'posts.')
      } else if (afterLogin.hasLoading) {
        console.log('\n⏳ Timeline appears to be loading...')
      } else if (afterLogin.hasError) {
        console.log('\n❌ An error occurred while loading the timeline.')
      } else {
        console.log('\n❓ Timeline status unclear. Check the browser for details.')
      }
      
      // Take final screenshot
      await page.screenshot({ 
        path: 'tests/screenshots/timeline-after-login.png',
        fullPage: true 
      })
      console.log('📸 Final screenshot saved to tests/screenshots/timeline-after-login.png')
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message)
  } finally {
    console.log('\n🔍 Browser remains open. Press Ctrl+C to close.')
  }
}

testTimelineSimple().catch(console.error)