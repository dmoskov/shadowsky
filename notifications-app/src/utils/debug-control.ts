import { enableDebug, disableDebug } from '@bsky/shared'

// Export functions to global window object for easy console access
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.enableDebug = () => {
    enableDebug();
    console.log('✅ Debug mode enabled. Refresh the page to see debug logs.');
  };
  
  // @ts-ignore
  window.disableDebug = () => {
    disableDebug();
    console.log('❌ Debug mode disabled. Refresh the page to hide debug logs.');
  };
  
  // @ts-ignore
  window.toggleDebug = () => {
    const currentState = localStorage.getItem('debug') === 'true';
    if (currentState) {
      disableDebug();
      console.log('❌ Debug mode disabled. Refresh the page to hide debug logs.');
    } else {
      enableDebug();
      console.log('✅ Debug mode enabled. Refresh the page to see debug logs.');
    }
  };
  
  // Log instructions on load
  if (localStorage.getItem('debug') === 'true') {
    console.log('🐛 Debug mode is currently ENABLED');
    console.log('   To disable: window.disableDebug()');
  } else {
    console.log('🔇 Debug mode is currently DISABLED');
    console.log('   To enable: window.enableDebug()');
  }
  console.log('   To toggle: window.toggleDebug()');
}