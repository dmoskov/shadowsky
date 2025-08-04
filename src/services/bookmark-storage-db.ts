import { openDB, IDBPDatabase } from 'idb'

export interface Bookmark {
  id: string
  postUri: string
  postCid: string
  savedAt: string
  author: {
    did: string
    handle: string
    displayName?: string
    avatar?: string
  }
  text: string
  tags?: string[]
  notes?: string
}

export interface BookmarkPost extends Bookmark {
  post?: any // Full post data if available
}

class BookmarkStorageDB {
  private dbName = 'bsky_bookmarks_db'
  private dbVersion = 1
  private db: IDBPDatabase | null = null

  async init() {
    try {
      this.db = await openDB(this.dbName, this.dbVersion, {
        upgrade(db) {
          // Create bookmarks store
          if (!db.objectStoreNames.contains('bookmarks')) {
            const store = db.createObjectStore('bookmarks', { keyPath: 'id' })
            store.createIndex('postUri', 'postUri', { unique: true })
            store.createIndex('savedAt', 'savedAt', { unique: false })
            store.createIndex('authorDid', 'author.did', { unique: false })
          }
        },
      })
    } catch (error) {
      console.error('Failed to initialize bookmark storage DB:', error)
    }
  }

  async addBookmark(bookmark: Bookmark): Promise<void> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('Failed to initialize database')

    await this.db.put('bookmarks', bookmark)
  }

  async removeBookmark(postUri: string): Promise<void> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('Failed to initialize database')

    const bookmark = await this.getBookmarkByUri(postUri)
    if (bookmark) {
      await this.db.delete('bookmarks', bookmark.id)
    }
  }

  async getBookmark(id: string): Promise<Bookmark | undefined> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('Failed to initialize database')

    return await this.db.get('bookmarks', id)
  }

  async getBookmarkByUri(postUri: string): Promise<Bookmark | undefined> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('Failed to initialize database')

    const index = this.db.transaction('bookmarks').objectStore('bookmarks').index('postUri')
    return await index.get(postUri)
  }

  async getAllBookmarks(limit?: number, offset?: number): Promise<Bookmark[]> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('Failed to initialize database')

    const tx = this.db.transaction('bookmarks', 'readonly')
    const store = tx.objectStore('bookmarks')
    const index = store.index('savedAt')
    
    // Get bookmarks in reverse chronological order
    const bookmarks: Bookmark[] = []
    let cursor = await index.openCursor(null, 'prev')
    let count = 0
    let skipped = 0

    while (cursor) {
      if (offset && skipped < offset) {
        skipped++
      } else {
        bookmarks.push(cursor.value)
        count++
        if (limit && count >= limit) break
      }
      cursor = await cursor.continue()
    }

    return bookmarks
  }

  async isBookmarked(postUri: string): Promise<boolean> {
    const bookmark = await this.getBookmarkByUri(postUri)
    return !!bookmark
  }

  async getBookmarkCount(): Promise<number> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('Failed to initialize database')

    return await this.db.count('bookmarks')
  }

  async searchBookmarks(query: string): Promise<Bookmark[]> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('Failed to initialize database')

    const allBookmarks = await this.getAllBookmarks()
    const lowercaseQuery = query.toLowerCase()

    return allBookmarks.filter(bookmark => 
      bookmark.text.toLowerCase().includes(lowercaseQuery) ||
      bookmark.author.handle.toLowerCase().includes(lowercaseQuery) ||
      bookmark.author.displayName?.toLowerCase().includes(lowercaseQuery) ||
      bookmark.tags?.some(tag => tag.toLowerCase().includes(lowercaseQuery)) ||
      bookmark.notes?.toLowerCase().includes(lowercaseQuery)
    )
  }

  async clearAllBookmarks(): Promise<void> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('Failed to initialize database')

    await this.db.clear('bookmarks')
  }

  async exportBookmarks(): Promise<Bookmark[]> {
    return await this.getAllBookmarks()
  }

  async importBookmarks(bookmarks: Bookmark[]): Promise<void> {
    if (!this.db) await this.init()
    if (!this.db) throw new Error('Failed to initialize database')

    const tx = this.db.transaction('bookmarks', 'readwrite')
    const store = tx.objectStore('bookmarks')

    for (const bookmark of bookmarks) {
      await store.put(bookmark)
    }

    await tx.done
  }
}

export const bookmarkStorage = new BookmarkStorageDB()