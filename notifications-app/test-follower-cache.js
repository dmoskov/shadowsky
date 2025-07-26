import { chromium } from 'playwright'
import { getCredentials } from '../tests/playwright/helpers/credentials.js'

const TEST_URL = 'http://localhost:5174'

async function testFollowerCache() {
  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    console.log('📱 Opening Notifications App...')
    await page.goto(TEST_URL)
    await page.waitForLoadState('networkidle')

    // Login
    const { username, password } = getCredentials()
    console.log('🔑 Logging in...')
    await page.fill('input[placeholder*="Username"]', username)
    await page.fill('input[type="password"]', password)
    await page.click('button:has-text("Sign in")')
    
    // Wait for dashboard to load
    await page.waitForSelector('text="Notifications Analytics"', { timeout: 10000 })
    console.log('✅ Logged in successfully')

    // Navigate to Top Accounts view
    console.log('📊 Navigating to Top Accounts...')
    await page.click('button:has-text("Top Accounts")')
    await page.waitForSelector('text="Top Accounts"', { timeout: 10000 })

    // Wait for cache indicator
    await page.waitForSelector('text="Cache:"', { timeout: 10000 })
    
    // Check cache stats
    const cacheStats = await page.textContent('[class*="Database"] + span')
    console.log('💾 Cache Stats:', cacheStats)

    // Look for cache indicators on account cards
    const cacheIndicators = await page.$$('[title*="Profile data fetched"]')
    console.log(`📦 Found ${cacheIndicators.length} cached profiles`)

    // Navigate to settings
    console.log('⚙️ Opening Settings...')
    await page.click('button:has([class*="Settings"])')
    await page.waitForSelector('text="Profile Cache"', { timeout: 5000 })

    // Click Manage Cache
    console.log('🗄️ Opening Cache Management...')
    await page.click('button:has-text("Manage Cache")')
    await page.waitForSelector('text="Cache Statistics"', { timeout: 5000 })

    // Get cache statistics
    const stats = await page.evaluate(() => {
      const statsElements = document.querySelectorAll('.grid .text-lg')
      return {
        profiles: statsElements[0]?.textContent || '0',
        interactions: statsElements[1]?.textContent || '0',
        stale: statsElements[2]?.textContent || '0',
        size: statsElements[3]?.textContent || '0'
      }
    })

    console.log('\n📊 Cache Statistics:')
    console.log(`   Cached Profiles: ${stats.profiles}`)
    console.log(`   Interaction Records: ${stats.interactions}`)
    console.log(`   Stale Profiles: ${stats.stale}`)
    console.log(`   Estimated Size: ${stats.size}`)

    // Test cache clear functionality
    console.log('\n🧹 Testing cache clear...')
    
    // If there are stale profiles, try clearing them
    if (parseInt(stats.stale) > 0) {
      console.log('   Found stale profiles, clearing...')
      await page.click('button:has-text("Clear Stale Profiles")')
      await page.waitForSelector('text="Removed"', { timeout: 5000 })
      const message = await page.textContent('[class*="bg-green"]')
      console.log(`   ✅ ${message}`)
    } else {
      console.log('   No stale profiles to clear')
    }

    // Go back to Top Accounts
    await page.click('button:has-text("Done")')
    await page.waitForTimeout(1000)
    await page.click('button:has-text("Top Accounts")')
    
    // Check if data is still displayed (from cache)
    await page.waitForSelector('text="accounts with"', { timeout: 5000 })
    console.log('\n✅ Cache is working! Top Accounts data loaded successfully')

    // Check for cache indicators
    const freshIndicators = await page.$$('span:has-text("🟢")')
    const cachedIndicators = await page.$$('span:has-text("💾")')
    
    console.log(`\n📊 Profile Status:`)
    console.log(`   Fresh profiles (🟢): ${freshIndicators.length}`)
    console.log(`   Cached profiles (💾): ${cachedIndicators.length}`)

    // Test refresh behavior
    console.log('\n🔄 Testing cache refresh...')
    await page.reload()
    await page.waitForSelector('text="Top Accounts"', { timeout: 10000 })
    
    const newCacheStats = await page.textContent('[class*="Database"] + span')
    console.log('💾 Cache Stats after refresh:', newCacheStats)

    console.log('\n✅ All cache tests passed!')

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    
    // Take screenshot for debugging
    await page.screenshot({ 
      path: 'cache-test-error.png',
      fullPage: true 
    })
    console.log('📸 Screenshot saved: cache-test-error.png')
  } finally {
    await browser.close()
  }
}

// Run the test
testFollowerCache().catch(console.error)