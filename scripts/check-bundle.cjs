#!/usr/bin/env node

const https = require('https');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ data, headers: res.headers }));
    }).on('error', reject);
  });
}

async function checkUrl(url) {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Fetching:', url);

  const { data: html } = await fetch(url);
  console.log('HTML length:', html.length, 'bytes');

  // Find script tags with src
  const scriptMatches = [...html.matchAll(/<script[^>]*src="([^"]+)"[^>]*>/g)];
  console.log('Script tags with src:', scriptMatches.length);
  scriptMatches.forEach(m => console.log('  -', m[1]));

  // Look for the main bundle
  const bundleMatch = html.match(/src="(\/assets\/index-[^"]+\.js[^"]*)"/);
  if (bundleMatch) {
    console.log('\n✅ Found main bundle:', bundleMatch[1]);

    // Fetch and check the bundle
    const bundleUrl = new URL(bundleMatch[1], url).href;
    console.log('Fetching bundle:', bundleUrl);
    const { data: js } = await fetch(bundleUrl);
    console.log('Bundle size:', js.length, 'bytes');

    console.log('\nChecking for multi-account strings:');
    const checks = [
      'Sign into another account',
      '/add-account',
      'handleAddAccount'
    ];
    checks.forEach(str => {
      const found = js.includes(str);
      console.log(`  "${str}": ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    });
  } else {
    console.log('\n❌ Main bundle NOT FOUND in HTML');
    console.log('Last 500 chars of HTML:');
    console.log(html.slice(-500));
  }
}

async function main() {
  const urls = [
    'https://main.shadowsky.io/',
    'https://main.d1g6mni4b6812x.amplifyapp.com/'
  ];

  for (const url of urls) {
    try {
      await checkUrl(url);
    } catch (err) {
      console.log('Error fetching', url, ':', err.message);
    }
  }
}

main().catch(console.error);
