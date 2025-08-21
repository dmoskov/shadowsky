# Storage Conventions and Key Reference

## Overview
This document defines the storage conventions used throughout the ShadowSky application to ensure consistency and prevent key naming conflicts.

## Key Naming Conventions

### 1. Storage Type Keys (SINGULAR, NO 'S')
These keys are used in preferences to indicate where data is stored:
- `bookmarkStorageType` - NOT `bookmarksStorageType`
- `columnStorageType` - NOT `columnsStorageType`
- `draftStorageType` - NOT `draftsStorageType`

### 2. LocalStorage Keys
Keys used for direct localStorage access:

#### Current Production Keys (Legacy)
- `skyDeckColumns` - Used by SkyDeck component directly
- `bsky_thread_drafts` - Used by draft service
- `shadowsky-bookmarks-{uri}` - Individual bookmark entries

#### New Standardized Keys
- `shadowsky_columns` - Column service storage
- `shadowsky_app_preferences` - App preferences backup
- `shadowsky_drafts` - Future draft storage (not yet implemented)

#### Migration Flags
- `shadowsky_columns_migrated` - Indicates columns have been migrated
- `shadowsky_column_migration_notice_shown` - UI notice has been shown

### 3. AT Protocol Collections
Collections used for AT Protocol storage:
- `com.shadowsky.preferences` - App preferences (private)
- `com.shadowsky.columns` - Column data (private, singleton)
- `com.shadowsky.bookmarks` - Bookmarks array (public, singleton) 
- `com.shadowsky.drafts` - Drafts array (public, singleton)

### 4. AT Protocol Record Keys (rkeys)
All collections now use singleton pattern with rkey `self`:
- Preferences: `self` (singleton)
- Columns: `self` (singleton containing array)
- Bookmarks: `self` (singleton containing array)
- Drafts: `self` (singleton containing array)

## Storage Type Values

### AppPreferencesRecord (Internal)
```typescript
{
  bookmarkStorageType: "local" | "custom"
  columnStorageType: "local" | "custom"
  draftStorageType: "local" | "custom"
}
```

### ShadowSkyPreferences (AT Protocol)
```typescript
{
  bookmarkStorageType: "local" | "custom"
  columnStorageType: "local" | "atproto"  // Note: Different!
  draftStorageType: "local" | "custom"
}
```

### Conversion Rules
- When saving to AT Protocol: `"custom"` → `"atproto"` (for columns only)
- When loading from AT Protocol: `"atproto"` → `"custom"` (for columns only)

## Data Type Names
When referencing data types in code:

### Singular (Preferred)
- `bookmark` - Single bookmark
- `column` - Single column
- `draft` - Single draft
- `setting` - Single setting

### Plural (Collections)
- `bookmarks` - Collection of bookmarks
- `columns` - Collection of columns
- `drafts` - Collection of drafts
- `settings` - Collection of settings

## Service Method Naming

### Column Service
- `getColumns()` - Returns array of columns
- `getColumn(id)` - Returns single column
- `createColumn(column)` - Creates single column
- `updateColumn(id, column)` - Updates single column
- `deleteColumn(id)` - Deletes single column

### Bookmark Service
- `getBookmarks()` - Returns array of bookmarks
- `getBookmark(uri)` - Returns single bookmark
- `addBookmark(post)` - Creates single bookmark
- `removeBookmark(uri)` - Deletes single bookmark

## Storage Architecture Changes (2025)

### Singleton Pattern for All Collections
All AT Protocol collections now use a singleton pattern where data is stored in a single record with rkey `self`. This provides:
- **Order preservation**: Array order is maintained
- **Better performance**: Single API call to load all data
- **Consistency**: All data types follow the same pattern
- **Atomic updates**: All items updated together

### Collection Structure
```typescript
// All collections follow this pattern:
{
  $type: "com.shadowsky.{collection}",
  {collection}: Array<Item>,
  version: number
}
```

## Common Pitfalls to Avoid

1. **DO NOT** add 's' to storage type keys
   - ❌ `columnsStorageType`
   - ✅ `columnStorageType`

2. **DO NOT** mix localStorage key formats
   - ❌ `shadowsky-columns` (hyphenated)
   - ✅ `shadowsky_columns` (underscored)

3. **DO NOT** use plural for preference keys
   - ❌ `bookmarksStorageType`
   - ✅ `bookmarkStorageType`

4. **DO** use plural for collection names (since they contain arrays)
   - AT Protocol: `com.shadowsky.bookmarks` (plural)
   - Service methods: `getBookmarks()` (plural for collections)

## Type Safety Helpers

To prevent future key mismatches, use these constants:

```typescript
// Storage type preference keys
export const STORAGE_PREF_KEYS = {
  BOOKMARK: 'bookmarkStorageType',
  COLUMN: 'columnStorageType',
  DRAFT: 'draftStorageType',
} as const;

// LocalStorage keys
export const LOCAL_STORAGE_KEYS = {
  COLUMNS: 'shadowsky_columns',
  COLUMNS_LEGACY: 'skyDeckColumns',
  DRAFTS: 'bsky_thread_drafts',
  PREFERENCES: 'shadowsky_app_preferences',
} as const;

// AT Protocol collections
export const AT_PROTO_COLLECTIONS = {
  PREFERENCES: 'com.shadowsky.preferences',
  COLUMNS: 'com.shadowsky.columns',
  BOOKMARK: 'com.shadowsky.bookmark',
  DRAFT: 'com.shadowsky.draft',
} as const;
```

## Migration Strategy

1. **Backward Compatibility**: Always check legacy keys first
2. **Dual Write**: Write to both old and new keys during transition
3. **Migration Flags**: Track what has been migrated
4. **User Communication**: Notify users of storage improvements

## Testing Checklist

When working with storage:
- [ ] Verify correct storage type key (no plural 's')
- [ ] Check localStorage key format (underscores, not hyphens)
- [ ] Ensure AT Protocol collection names match lexicons
- [ ] Test migration from legacy keys
- [ ] Verify data persists across reloads
- [ ] Check debug storage view shows correct data