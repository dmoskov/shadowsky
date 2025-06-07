const { chromium } = require('playwright');

async function checkBadgeColor() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Quick check of CSS variables
    const result = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        hasColorError: styles.getPropertyValue('--color-error'),
        bodyBgColor: getComputedStyle(document.body).backgroundColor
      };
    });
    
    console.log('CSS Check:');
    console.log('--color-error:', result.hasColorError || 'NOT DEFINED');
    console.log('Body background:', result.bodyBgColor);
    
    if (!result.hasColorError) {
      console.log('\n❌ Issue found: --color-error CSS variable is not defined!');
      console.log('This explains why the notification badge appears dark.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
  
  await browser.close();
}

checkBadgeColor();