# Tailwind CSS Rollback Procedure

## Overview

This document outlines the procedure to safely rollback the Tailwind CSS integration if issues are discovered.

## Quick Rollback (< 2 minutes)

Run the automated rollback script:

```bash
./scripts/rollback-tailwind.sh
```

This script will:

1. Remove Tailwind packages (tailwindcss, @tailwindcss/postcss, autoprefixer)
2. Delete configuration files (postcss.config.js, tailwind.config.js)
3. Remove Tailwind CSS file (src/styles/tailwind.css)
4. Remove Tailwind import from index.css
5. Clean up temporary files

## Manual Rollback Steps

If the automated script fails, follow these manual steps:

### 1. Remove Tailwind Packages

```bash
npm uninstall tailwindcss @tailwindcss/postcss autoprefixer
```

### 2. Remove Configuration Files

```bash
rm -f postcss.config.js
rm -f tailwind.config.js
rm -f src/styles/tailwind.css
```

### 3. Remove Tailwind Import

Edit `src/index.css` and remove these lines:

```css
/* Import Tailwind CSS - prefixed with tw- during migration */
@import "./styles/tailwind.css";
```

### 4. Restart Dev Server

```bash
./scripts/dev-server.sh restart
```

### 5. Verify Application Works

1. Check for build errors: `node ./scripts/check-dev-errors.js`
2. Open app in browser: `./scripts/open-chrome.sh`
3. Verify visual appearance matches baseline

## Git Rollback (Nuclear Option)

If all else fails, use Git to restore previous state:

```bash
# Check what changed
git status

# Restore all changes (WARNING: This discards ALL changes)
git checkout -- .

# Remove untracked files
git clean -fd

# Reinstall dependencies
npm install
```

## Verification Steps

After rollback, verify:

1. **Build Success**

   ```bash
   npm run build
   ```

2. **No Console Errors**

   ```bash
   node ./scripts/check-dev-errors.js
   ```

3. **Visual Comparison**
   - Compare against baseline screenshots in `tests/visual-baseline-simple/`
   - Run `node capture-compare.mjs` to capture current state
   - File sizes should match baseline within 5%

4. **Functionality Test**
   - Login works
   - Feed loads
   - Navigation functions
   - Mobile responsive design intact

## Troubleshooting

### CSS Not Loading

- Check that all original CSS imports are present in `src/index.css`
- Verify no PostCSS errors in console

### Build Errors

- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf node_modules/.vite`

### Visual Differences

- Compare against baseline screenshots
- Check CSS variable definitions are intact
- Verify no Tailwind classes remain in components

## Prevention

To avoid needing rollback:

1. Always capture visual baseline before changes
2. Test on all viewports after changes
3. Commit working state before major changes
4. Use feature branches for experiments

## Contact

If rollback fails or causes issues, check:

- Git history: `git log --oneline`
- Recent session notes in `./progress/`
- Error logs in `/tmp/vite-output.log`
