#!/usr/bin/env node

/**
 * Migration script to replace hardcoded credentials with environment variable usage
 * This script updates all test files to use getTestCredentials() instead of hardcoded values
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The hardcoded credential to search for
const HARDCODED_EMAIL = 'test-account@example.com';
const HARDCODED_PASSWORDS = ['[REDACTED]', '[REDACTED]'];

// Files to migrate (from the audit + grep search)
const TEST_FILES = [
  // Root level test files
  'test-analytics-console.mjs',
  'test-analytics-debug.mjs', 
  'test-analytics-mock.mjs',
  'test-analytics-simple.mjs',
  'test-analytics.mjs',
  'test-density-improvements.mjs',
  'test-improvements.mjs',
  'test-logged-in-improvements.mjs',
  'test-settings.mjs',
  'capture-long-threads.js',
  'capture-postcard-comparison.mjs',
  'capture-compare.mjs',
  'capture-complex-threads.js',
  'capture-feed-comparison.mjs',
  'capture-baseline-simple.mjs',
  // Tests directory
  'tests/visual-regression-baseline.spec.ts',
  'tests/playwright/capture-hierarchy-screenshots.mjs',
  'tests/playwright/capture-screenshots-playwright.mjs',
  'tests/playwright/comprehensive-ui-audit.mjs',
  'tests/playwright/debug-login.js',
  'tests/playwright/debug-notification-badge.js',
  'tests/playwright/debug-thread-navigation.js',
  'tests/playwright/quick-test.js',
  'tests/playwright/quick-thread-test.js',
  'tests/playwright/test-badge-css-variables.js',
  'tests/playwright/test-color-system.js',
  'tests/playwright/test-compact-diagram.js',
  'tests/playwright/test-complex-thread-diagram.js',
  'tests/playwright/test-components-load.mjs',
  'tests/playwright/test-design-improvements.js',
  'tests/playwright/test-error-check.mjs',
  'tests/playwright/test-experimental-features.js',
  'tests/playwright/test-git-style-diagram.js',
  'tests/playwright/test-header-alignment.js',
  'tests/playwright/test-header-final-fix.js',
  'tests/playwright/test-header-fix.js',
  'tests/playwright/test-mobile-navigation.js',
  'tests/playwright/test-notification-badge-simple.js',
  'tests/playwright/test-notification-interactive.js',
  'tests/playwright/test-notification-overflow.js',
  'tests/playwright/test-quote-navigation.js',
  'tests/playwright/test-quote-post.js',
  'tests/playwright/test-refactoring-debug.mjs',
  'tests/playwright/test-refactoring.mjs',
  'tests/playwright/verify-hierarchy-improvements.mjs',
  'tests/playwright/test-thread-improvements.js',
  'tests/playwright/test-viewport-fit.js',
  'tests/playwright/test-share-functionality.js',
  'tests/playwright/test-thread-navigation-fix.js',
  'tests/playwright/test-thread-branch-improved.js',
  'tests/playwright/test-thread-branch-diagram.js',
  // Scripts directory
  'scripts/analyze-bluesky-official.mjs',
  'scripts/debug-notification-badge.cjs',
  'scripts/analyze-bluesky-remaining.mjs',
  'scripts/analyze-our-client.mjs',
  'scripts/test-like-final.mjs',
  'scripts/test-like-automated.mjs',
  'scripts/test-like-simple.mjs',
  'scripts/test-threads.mjs',
  'scripts/test-likes.mjs',
  'scripts/test-thread-lines.mjs',
  'scripts/test-app.mjs'
];

async function migrateFile(filePath) {
  try {
    const fullPath = path.join(path.dirname(__dirname), filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Check if file contains hardcoded credentials
    const hasHardcodedEmail = content.includes(HARDCODED_EMAIL);
    const hasHardcodedPassword = HARDCODED_PASSWORDS.some(pwd => content.includes(pwd));
    
    if (!hasHardcodedEmail && !hasHardcodedPassword) {
      return { path: filePath, status: 'skipped', reason: 'No hardcoded credentials found' };
    }

    // Check if already using getTestCredentials
    if (content.includes('getTestCredentials')) {
      return { path: filePath, status: 'skipped', reason: 'Already using getTestCredentials' };
    }

    let newContent = content;

    // Add import for getTestCredentials if not present
    const hasCredentialsImport = content.includes("from '../src/lib/test-credentials'") || 
                                 content.includes('from "./src/lib/test-credentials"') ||
                                 content.includes("require('./src/lib/test-credentials')");

    if (!hasCredentialsImport) {
      // Determine import style based on file extension and existing imports
      const isESM = filePath.endsWith('.mjs') || (filePath.endsWith('.js') && content.includes('import '));
      const isTS = filePath.endsWith('.ts');
      const isCJS = filePath.endsWith('.cjs');
      
      // Calculate relative path from file to test-credentials
      const fileDir = path.dirname(fullPath);
      const credentialsPath = path.join(path.dirname(__dirname), 'src/lib/test-credentials.js');
      let relativePath = path.relative(fileDir, credentialsPath);
      if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath;
      }
      
      if (isTS || isESM) {
        // Add import at the top after other imports
        const importMatch = content.match(/^(import[\s\S]*?(?:\n\n|\n(?!import)))/m);
        if (importMatch) {
          const imports = importMatch[1];
          newContent = content.replace(imports, imports + `import { getTestCredentials } from '${relativePath}';\n`);
        } else {
          newContent = `import { getTestCredentials } from '${relativePath}';\n\n` + content;
        }
      } else {
        // CommonJS require
        const requireMatch = content.match(/^((?:const|let|var)[\s\S]*?require[\s\S]*?(?:\n\n|\n(?!(?:const|let|var).*require)))/m);
        if (requireMatch) {
          const requires = requireMatch[1];
          newContent = content.replace(requires, requires + `const { getTestCredentials } = require('${relativePath}');\n`);
        } else {
          newContent = `const { getTestCredentials } = require('${relativePath}');\n\n` + content;
        }
      }
    }

    // Replace hardcoded credentials with getTestCredentials() call
    // Look for patterns like:
    // identifier: 'test-account+bsky@gmail.com'
    // password: 'N3wY0rkM3ts2024!'
    // TEST_USER = 'test-account+bsky@gmail.com'
    
    // First, add credentials variable if we're replacing
    const needsCredentialsVar = newContent.includes(HARDCODED_EMAIL) || 
      HARDCODED_PASSWORDS.some(pwd => newContent.includes(pwd));
    if (needsCredentialsVar && !newContent.includes('const credentials = getTestCredentials()')) {
      // Find a good place to add it - after imports but before first usage
      const emailIndex = newContent.indexOf(HARDCODED_EMAIL) !== -1 ? newContent.indexOf(HARDCODED_EMAIL) : Infinity;
      const passwordIndices = HARDCODED_PASSWORDS.map(pwd => 
        newContent.indexOf(pwd) !== -1 ? newContent.indexOf(pwd) : Infinity
      );
      const firstUsageIndex = Math.min(emailIndex, ...passwordIndices);
      
      // Find the line start before first usage
      const lineStart = newContent.lastIndexOf('\n', firstUsageIndex) + 1;
      
      // Insert the credentials call
      newContent = newContent.slice(0, lineStart) + 
                   'const credentials = getTestCredentials();\n\n' + 
                   newContent.slice(lineStart);
    }

    // Replace patterns
    newContent = newContent
      // Replace object properties
      .replace(/identifier:\s*['"`]test-account\+bsky@gmail\.com['"`]/g, 'identifier: credentials.identifier')
      // Replace variable assignments
      .replace(/TEST_USER\s*=\s*['"`]test-account\+bsky@gmail\.com['"`]/g, 'TEST_USER = credentials.identifier')
      // Replace in template literals
      .replace(/\$\{['"`]test-account\+bsky@gmail\.com['"`]\}/g, '${credentials.identifier}')
      // Replace direct string usage
      .replace(/(['"`])test-account\+bsky@gmail\.com\1/g, 'credentials.identifier');
      
    // Replace all password patterns
    for (const password of HARDCODED_PASSWORDS) {
      // Escape special regex characters in password
      const escapedPassword = password.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      newContent = newContent
        // Replace object properties
        .replace(new RegExp(`password:\\s*['"\`]${escapedPassword}['"\`]`, 'g'), 'password: credentials.password')
        // Replace variable assignments
        .replace(new RegExp(`TEST_PASS\\s*=\\s*['"\`]${escapedPassword}['"\`]`, 'g'), 'TEST_PASS = credentials.password')
        // Replace in template literals
        .replace(new RegExp(`\\$\\{['"\`]${escapedPassword}['"\`]\\}`, 'g'), '${credentials.password}')
        // Replace direct string usage
        .replace(new RegExp(`(['"\`])${escapedPassword}\\1`, 'g'), 'credentials.password');
    }

    // Write the updated file
    await fs.writeFile(fullPath, newContent, 'utf-8');
    
    return { path: filePath, status: 'migrated' };
  } catch (error) {
    return { path: filePath, status: 'error', error: error.message };
  }
}

async function main() {
  console.log('🔐 Migrating hardcoded test credentials...\n');
  
  const results = {
    migrated: [],
    skipped: [],
    errors: []
  };

  for (const file of TEST_FILES) {
    const result = await migrateFile(file);
    
    switch (result.status) {
      case 'migrated':
        results.migrated.push(result.path);
        console.log(`✅ Migrated: ${result.path}`);
        break;
      case 'skipped':
        results.skipped.push(result);
        console.log(`⏭️  Skipped: ${result.path} (${result.reason})`);
        break;
      case 'error':
        results.errors.push(result);
        console.log(`❌ Error: ${result.path} - ${result.error}`);
        break;
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`   Migrated: ${results.migrated.length} files`);
  console.log(`   Skipped: ${results.skipped.length} files`);
  console.log(`   Errors: ${results.errors.length} files`);

  if (results.migrated.length > 0) {
    console.log('\n✅ Successfully migrated files:');
    results.migrated.forEach(file => console.log(`   - ${file}`));
  }

  if (results.errors.length > 0) {
    console.log('\n❌ Files with errors:');
    results.errors.forEach(result => console.log(`   - ${result.path}: ${result.error}`));
    process.exit(1);
  }

  console.log('\n🎉 Migration complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Create .env.local with test credentials:');
  console.log('   VITE_TEST_IDENTIFIER=your-test-account@email.com');
  console.log('   VITE_TEST_PASSWORD=your-test-password');
  console.log('2. Run tests to verify everything works');
  console.log('3. Commit the changes');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});