const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  const errors = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({
        type: 'console',
        text: msg.text(),
        location: msg.location()
      });
    }
  });
  
  page.on('pageerror', error => {
    errors.push({
      type: 'pageerror',
      text: error.message,
      stack: error.stack
    });
  });

  try {
    await page.goto('http://localhost:5174/', { waitUntil: 'networkidle0' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (errors.length > 0) {
      console.log('❌ Found errors:');
      errors.forEach(error => {
        console.log(`\n${error.type}: ${error.text}`);
        if (error.location) {
          console.log(`Location: ${error.location.url}:${error.location.lineNumber}:${error.location.columnNumber}`);
        }
        if (error.stack) {
          console.log(`Stack: ${error.stack}`);
        }
      });
    } else {
      console.log('✅ No console errors found');
    }
    
    // Check if app loaded
    const hasLogin = await page.$('input[type="text"]');
    const hasApp = await page.$('.min-h-screen');
    
    console.log('\nApp state:');
    console.log(`- Has login form: ${!!hasLogin}`);
    console.log(`- Has app container: ${!!hasApp}`);
    
  } catch (error) {
    console.log('Error checking page:', error.message);
  }
  
  await browser.close();
})();