#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Patterns to match console.log calls
const consolePatterns = [
  /console\.log\(/g,
  /console\.error\(/g,
  /console\.warn\(/g,
  /console\.info\(/g,
  /console\.group\(/g,
  /console\.groupEnd\(/g,
  /console\.time\(/g,
  /console\.timeEnd\(/g,
  /console\.table\(/g,
];

// Map console methods to debug methods
const methodMap = {
  'console.log': 'debug.log',
  'console.error': 'debug.error',
  'console.warn': 'debug.warn',
  'console.info': 'debug.info',
  'console.group': 'debug.group',
  'console.groupEnd': 'debug.groupEnd',
  'console.time': 'debug.time',
  'console.timeEnd': 'debug.timeEnd',
  'console.table': 'debug.table',
};

// Files/directories to skip
const skipPatterns = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/scripts/**',
  '**/tests/**',
  '**/docs/**',
  '**/*.md',
  '**/debug.ts', // Don't modify our debug utility itself
];

// Directories to process
const directories = [
  'src',
  'notifications-app/src',
  'packages/shared/src'
];

function shouldProcessFile(filePath) {
  // Check if file should be skipped
  for (const pattern of skipPatterns) {
    if (filePath.includes(pattern.replace(/\*/g, ''))) {
      return false;
    }
  }
  
  // Only process TypeScript/JavaScript files
  const ext = path.extname(filePath);
  return ['.ts', '.tsx', '.js', '.jsx'].includes(ext);
}

function addDebugImport(content, filePath) {
  // Check if debug is already imported
  if (content.includes('debug') && content.includes('@bsky/shared')) {
    return content;
  }
  
  // Check if file already has imports from @bsky/shared
  const sharedImportMatch = content.match(/import\s*{([^}]+)}\s*from\s*['"]@bsky\/shared['"]/);
  
  if (sharedImportMatch) {
    // Add debug to existing import
    const imports = sharedImportMatch[1];
    if (!imports.includes('debug')) {
      const newImports = imports.trim() + ', debug';
      return content.replace(sharedImportMatch[0], `import { ${newImports} } from '@bsky/shared'`);
    }
  } else {
    // Add new import statement
    // Find the last import statement
    const importMatches = content.match(/import[\s\S]+?from\s+['"][^'"]+['"]/g);
    if (importMatches && importMatches.length > 0) {
      const lastImport = importMatches[importMatches.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertIndex = lastImportIndex + lastImport.length;
      return content.slice(0, insertIndex) + "\nimport { debug } from '@bsky/shared'" + content.slice(insertIndex);
    } else {
      // No imports found, add at the beginning
      return "import { debug } from '@bsky/shared'\n\n" + content;
    }
  }
  
  return content;
}

function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // Check if file contains any console calls
    let hasConsoleCall = false;
    for (const [consoleMethod, debugMethod] of Object.entries(methodMap)) {
      if (content.includes(consoleMethod + '(')) {
        hasConsoleCall = true;
        break;
      }
    }
    
    if (!hasConsoleCall) {
      return false;
    }
    
    // Replace console calls with debug calls
    for (const [consoleMethod, debugMethod] of Object.entries(methodMap)) {
      const regex = new RegExp(`\\b${consoleMethod.replace('.', '\\.')}\\(`, 'g');
      if (regex.test(content)) {
        content = content.replace(regex, `${debugMethod}(`);
        modified = true;
      }
    }
    
    if (modified) {
      // Add debug import if needed
      content = addDebugImport(content, filePath);
      
      // Write the modified content back
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Processed: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🔍 Searching for console.log calls to replace with debug wrapper...\n');
  
  let totalFiles = 0;
  let modifiedFiles = 0;
  
  for (const dir of directories) {
    const pattern = path.join(dir, '**/*');
    const files = glob.sync(pattern, { nodir: true });
    
    for (const file of files) {
      if (shouldProcessFile(file)) {
        totalFiles++;
        if (processFile(file)) {
          modifiedFiles++;
        }
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Total files scanned: ${totalFiles}`);
  console.log(`   Files modified: ${modifiedFiles}`);
  console.log('\n✨ Done! Console calls have been wrapped with debug utility.');
  console.log('💡 To enable debug logs, run: localStorage.setItem("debug", "true")');
}

// Run the script
main();