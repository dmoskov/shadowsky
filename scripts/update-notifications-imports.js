#!/usr/bin/env node
/**
 * Script to update imports in notifications app to use the shared package
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const mappings = {
  // Services - update specific service imports
  './services/atproto/client': '@bsky/shared/services/atproto/client',
  '../services/atproto/client': '@bsky/shared/services/atproto/client',
  '../../services/atproto/client': '@bsky/shared/services/atproto/client',
  
  './services/atproto/feed': '@bsky/shared/services/atproto/feed',
  '../services/atproto/feed': '@bsky/shared/services/atproto/feed',
  '../../services/atproto/feed': '@bsky/shared/services/atproto/feed',
  
  './services/atproto/interactions': '@bsky/shared/services/atproto/interactions',
  '../services/atproto/interactions': '@bsky/shared/services/atproto/interactions',
  '../../services/atproto/interactions': '@bsky/shared/services/atproto/interactions',
  
  './services/atproto/profile': '@bsky/shared/services/atproto/profile',
  '../services/atproto/profile': '@bsky/shared/services/atproto/profile',
  '../../services/atproto/profile': '@bsky/shared/services/atproto/profile',
  
  './services/atproto/search': '@bsky/shared/services/atproto/search',
  '../services/atproto/search': '@bsky/shared/services/atproto/search',
  '../../services/atproto/search': '@bsky/shared/services/atproto/search',
  
  './services/atproto/thread': '@bsky/shared/services/atproto/thread',
  '../services/atproto/thread': '@bsky/shared/services/atproto/thread',
  '../../services/atproto/thread': '@bsky/shared/services/atproto/thread',
  
  './services/atproto/analytics': '@bsky/shared/services/atproto/analytics',
  '../services/atproto/analytics': '@bsky/shared/services/atproto/analytics',
  '../../services/atproto/analytics': '@bsky/shared/services/atproto/analytics',
  
  // Lib
  './lib/errors': '@bsky/shared/lib/errors',
  '../lib/errors': '@bsky/shared/lib/errors',
  '../../lib/errors': '@bsky/shared/lib/errors',
  
  './lib/cookies': '@bsky/shared/lib/cookies',
  '../lib/cookies': '@bsky/shared/lib/cookies',
  '../../lib/cookies': '@bsky/shared/lib/cookies',
  
  './lib/query-client': '@bsky/shared/lib/query-client',
  '../lib/query-client': '@bsky/shared/lib/query-client',
  '../../lib/query-client': '@bsky/shared/lib/query-client',
  
  './lib/rate-limiter': '@bsky/shared/lib/rate-limiter',
  '../lib/rate-limiter': '@bsky/shared/lib/rate-limiter',
  '../../lib/rate-limiter': '@bsky/shared/lib/rate-limiter',
  
  './lib/request-deduplication': '@bsky/shared/lib/request-deduplication',
  '../lib/request-deduplication': '@bsky/shared/lib/request-deduplication',
  '../../lib/request-deduplication': '@bsky/shared/lib/request-deduplication',
  
  './lib/performance-tracking': '@bsky/shared/lib/performance-tracking',
  '../lib/performance-tracking': '@bsky/shared/lib/performance-tracking',
  '../../lib/performance-tracking': '@bsky/shared/lib/performance-tracking',
  
  './lib/error-tracking': '@bsky/shared/lib/error-tracking',
  '../lib/error-tracking': '@bsky/shared/lib/error-tracking',
  '../../lib/error-tracking': '@bsky/shared/lib/error-tracking',
  
  // Types
  './types/atproto': '@bsky/shared/types/atproto',
  '../types/atproto': '@bsky/shared/types/atproto',
  '../../types/atproto': '@bsky/shared/types/atproto',
}

async function updateImportsInFile(filePath) {
  try {
    let content = await readFile(filePath, 'utf-8')
    let modified = false
    
    for (const [oldPath, newPath] of Object.entries(mappings)) {
      const regex = new RegExp(`from ['"]${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g')
      if (regex.test(content)) {
        content = content.replace(regex, `from '${newPath}'`)
        modified = true
      }
    }
    
    if (modified) {
      await writeFile(filePath, content)
      console.log(`Updated imports in: ${filePath}`)
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message)
  }
}

async function* walkDir(dir) {
  const files = await readdir(dir, { withFileTypes: true })
  
  for (const file of files) {
    const path = join(dir, file.name)
    
    if (file.isDirectory()) {
      if (file.name !== 'node_modules' && file.name !== 'dist' && file.name !== 'coverage') {
        yield* walkDir(path)
      }
    } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
      yield path
    }
  }
}

async function main() {
  const srcDir = join(dirname(__dirname), 'notifications-app', 'src')
  
  console.log('Updating imports in notifications app to use @bsky/shared package...')
  
  for await (const filePath of walkDir(srcDir)) {
    await updateImportsInFile(filePath)
  }
  
  console.log('Import updates complete!')
}

main().catch(console.error)