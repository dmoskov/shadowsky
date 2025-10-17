## Universal Instructions

See: /Users/moskov/Code/CLAUDE.md for universal coding standards

# Project: BSKY

## Overview

This is the CLAUDE.md file for your project. Add project-specific instructions here.

## Git Workflow

- **NO automatic commits or pushes**: Never run `git commit` or `git push` automatically. Always wait for explicit user approval before committing or pushing changes.
- Show the user what changes would be committed and let them decide when to commit and push.
- **ALWAYS run formatting checks before pushing**: Before pushing to any branch, run `npm run test:format` to check for formatting issues. If there are issues, run `npm run fix:format` to fix them automatically.

### Using the Push Script

A push script is available at `scripts/push.sh` that automatically runs pre-push checks:

```bash
# Basic usage (pushes to current branch)
./scripts/push.sh

# Push to specific branch
./scripts/push.sh origin feature-branch

# Force push (use with caution)
./scripts/push.sh --force

# Push with any git push arguments
./scripts/push.sh --set-upstream origin my-branch
```

The push script will:

1. Check for uncommitted changes
2. Run `npm run test:format` to check code formatting
3. Run `npm run build` to ensure the project builds successfully
4. Only push if all checks pass

If formatting issues are found, the script will suggest running `npm run fix:format` to fix them automatically.

## UI Design Preferences

- **No headers in feed views**: Don't add title/description headers at the top of feed components. The user prefers a clean, header-free interface.
- Feed views should start directly with the content or feed selection controls.

## Development Best Practices

### Version Management

- **Update version in multiple locations**: When bumping the version number in `package.json`, also update it in:
  - `src/components/Sidebar.tsx` - The UI displays the version at the bottom of the sidebar (line 172)
- Both locations must stay in sync to ensure the displayed version matches the package version.

### Debug Logging

- **Clean up debug logging at the end of sessions**: If you add any `console.log`, `console.error`, or verbose `logger.log` statements for debugging during development, please remove them before completing the session.
- Keep only essential error logging that helps with production debugging.
- The codebase uses a logger utility that respects debug mode (`window.enableDebug()`), so use `logger.log()` instead of `console.log()` for development logging that should remain in the codebase.

### Code Quality

- **Run build before considering work complete**: Always run `npm run build` to ensure there are no TypeScript errors or build issues.
- **Fix unused variables and imports**: Remove any unused imports or variables that TypeScript flags.
- **Use existing patterns**: When adding new features, look for existing patterns in the codebase and follow them for consistency.

### Storage and State Management

- **Test storage migrations carefully**: When working with storage backends (localStorage, AT Protocol), always test migrations in both directions.
- **Clear caches appropriately**: When switching storage types or debugging data issues, remember to clear/refresh caches.

### Error Handling

- **Use the storage error manager**: For storage-related errors, use the existing StorageErrorManager to provide consistent user feedback.
- **Preserve error context**: When catching and re-throwing errors, preserve the original error information for debugging.
- **Handle 400 errors gracefully**: A 400 error when fetching AT Protocol records often means the record doesn't exist yet, which is normal for new users.

### Testing and QA

- **Enable debug mode for troubleshooting**: Use `window.enableDebug()` in the browser console to see detailed logging.
- **Test with both storage types**: When modifying storage-related code, test with both local storage and AT Protocol storage.
- **Check for infinite loops**: Be careful with functions that might call each other (like preference loading/saving) to avoid infinite loops.

### AT Protocol Integration

- **Use singleton records for user data**: Bookmarks, drafts, and preferences use singleton records with "self" as the rkey.
- **Follow the collection naming convention**: Use `com.shadowsky.*` for AT Protocol collections.
- **Handle missing records**: Always handle the case where an AT Protocol record doesn't exist yet.
