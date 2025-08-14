#!/usr/bin/env node

/**
 * Script to help identify and migrate console statements to the logger utility
 * 
 * Usage:
 * node scripts/migrate-console-logs.js [--dry-run] [--exclude-tests]
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const excludeTests = args.includes('--exclude-tests');

// Patterns to find console statements
const consolePatterns = [
  'console\\.log',
  'console\\.error',
  'console\\.warn',
  'console\\.info',
  'console\\.debug'
];

// Files/directories to exclude
const excludePatterns = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  'scripts/migrate-console-logs.js',
  'src/shared/debug.ts',
  'src/utils/logger.ts',
  'src/utils/debug-control.ts'
];

if (excludeTests) {
  excludePatterns.push('tests/', '.test.', '.spec.');
}

// Build find and grep command
const excludeArgs = excludePatterns.map(p => `-not -path "*${p}*"`).join(' ');
const grepPattern = consolePatterns.join('\\|');
const findCommand = `find . -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \\) ${excludeArgs} -exec grep -Hn "${grepPattern}" {} \\;`;

console.log('🔍 Searching for console statements...\n');

try {
  const output = execSync(findCommand, { encoding: 'utf-8' });
  const lines = output.trim().split('\n');
  
  // Group by file
  const fileGroups = {};
  lines.forEach(line => {
    const [filePath, ...rest] = line.split(':');
    if (!fileGroups[filePath]) {
      fileGroups[filePath] = [];
    }
    fileGroups[filePath].push(line);
  });

  // Summary
  const totalFiles = Object.keys(fileGroups).length;
  const totalOccurrences = lines.length;

  console.log(`Found ${totalOccurrences} console statements in ${totalFiles} files:\n`);

  // Show files with most console statements first
  const sortedFiles = Object.entries(fileGroups)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 20); // Show top 20 files

  sortedFiles.forEach(([file, occurrences]) => {
    console.log(`\n📄 ${file} (${occurrences.length} occurrences):`);
    occurrences.slice(0, 5).forEach(line => {
      const parts = line.split(':');
      const lineNum = parts[1];
      const content = parts.slice(2).join(':').trim();
      console.log(`   Line ${lineNum}: ${content.substring(0, 80)}${content.length > 80 ? '...' : ''}`);
    });
    if (occurrences.length > 5) {
      console.log(`   ... and ${occurrences.length - 5} more`);
    }
  });

  if (Object.keys(fileGroups).length > 20) {
    console.log(`\n... and ${Object.keys(fileGroups).length - 20} more files`);
  }

  // Suggestions
  console.log('\n\n✨ Migration suggestions:\n');
  console.log('1. For component files, add at the top:');
  console.log('   import { createLogger } from "@/utils/logger";');
  console.log('   const logger = createLogger("ComponentName");\n');
  
  console.log('2. Replace console statements:');
  console.log('   console.log(...) → logger.log(...)');
  console.log('   console.error(...) → logger.error(...)');
  console.log('   console.warn(...) → logger.warn(...)');
  console.log('   console.info(...) → logger.info(...)\n');

  console.log('3. For service files, use:');
  console.log('   const logger = createLogger("ServiceName");\n');

  console.log('4. In production, only errors will be logged unless debug mode is enabled.');
  console.log('   Enable debug: localStorage.setItem("debug", "true") or add ?debug=true to URL\n');

} catch (error) {
  if (error.status === 1) {
    console.log('✅ No console statements found! Your code is clean.');
  } else {
    console.error('Error running search:', error.message);
  }
}