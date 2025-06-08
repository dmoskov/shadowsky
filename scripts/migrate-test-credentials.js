#!/usr/bin/env node

/**
 * Migration script to update all test files to use secure credentials
 * Run with: node scripts/migrate-test-credentials.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Files to migrate
const TEST_PATTERNS = [
  'tests/**/*.js',
  'tests/**/*.mjs',
  'tests/**/*.ts',
  'scripts/test-*.js',
  'scripts/test-*.mjs'
];

// Pattern to find credential usage
const CREDENTIAL_PATTERNS = [
  /\.test-credentials/g,
  /TEST_USER=/g,
  /TEST_PASS=/g,
  /readFile.*test-credentials/g,
  /readFileSync.*test-credentials/g
];

async function findTestFiles() {
  const { globby } = await import('globby');
  const files = await globby(TEST_PATTERNS, {
    cwd: path.join(__dirname, '..'),
    absolute: true
  });
  return files;
}

async function analyzeFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const issues = [];
  
  for (const pattern of CREDENTIAL_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      issues.push({
        pattern: pattern.source,
        count: matches.length,
        matches
      });
    }
  }
  
  return issues.length > 0 ? { filePath, issues, content } : null;
}

async function generateMigrationPlan(file) {
  const { filePath, content } = file;
  const fileName = path.basename(filePath);
  
  // Check if it already imports the helper
  if (content.includes('helpers/credentials')) {
    return { filePath, status: 'already_migrated' };
  }
  
  // Generate migration steps
  const steps = [];
  
  if (content.includes('.test-credentials')) {
    steps.push('Replace .test-credentials file reading with getTestCredentials()');
  }
  
  if (content.includes('TEST_USER=') || content.includes('TEST_PASS=')) {
    steps.push('Update credential parsing to use helper function');
  }
  
  return {
    filePath,
    fileName,
    status: 'needs_migration',
    steps
  };
}

async function main() {
  console.log('🔍 Scanning for test files using hardcoded credentials...\n');
  
  try {
    // Find all test files
    const files = await findTestFiles();
    console.log(`Found ${files.length} test files to analyze\n`);
    
    // Analyze each file
    const filesWithIssues = [];
    for (const file of files) {
      const result = await analyzeFile(file);
      if (result) {
        filesWithIssues.push(result);
      }
    }
    
    if (filesWithIssues.length === 0) {
      console.log('✅ No hardcoded credentials found! All files are clean.\n');
      return;
    }
    
    console.log(`⚠️  Found ${filesWithIssues.length} files with credential issues:\n`);
    
    // Generate migration plan
    const migrationPlan = [];
    for (const file of filesWithIssues) {
      const plan = await generateMigrationPlan(file);
      migrationPlan.push(plan);
      
      console.log(`📄 ${plan.fileName}`);
      console.log(`   Status: ${plan.status}`);
      if (plan.steps) {
        plan.steps.forEach(step => console.log(`   - ${step}`));
      }
      console.log();
    }
    
    // Create migration report
    const report = {
      date: new Date().toISOString(),
      totalFiles: files.length,
      filesWithIssues: filesWithIssues.length,
      migrationPlan: migrationPlan.map(p => ({
        file: path.relative(path.join(__dirname, '..'), p.filePath),
        status: p.status,
        steps: p.steps || []
      }))
    };
    
    const reportPath = path.join(__dirname, '..', 'CREDENTIAL_MIGRATION_REPORT.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n📊 Migration report saved to: CREDENTIAL_MIGRATION_REPORT.json`);
    console.log('\nNext steps:');
    console.log('1. Review the migration report');
    console.log('2. Update each file to use getTestCredentials() from helpers/credentials.js');
    console.log('3. Test each migrated file to ensure it works');
    console.log('4. Remove the legacy .test-credentials file when complete');
    
  } catch (error) {
    console.error('❌ Error during migration analysis:', error);
    process.exit(1);
  }
}

// Check if globby is installed
try {
  await import('globby');
} catch {
  console.log('📦 Installing globby for file scanning...');
  const { execSync } = await import('child_process');
  execSync('npm install -D globby', { stdio: 'inherit' });
}

main();