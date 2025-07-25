#!/usr/bin/env node
/**
 * Script to fix imports from @bsky/shared package
 * Updates deep imports to use the root export
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
    
    // Pattern to match deep imports from @bsky/shared
    const deepImportRegex = /from\s+['"]@bsky\/shared\/[^'"]+['"]/g
    
    // Replace all deep imports with root import
    const matches = content.match(deepImportRegex)
    if (matches) {
      content = content.replace(deepImportRegex, `from '@bsky/shared'`)
      modified = true
    }
    
    if (modified) {
      await writeFile(filePath, content)
      console.log(`Updated imports in: ${filePath}`)
      if (matches) {
        console.log(`  Fixed ${matches.length} deep imports`)
      }
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
  const srcDirs = [
    join(rootDir, 'src'),
    join(rootDir, 'notifications-app', 'src')
  ]
  
  console.log('Fixing @bsky/shared imports...')
  
  for (const srcDir of srcDirs) {
    console.log(`\nProcessing ${srcDir}...`)
    for await (const filePath of walkDir(srcDir)) {
      await updateImportsInFile(filePath)
    }
  }
  
  console.log('\nImport fixes complete!')
}

main().catch(console.error)