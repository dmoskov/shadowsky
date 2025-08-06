import { useCallback, useSyncExternalStore } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { bookmarkService } from '../services/bookmark-service'
import type { AppBskyFeedDefs } from '@atproto/api'

// Global bookmark state store
class BookmarkStore {
  private bookmarks = new Map<string, boolean>()
  private listeners = new Set<() => void>()
  private initialized = false

  async init() {
    if (this.initialized) return
    
    await bookmarkService.init()
    const bookmarks = await bookmarkService.getBookmarkedPosts()
    bookmarks.forEach(b => this.bookmarks.set(b.postUri, true))
    this.initialized = true
    this.notify()
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot() {
    return this.bookmarks
  }

  isBookmarked(postUri: string) {
    return this.bookmarks.get(postUri) || false
  }

  setBookmarked(postUri: string, isBookmarked: boolean) {
    if (isBookmarked) {
      this.bookmarks.set(postUri, true)
    } else {
      this.bookmarks.delete(postUri)
    }
    this.notify()
  }

  private notify() {
    this.listeners.forEach(listener => listener())
  }
}

const bookmarkStore = new BookmarkStore()
bookmarkStore.init()

export function useBookmarks() {
  const queryClient = useQueryClient()
  
  // Subscribe to bookmark state for a specific post
  const bookmarkState = useSyncExternalStore(
    (listener) => bookmarkStore.subscribe(listener),
    () => bookmarkStore.getSnapshot()
  )
  
  // Check if a post is bookmarked
  const isBookmarked = useCallback((postUri: string) => {
    return bookmarkStore.isBookmarked(postUri)
  }, [bookmarkState]) // Re-create when state changes
  
  // Toggle bookmark mutation
  const toggleBookmarkMutation = useMutation({
    mutationFn: async (post: AppBskyFeedDefs.PostView) => {
      return await bookmarkService.toggleBookmark(post)
    },
    onMutate: async (post: AppBskyFeedDefs.PostView) => {
      // Optimistic update
      const wasBookmarked = bookmarkStore.isBookmarked(post.uri)
      bookmarkStore.setBookmarked(post.uri, !wasBookmarked)
      
      return { wasBookmarked, postUri: post.uri }
    },
    onError: (err, post, context) => {
      // Revert on error
      if (context) {
        bookmarkStore.setBookmarked(context.postUri, context.wasBookmarked)
      }
    },
    onSuccess: (isNowBookmarked, post) => {
      // Update with actual result
      bookmarkStore.setBookmarked(post.uri, isNowBookmarked)
      
      // Only invalidate bookmarks query, not the entire feed
      queryClient.invalidateQueries({ 
        queryKey: ['bookmarks'],
        exact: true 
      })
      queryClient.invalidateQueries({ 
        queryKey: ['bookmarkCount'],
        exact: true 
      })
    }
  })
  
  const toggleBookmark = useCallback((post: AppBskyFeedDefs.PostView) => {
    toggleBookmarkMutation.mutate(post)
  }, [toggleBookmarkMutation])
  
  return {
    isBookmarked,
    toggleBookmark,
    isToggling: toggleBookmarkMutation.isPending
  }
}