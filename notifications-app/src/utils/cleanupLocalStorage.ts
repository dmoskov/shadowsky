/**
 * Utility to clean up old localStorage data after migration to IndexedDB
 * This should be run after successful migration
 */
export function cleanupLocalStorage() {
  const keysToRemove = [
    'bsky_extended_fetch_data_v1',
    'bsky_extended_fetch_metadata_v1',
    // Add any other notification-related keys here
  ]
  
  let removedCount = 0
  
  // Also check for any other notification-related keys
  const allKeys = Object.keys(localStorage)
  allKeys.forEach(key => {
    if (
      key.includes('notification') || 
      key.includes('bsky_extended') ||
      key.includes('bsky_notification')
    ) {
      if (!keysToRemove.includes(key)) {
        keysToRemove.push(key)
      }
    }
  })
  
  // Remove all identified keys
  keysToRemove.forEach(key => {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key)
      console.log(`🧹 Removed ${key} from localStorage`)
      removedCount++
    }
  })
  
  if (removedCount > 0) {
    console.log(`✅ Cleaned up ${removedCount} localStorage keys`)
  } else {
    console.log('ℹ️ No localStorage keys to clean up')
  }
  
  return removedCount
}