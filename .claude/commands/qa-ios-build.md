---
description: Build the iOS app and verify it compiles with no errors
allowed-tools: Bash(npx expo:*), Bash(cd:*), TodoWrite
---

# iOS Build Verification

Build the iOS app and report success or failure.

## Instructions

1. Run the iOS build from the mobile directory:
   ```
   cd /Users/moskov/Code/BSKY/mobile && npx expo run:ios --no-install
   ```
   Use a 5-minute timeout since builds can be slow.

2. Parse the build output:
   - Look for `Build Succeeded` or `Build Failed`
   - Count errors and warnings
   - For errors, report the file path, line number, and error message
   - For warnings, note them but focus on errors first

3. If the build fails:
   - Read the failing file(s) to understand the error context
   - Suggest a fix for each error
   - Group related errors (e.g., multiple errors from a single bad import)

4. Report results:
   ```
   Build: PASS/FAIL
   Errors: N
   Warnings: N

   [If failed, list each error with file:line and suggested fix]
   ```

## Common Build Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `cannot find type 'X' in scope` | Missing import or access control | Add import or mark type as `public` |
| `'X' is only available in iOS N.0 or newer` | API too new for deployment target (15.1) | Use older API or add availability check |
| `use of unresolved identifier` | Typo or missing import | Check spelling, add import |
| `expression type 'X' is ambiguous` | SwiftUI view builder inference failure | Add explicit type annotations |
| `missing argument for parameter` | Struct initializer changed | Update call sites to match new signature |
