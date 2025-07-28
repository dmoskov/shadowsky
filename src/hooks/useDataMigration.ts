/**
 * Hook to handle data migration from localStorage to IndexedDB
 */

import { useEffect, useState } from 'react'
import { runAllMigrations } from '@bsky/shared'

export function useDataMigration() {
  const [migrationStatus, setMigrationStatus] = useState<{
    isComplete: boolean
    isRunning: boolean
    errors: string[]
  }>({
    isComplete: false,
    isRunning: false,
    errors: []
  })
  
  useEffect(() => {
    // Check if migration has already been completed
    const migrationComplete = localStorage.getItem('bsky_data_migration_v1')
    
    if (migrationComplete === 'true') {
      setMigrationStatus({ isComplete: true, isRunning: false, errors: [] })
      return
    }
    
    // Run migration
    const runMigration = async () => {
      setMigrationStatus(prev => ({ ...prev, isRunning: true }))
      
      try {
        const results = await runAllMigrations()
        
        const allErrors = [
          ...results.conversations.errors,
          ...results.notificationPosts.errors
        ]
        
        if (allErrors.length === 0) {
          // Mark migration as complete
          localStorage.setItem('bsky_data_migration_v1', 'true')
          setMigrationStatus({
            isComplete: true,
            isRunning: false,
            errors: []
          })
          
          console.log('Data migration completed successfully')
        } else {
          setMigrationStatus({
            isComplete: false,
            isRunning: false,
            errors: allErrors
          })
          
          console.error('Data migration completed with errors:', allErrors)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        setMigrationStatus({
          isComplete: false,
          isRunning: false,
          errors: [errorMessage]
        })
        
        console.error('Data migration failed:', error)
      }
    }
    
    // Delay migration slightly to not block initial render
    const timer = setTimeout(runMigration, 1000)
    
    return () => clearTimeout(timer)
  }, [])
  
  return migrationStatus
}