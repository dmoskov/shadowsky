#!/usr/bin/env node

/**
 * Development error checker
 * Monitors Vite output for common errors and provides suggestions
 */

import fs from 'fs';
import path from 'path';

const LOG_FILE = '/tmp/vite-output.log';
const ERROR_PATTERNS = [
  {
    pattern: /ReferenceError: (\w+) is not defined/,
    message: (match) => `Missing import: ${match[1]} is not defined. Check imports.`,
    severity: 'error'
  },
  {
    pattern: /Adjacent JSX elements must be wrapped/,
    message: () => 'JSX elements need a parent wrapper. Use <> </> or a <div>.',
    severity: 'error'
  },
  {
    pattern: /Cannot find module '(.+)'/,
    message: (match) => `Module not found: ${match[1]}. Run npm install or check the import path.`,
    severity: 'error'
  },
  {
    pattern: /@import must precede all other statements/,
    message: () => 'CSS @import must be at the top of the file.',
    severity: 'warning'
  },
  {
    pattern: /TypeScript error in (.+):\n(.+)/,
    message: (match) => `TypeScript error in ${match[1]}: ${match[2]}`,
    severity: 'error'
  }
];

function checkErrors() {
  if (!fs.existsSync(LOG_FILE)) {
    console.log('No Vite log file found. Is the dev server running?');
    return;
  }

  const log = fs.readFileSync(LOG_FILE, 'utf8');
  const lines = log.split('\n').slice(-100); // Check last 100 lines
  
  const errors = [];
  
  lines.forEach(line => {
    ERROR_PATTERNS.forEach(({ pattern, message, severity }) => {
      const match = line.match(pattern);
      if (match) {
        errors.push({
          severity,
          message: message(match),
          line
        });
      }
    });
  });

  if (errors.length > 0) {
    console.log('\n🚨 Development Errors Detected:\n');
    errors.forEach(({ severity, message }) => {
      const icon = severity === 'error' ? '❌' : '⚠️';
      console.log(`${icon} ${message}`);
    });
    console.log('\n');
    process.exit(1);
  } else {
    console.log('✅ No errors detected in Vite output');
  }
}

// Run the check
checkErrors();