# Project: BSKY

## Overview

This is the CLAUDE.md file for your project. Add project-specific instructions here.

## Git Workflow

- **NO automatic commits or pushes**: Never run `git commit` or `git push` automatically. Always wait for explicit user approval before committing or pushing changes.
- Show the user what changes would be committed and let them decide when to commit and push.
- **ALWAYS run formatting checks before pushing**: Before pushing to any branch, run `npm run test:format` to check for formatting issues. If there are issues, run `npm run fix:format` to fix them automatically.

## UI Design Preferences

- **No headers in feed views**: Don't add title/description headers at the top of feed components. The user prefers a clean, header-free interface.
- Feed views should start directly with the content or feed selection controls.
