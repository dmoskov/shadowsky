/**
 * Migration utilities for moving data from localStorage to IndexedDB
 */

import { feedStorage } from './feed-storage'
import { notificationStorage } from './notification-storage'
import { debug } from '@bsky/shared'

export interface MigrationResult {
  success: boolean
  migratedItems: number
  errors: string[]
}

/**
 * Migrate conversation cache from localStorage to IndexedDB
 */
export async function migrateConversationCache(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedItems: 0,
    errors: []
  }
  
  try {
    // Look for conversation cache keys
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('conversation_cache_') || 
      key.startsWith('conversation_')
    )
    
    if (keys.length === 0) {
      result.success = true
      return result
    }
    
    await feedStorage.init()
    
    for (const key of keys) {
      try {
        const data = localStorage.getItem(key)
        if (!data) continue
        
        const parsed = JSON.parse(data)
        
        // Handle different cache formats
        if (parsed.messages && Array.isArray(parsed.messages)) {
          // This is a conversation with messages
          // For now, we'll skip these as they need a different storage strategy
          debug.log(`Skipping conversation cache: ${key}`)
        } else if (parsed.posts && Array.isArray(parsed.posts)) {
          // This looks like posts data
          await feedStorage.savePosts(parsed.posts)
          result.migratedItems += parsed.posts.length
          
          // Remove from localStorage after successful migration
          localStorage.removeItem(key)
        }
      } catch (err) {
        result.errors.push(`Failed to migrate ${key}: ${err.message}`)
      }
    }
    
    result.success = result.errors.length === 0
  } catch (err) {
    result.errors.push(`Migration failed: ${err.message}`)
  }
  
  return result
}

/**
 * Migrate notification posts from localStorage to IndexedDB
 */
export async function migrateNotificationPosts(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedItems: 0,
    errors: []
  }
  
  try {
    const keys = Object.keys(localStorage).filter(key => 
      key.includes('notification') && key.includes('post')
    )
    
    if (keys.length === 0) {
      result.success = true
      return result
    }
    
    await feedStorage.init()
    
    for (const key of keys) {
      try {
        const data = localStorage.getItem(key)
        if (!data) continue
        
        const parsed = JSON.parse(data)
        
        // Handle different formats
        if (parsed.posts && typeof parsed.posts === 'object') {
          // Convert object to array
          const posts = Object.values(parsed.posts)
          if (posts.length > 0) {
            await feedStorage.savePosts(posts as any[])
            result.migratedItems += posts.length
          }
        } else if (Array.isArray(parsed)) {
          // Direct array of posts
          await feedStorage.savePosts(parsed)
          result.migratedItems += parsed.length
        }
        
        // Remove from localStorage after successful migration
        localStorage.removeItem(key)
      } catch (err) {
        result.errors.push(`Failed to migrate ${key}: ${err.message}`)
      }
    }
    
    result.success = result.errors.length === 0
  } catch (err) {
    result.errors.push(`Migration failed: ${err.message}`)
  }
  
  return result
}

/**
 * Run all migrations
 */
export async function runAllMigrations(): Promise<{
  conversations: MigrationResult
  notificationPosts: MigrationResult
}> {
  const results = {
    conversations: await migrateConversationCache(),
    notificationPosts: await migrateNotificationPosts()
  }
  
  const totalMigrated = results.conversations.migratedItems + results.notificationPosts.migratedItems
  const totalErrors = results.conversations.errors.length + results.notificationPosts.errors.length
  
  debug.log(`Migration complete: ${totalMigrated} items migrated, ${totalErrors} errors`)
  
  if (totalErrors > 0) {
    debug.error('Migration errors:', {
      conversations: results.conversations.errors,
      notificationPosts: results.notificationPosts.errors
    })
  }
  
  return results
}

/**
 * Clean up old localStorage data (call after successful migration)
 */
export function cleanupLocalStorage(): void {
  const keysToRemove = Object.keys(localStorage).filter(key => 
    key.includes('cache') || 
    key.includes('conversation') ||
    (key.includes('notification') && key.includes('post')) ||
    key.includes('bsky_extended_fetch')
  )
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key)
  })
  
  debug.log(`Cleaned up ${keysToRemove.length} localStorage keys`)
}