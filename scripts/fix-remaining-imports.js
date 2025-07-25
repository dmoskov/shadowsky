#!/usr/bin/env node
/**
 * Script to fix remaining relative imports for analytics
 */

import { readdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function updateImportsInFile(filePath) {
  try {
    let content = await readFile(filePath, 'utf-8')
    let modified = false
    
    // Fix analytics imports
    const analyticsPatterns = [
      { from: /from\s+['"]\.\.\/\.\.\/services\/atproto\/analytics['"]/g, to: `from '@bsky/shared'` },
      { from: /from\s+['"]\.\.\/services\/atproto\/analytics['"]/g, to: `from '@bsky/shared'` },
      { from: /from\s+['"]\.\/analytics['"]/g, to: `from '@bsky/shared'` },
    ]
    
    for (const pattern of analyticsPatterns) {
      if (pattern.from.test(content)) {
        content = content.replace(pattern.from, pattern.to)
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
      if (file.name !== 'node_modules' && file.name !== 'dist' && file.name !== 'coverage' && file.name !== '.git') {
        yield* walkDir(path)
      }
    } else if (file.name.endsWith('.ts') || file.name.endsWith('.tsx')) {
      yield path
    }
  }
}

async function main() {
  const rootDir = dirname(__dirname)
  const srcDir = join(rootDir, 'src')
  
  console.log('Fixing remaining relative imports...')
  
  for await (const filePath of walkDir(srcDir)) {
    await updateImportsInFile(filePath)
  }
  
  console.log('\nImport fixes complete!')
}

main().catch(console.error)