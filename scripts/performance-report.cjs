#!/usr/bin/env node
/**
 * Generate performance report for the app
 * Usage: node scripts/performance-report.js
 */

const playwright = require('playwright');

(async () => {
  console.log('🚀 Starting performance analysis...\n');

  const browser = await playwright.chromium.launch({ 
    headless: false,
    devtools: true 
  });

  const page = await browser.newPage();

  // Collect performance metrics
  const metrics = {
    navigation: {},
    vitals: {},
    customMetrics: []
  };

  // Listen for console messages (where our performance tracking outputs)
  page.on('console', msg => {
    const text = msg.text();
    
    // Parse Web Vitals
    if (text.includes('LCP:') || text.includes('FID:') || text.includes('CLS:') || 
        text.includes('FCP:') || text.includes('TTFB:') || text.includes('INP:')) {
      console.log(text);
    }
    
    // Parse custom metrics
    if (text.includes('Custom Metric:') || text.includes('API:')) {
      console.log(text);
    }
    
    // Parse navigation timing
    if (text.includes('Navigation Performance')) {
      console.log(text);
    }
  });

  console.log('📍 Navigating to app...');
  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });

  // Wait for metrics to be collected
  await page.waitForTimeout(3000);

  // Measure initial page load
  const performanceTiming = await page.evaluate(() => {
    const timing = performance.timing;
    return {
      dns: timing.domainLookupEnd - timing.domainLookupStart,
      tcp: timing.connectEnd - timing.connectStart,
      request: timing.responseStart - timing.requestStart,
      response: timing.responseEnd - timing.responseStart,
      dom: timing.domComplete - timing.domLoading,
      load: timing.loadEventEnd - timing.navigationStart
    };
  });

  console.log('\n📊 Page Load Metrics:');
  console.log(`  DNS Lookup: ${performanceTiming.dns}ms`);
  console.log(`  TCP Connection: ${performanceTiming.tcp}ms`);
  console.log(`  Request Time: ${performanceTiming.request}ms`);
  console.log(`  Response Time: ${performanceTiming.response}ms`);
  console.log(`  DOM Processing: ${performanceTiming.dom}ms`);
  console.log(`  Total Load Time: ${performanceTiming.load}ms`);

  // Check if login is needed
  const needsLogin = await page.$('input[type="text"]');
  if (needsLogin) {
    console.log('\n🔐 App requires login. Please log in manually.');
    console.log('   Performance metrics will be collected after login.\n');
    
    // Wait for user to log in
    await page.waitForSelector('.feed-container', { timeout: 60000 });
    console.log('✅ Login successful, collecting performance data...\n');
    
    // Wait for feed to load and metrics to be collected
    await page.waitForTimeout(5000);
  }

  // Measure memory usage
  const memoryUsage = await page.evaluate(() => {
    if (performance.memory) {
      return {
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576),
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576)
      };
    }
    return null;
  });

  if (memoryUsage) {
    console.log('\n💾 Memory Usage:');
    console.log(`  Used Heap: ${memoryUsage.usedJSHeapSize} MB`);
    console.log(`  Total Heap: ${memoryUsage.totalJSHeapSize} MB`);
    console.log(`  Heap Limit: ${memoryUsage.limit} MB`);
  }

  // Get resource timing summary
  const resourceSummary = await page.evaluate(() => {
    const resources = performance.getEntriesByType('resource');
    const summary = {
      total: resources.length,
      byType: {},
      slowest: []
    };
    
    resources.forEach(resource => {
      const type = resource.initiatorType;
      if (!summary.byType[type]) summary.byType[type] = 0;
      summary.byType[type]++;
    });
    
    // Find slowest resources
    summary.slowest = resources
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5)
      .map(r => ({
        name: r.name.split('/').pop(),
        duration: Math.round(r.duration),
        type: r.initiatorType
      }));
    
    return summary;
  });

  console.log('\n📦 Resource Summary:');
  console.log(`  Total Resources: ${resourceSummary.total}`);
  console.log('  By Type:', resourceSummary.byType);
  console.log('\n  Slowest Resources:');
  resourceSummary.slowest.forEach(r => {
    console.log(`    ${r.name} (${r.type}): ${r.duration}ms`);
  });

  console.log('\n✨ Performance analysis complete!');
  console.log('   Check the console output above for Web Vitals and custom metrics.');
  console.log('   Browser will remain open for further inspection.\n');

  // Keep browser open
  // await browser.close();
})();