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
