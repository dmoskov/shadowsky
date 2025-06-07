import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function diagnoseApp() {
  console.log('Starting Bluesky client diagnostics...\n');
  
  const browser = await chromium.launch({
    headless: false, // Set to true if you don't want to see the browser
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });
  
  // Collect page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push({
      message: error.message,
      stack: error.stack
    });
  });
  
  // Collect network failures
  const networkFailures = [];
  page.on('requestfailed', request => {
    networkFailures.push({
      url: request.url(),
      failure: request.failure()
    });
  });
  
  try {
    console.log('1. Navigating to http://localhost:5173...');
    const response = await page.goto('http://localhost:5173', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    console.log(`   Response status: ${response.status()}`);
    console.log(`   Response OK: ${response.ok()}\n`);
    
    // Wait a bit for React to mount
    console.log('2. Waiting for React app to mount...');
    await page.waitForTimeout(3000);
    
    // Check if React root exists
    const reactRoot = await page.$('#root');
    const hasReactRoot = reactRoot !== null;
    console.log(`   React root element found: ${hasReactRoot}`);
    
    // Check if React has rendered content
    const rootContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return {
        hasContent: root && root.children.length > 0,
        innerHTML: root ? root.innerHTML.substring(0, 200) + '...' : 'No root element',
        childCount: root ? root.children.length : 0
      };
    });
    
    console.log(`   Root has content: ${rootContent.hasContent}`);
    console.log(`   Child elements: ${rootContent.childCount}`);
    console.log(`   Root HTML preview: ${rootContent.innerHTML}\n`);
    
    // Check for specific React elements
    console.log('3. Checking for React components...');
    const checks = {
      'Login form': await page.$('form') !== null,
      'Username input': await page.$('input[type="text"]') !== null,
      'Password input': await page.$('input[type="password"]') !== null,
      'Login button': await page.$('button') !== null,
      'Root div content': await page.$('#root > div') !== null
    };
    
    for (const [component, found] of Object.entries(checks)) {
      console.log(`   ${component}: ${found ? '✓ Found' : '✗ Not found'}`);
    }
    
    // Check page title
    const title = await page.title();
    console.log(`\n4. Page title: "${title}"`);
    
    // Take screenshot
    const screenshotDir = path.join(__dirname, '..', 'test-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `diagnostic-${timestamp}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n5. Screenshot saved to: ${screenshotPath}`);
    
    // Report console messages
    console.log('\n6. Console messages:');
    if (consoleMessages.length === 0) {
      console.log('   No console messages');
    } else {
      consoleMessages.forEach(msg => {
        const location = msg.location ? `${msg.location.url}:${msg.location.lineNumber}` : 'unknown';
        console.log(`   [${msg.type.toUpperCase()}] ${msg.text} (${location})`);
      });
    }
    
    // Report errors
    console.log('\n7. Page errors:');
    if (pageErrors.length === 0) {
      console.log('   No page errors');
    } else {
      pageErrors.forEach(error => {
        console.log(`   ERROR: ${error.message}`);
        if (error.stack) {
          console.log(`   Stack: ${error.stack.split('\n')[0]}`);
        }
      });
    }
    
    // Report network failures
    console.log('\n8. Network failures:');
    if (networkFailures.length === 0) {
      console.log('   No network failures');
    } else {
      networkFailures.forEach(failure => {
        console.log(`   Failed: ${failure.url}`);
        console.log(`   Reason: ${failure.failure.errorText}`);
      });
    }
    
    // Check for blank page
    const bodyText = await page.evaluate(() => document.body.innerText);
    const isBlankPage = !bodyText || bodyText.trim().length === 0;
    console.log(`\n9. Blank page check: ${isBlankPage ? '⚠️  Page appears blank!' : '✓ Page has content'}`);
    
    // Get computed styles on root
    const rootStyles = await page.evaluate(() => {
      const root = document.getElementById('root');
      if (!root) return null;
      const styles = window.getComputedStyle(root);
      return {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        width: styles.width,
        height: styles.height
      };
    });
    
    console.log('\n10. Root element styles:');
    if (rootStyles) {
      Object.entries(rootStyles).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
      });
    } else {
      console.log('    No root element found');
    }
    
    // Final diagnosis
    console.log('\n=== DIAGNOSIS SUMMARY ===');
    const issues = [];
    
    if (!response.ok()) issues.push('Server response was not OK');
    if (!hasReactRoot) issues.push('React root element not found');
    if (!rootContent.hasContent) issues.push('React root has no content');
    if (pageErrors.length > 0) issues.push(`${pageErrors.length} page errors detected`);
    if (consoleMessages.some(m => m.type === 'error')) issues.push('Console errors detected');
    if (networkFailures.length > 0) issues.push(`${networkFailures.length} network failures`);
    if (isBlankPage) issues.push('Page appears to be blank');
    
    if (issues.length === 0) {
      console.log('✅ No major issues detected. App appears to be loading correctly.');
    } else {
      console.log('⚠️  Issues detected:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
    
  } catch (error) {
    console.error('\n❌ Diagnostic script error:', error.message);
  } finally {
    await browser.close();
  }
}

// Run diagnostics
diagnoseApp().catch(console.error);