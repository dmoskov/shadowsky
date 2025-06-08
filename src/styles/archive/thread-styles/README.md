# Archived Thread CSS Files

This directory contains deprecated CSS files that were causing conflicts in the thread view styling. These files have been archived as part of the CSS audit conducted on January 8, 2025.

## Archived Files

1. **thread.css** - Original thread styling, had outdated selectors
2. **thread-view.css** - Thread container styles, conflicted with other files
3. **thread-improvements.css** - Additional thread features, never properly integrated
4. **thread-modern.css** - First attempt to fix thread styling (failed)
5. **thread-simple.css** - Second attempt to fix thread styling (failed)
6. **thread-basic.css** - Third attempt with minimal styling (partially worked)
7. **post-hierarchy.css** - Post hierarchy features, broke thread layout
8. **experimental-features.css** - Experimental thread features, caused conflicts

## Reason for Archival

These files were archived because:
- Multiple files were trying to style the same elements
- CSS selectors didn't match actual React component structure
- Excessive use of `!important` declarations
- Conflicting specificity causing unpredictable behavior
- Some files referenced class names that didn't exist in the DOM

## Replacement

These files have been replaced by a single, clean implementation:
- **thread-clean.css** - New implementation that matches actual component structure

## Note

These files are kept for reference only. They should NOT be re-imported into the project without significant refactoring to match the current component structure.