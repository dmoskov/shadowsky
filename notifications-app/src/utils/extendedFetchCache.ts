/**
 * Manages metadata about extended notification fetches (4-week downloads)
 * Tracks when the user last performed a full fetch to avoid unnecessary re-prompts
 */

interface ExtendedFetchMetadata {
  lastFetchTimestamp: number
  totalNotificationsFetched: number
  oldestNotificationDate: number
  newestNotificationDate: number
  daysReached: number
  version: string
}

const METADATA_KEY = 'bsky_extended_fetch_metadata_v1'
const REFRESH_THRESHOLD_HOURS = 4 // Consider data stale after 4 hours

export class ExtendedFetchCache {
  /**
   * Save metadata about a completed extended fetch
   */
  static saveMetadata(
    totalNotifications: number,
    oldestDate: Date,
    newestDate: Date,
    daysReached: number
  ): void {
    const metadata: ExtendedFetchMetadata = {
      lastFetchTimestamp: Date.now(),
      totalNotificationsFetched: totalNotifications,
      oldestNotificationDate: oldestDate.getTime(),
      newestNotificationDate: newestDate.getTime(),
      daysReached,
      version: 'v1'
    }
    
    try {
      localStorage.setItem(METADATA_KEY, JSON.stringify(metadata))
      console.log('📊 Extended fetch metadata saved:', {
        totalNotifications,
        daysReached,
        oldestDate: oldestDate.toLocaleDateString(),
        newestDate: newestDate.toLocaleDateString()
      })
    } catch (error) {
      console.error('Failed to save extended fetch metadata:', error)
    }
  }

  /**
   * Check if we have recent extended fetch data
   * Returns metadata if data is fresh, null if stale or missing
   */
  static getRecentMetadata(): ExtendedFetchMetadata | null {
    try {
      const stored = localStorage.getItem(METADATA_KEY)
      if (!stored) return null
      
      const metadata = JSON.parse(stored) as ExtendedFetchMetadata
      
      // Check version
      if (metadata.version !== 'v1') {
        this.clearMetadata()
        return null
      }
      
      // Check if data is still fresh
      const hoursSinceLastFetch = (Date.now() - metadata.lastFetchTimestamp) / (1000 * 60 * 60)
      
      if (hoursSinceLastFetch > REFRESH_THRESHOLD_HOURS) {
        console.log(`📊 Extended fetch metadata is stale (${hoursSinceLastFetch.toFixed(1)} hours old)`)
        return null
      }
      
      console.log(`📊 Found recent extended fetch metadata (${hoursSinceLastFetch.toFixed(1)} hours old)`)
      return metadata
      
    } catch (error) {
      console.error('Failed to load extended fetch metadata:', error)
      return null
    }
  }

  /**
   * Check if we should auto-fetch missing notifications
   * Returns true if we have recent metadata and should fetch only new notifications
   */
  static shouldAutoFetchMissing(): boolean {
    const metadata = this.getRecentMetadata()
    if (!metadata) return false
    
    // If we fetched 4 weeks of data within the last few hours,
    // we should auto-fetch only the missing recent notifications
    return metadata.daysReached >= 28
  }

  /**
   * Get info about what needs to be fetched
   */
  static getFetchInfo(): {
    hasRecentFullFetch: boolean
    metadata: ExtendedFetchMetadata | null
    shouldAutoFetch: boolean
    hoursSinceLastFetch: number | null
  } {
    const metadata = this.getRecentMetadata()
    const hoursSinceLastFetch = metadata 
      ? (Date.now() - metadata.lastFetchTimestamp) / (1000 * 60 * 60)
      : null
    
    return {
      hasRecentFullFetch: !!metadata,
      metadata,
      shouldAutoFetch: this.shouldAutoFetchMissing(),
      hoursSinceLastFetch
    }
  }

  /**
   * Clear stored metadata
   */
  static clearMetadata(): void {
    try {
      localStorage.removeItem(METADATA_KEY)
      console.log('📊 Extended fetch metadata cleared')
    } catch (error) {
      console.error('Failed to clear extended fetch metadata:', error)
    }
  }
}