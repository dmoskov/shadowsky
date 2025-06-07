const fs = require('fs');
const path = require('path');

// Color mappings from hard-coded to CSS variables
const colorMappings = {
  // Direct replacements
  '#1a8cd8': 'var(--blue-600)',
  'rgba(29, 155, 240, 0.3)': 'rgba(59, 130, 246, 0.3)',
  '#e63946': 'var(--red-600)',
  'rgba(255, 59, 48, 0.3)': 'var(--color-error-bg)',
  'rgba(20, 24, 36, 0.7)': 'var(--color-glass-bg)',
  'rgba(255, 255, 255, 0.1)': 'var(--color-border)',
  'rgba(0, 0, 0, 0.5)': 'var(--color-backdrop)',
  'rgba(0, 0, 0, 0.15)': 'var(--shadow-color)',
  'rgba(10, 14, 27, 0.95)': 'var(--color-bg-primary)',
  'rgba(0, 0, 0, 0.4)': 'var(--shadow-color)',
  'rgba(255, 68, 68, 0.1)': 'var(--color-error-bg)',
  'rgba(0, 0, 0, 0.1)': 'var(--shadow-color)',
  'rgba(59, 130, 246, 0.3)': 'rgba(var(--blue-500-rgb), 0.3)',
  'rgba(59, 130, 246, 0.4)': 'rgba(var(--blue-500-rgb), 0.4)',
  
  // Notification colors
  '#e0245e': 'var(--color-notification-like)',
  '#17bf63': 'var(--color-notification-repost)',
  '#1da1f2': 'var(--color-notification-mention)',
  '#794bc4': 'var(--color-notification-reply)',
  '#f7931a': 'var(--color-notification-quote)',
  
  // Deprecated
  'var(--danger-color)': 'var(--color-error)',
};

// Files to process
const cssFiles = [
  'src/styles/components.css',
  'src/styles/header.css',
  'src/styles/post-card.css',
  'src/styles/sidebar.css',
  'src/styles/compose.css',
  'src/styles/notifications.css',
  'src/styles/profile.css',
  'src/styles/search.css',
];

console.log('🎨 Starting color migration...\n');

cssFiles.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  Skipping ${filePath} (file not found)`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let changes = 0;
  
  // Apply color mappings
  Object.entries(colorMappings).forEach(([oldColor, newColor]) => {
    const regex = new RegExp(oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches) {
      content = content.replace(regex, newColor);
      changes += matches.length;
    }
  });
  
  if (changes > 0) {
    fs.writeFileSync(fullPath, content);
    console.log(`✅ ${filePath}: Updated ${changes} color references`);
  } else {
    console.log(`   ${filePath}: No changes needed`);
  }
});

console.log('\n✨ Color migration complete!');
console.log('\nNext steps:');
console.log('1. Review the changes with git diff');
console.log('2. Test the application to ensure colors look correct');
console.log('3. Update any remaining hard-coded "white" values where appropriate');
console.log('4. Consider implementing theme switching functionality');