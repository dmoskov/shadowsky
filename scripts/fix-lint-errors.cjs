#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧹 Fixing ESLint errors...\n');

// Run ESLint with JSON output to get all errors
let eslintOutput;
try {
  eslintOutput = execSync('npx eslint . --format json', { 
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'ignore'] // Ignore stderr
  });
} catch (e) {
  // ESLint exits with error code when there are lint errors
  eslintOutput = e.stdout;
}

const results = JSON.parse(eslintOutput);
const errorsByFile = {};

// Group errors by file
results.forEach(file => {
  if (file.errorCount > 0 || file.warningCount > 0) {
    errorsByFile[file.filePath] = file.messages;
  }
});

// Count error types
const errorCounts = {};
Object.values(errorsByFile).flat().forEach(error => {
  const key = error.ruleId || 'unknown';
  errorCounts[key] = (errorCounts[key] || 0) + 1;
});

console.log('Error summary:');
Object.entries(errorCounts)
  .sort((a, b) => b[1] - a[1])
  .forEach(([rule, count]) => {
    console.log(`  ${rule}: ${count}`);
  });

console.log('\nFixing unused imports and variables...\n');

// Process each file
Object.entries(errorsByFile).forEach(([filePath, errors]) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Group errors by line
  const errorsByLine = {};
  errors.forEach(error => {
    if (!errorsByLine[error.line]) {
      errorsByLine[error.line] = [];
    }
    errorsByLine[error.line].push(error);
  });
  
  // Process errors in reverse line order to maintain line numbers
  const lines = content.split('\n');
  const lineNumbers = Object.keys(errorsByLine).map(n => parseInt(n)).sort((a, b) => b - a);
  
  lineNumbers.forEach(lineNum => {
    const lineErrors = errorsByLine[lineNum];
    const line = lines[lineNum - 1];
    
    lineErrors.forEach(error => {
      if (error.ruleId === '@typescript-eslint/no-unused-vars') {
        // Handle unused imports
        if (line.includes('import')) {
          // Check if it's a type import that's actually used
          const importMatch = line.match(/import\s+(?:type\s+)?{([^}]+)}\s+from/);
          if (importMatch) {
            const imports = importMatch[1].split(',').map(i => i.trim());
            const unusedImport = imports.find(imp => imp.includes(error.source.substring(1, error.source.length - 1)));
            
            if (unusedImport) {
              const newImports = imports.filter(imp => !imp.includes(unusedImport));
              if (newImports.length === 0) {
                // Remove entire import line
                lines[lineNum - 1] = '';
                modified = true;
              } else {
                // Remove just the unused import
                const newImportList = newImports.join(', ');
                lines[lineNum - 1] = line.replace(importMatch[1], newImportList);
                modified = true;
              }
            }
          } else if (line.match(/import\s+\w+\s+from/)) {
            // Default import - comment out for safety
            lines[lineNum - 1] = '// ' + line;
            modified = true;
          }
        }
      }
    });
  });
  
  if (modified) {
    // Clean up empty lines from removed imports
    const cleanedContent = lines
      .filter((line, idx) => {
        // Keep line if it's not empty or if previous/next line isn't empty
        return line.trim() !== '' || 
               (idx > 0 && lines[idx - 1].trim() !== '') ||
               (idx < lines.length - 1 && lines[idx + 1].trim() !== '');
      })
      .join('\n');
    
    fs.writeFileSync(filePath, cleanedContent);
    console.log(`✅ Fixed ${path.relative(process.cwd(), filePath)}`);
  }
});

console.log('\n🎯 Running ESLint again to check remaining errors...\n');

// Run ESLint again to see what's left
try {
  execSync('npm run lint', { stdio: 'inherit' });
  console.log('\n✨ All ESLint errors fixed!');
} catch (e) {
  console.log('\n⚠️  Some ESLint errors remain. Run "npm run lint" to see details.');
}