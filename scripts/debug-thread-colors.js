// Debug script to check thread background colors
// Run this in the browser console when viewing a thread

console.log('🎨 Debugging Thread Background Colors...\n');

// Check the color values
const colors = {
  'gray-950': '#020617',
  'gray-900': '#0F172A',
  'gray-800': '#1E293B'
};

console.log('Color reference:');
Object.entries(colors).forEach(([name, hex]) => {
  console.log(`%c ${name}: ${hex}`, `background: ${hex}; color: white; padding: 2px 5px;`);
});

console.log('\n📋 Checking elements...\n');

// Check main app container
const appContainer = document.querySelector('.min-h-screen.bg-gray-950');
if (appContainer) {
  const bg = window.getComputedStyle(appContainer).backgroundColor;
  console.log('App container background:', bg);
}

// Check thread view container
const threadContainers = document.querySelectorAll('[class*="bg-gray"]');
console.log(`Found ${threadContainers.length} elements with gray backgrounds:`);

threadContainers.forEach((el, i) => {
  const bg = window.getComputedStyle(el).backgroundColor;
  const classes = el.className;
  console.log(`${i + 1}. Background: ${bg}`);
  console.log(`   Classes: ${classes}`);
  console.log(`   Element: `, el);
});

// Check for any elements with inline styles
const inlineStyleElements = document.querySelectorAll('[style*="background"]');
if (inlineStyleElements.length > 0) {
  console.log(`\n⚠️ Found ${inlineStyleElements.length} elements with inline background styles`);
}

console.log('\n💡 To fix: Ensure all containers use bg-gray-950 (#020617)');