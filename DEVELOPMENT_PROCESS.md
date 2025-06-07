# Development Process Guidelines

## 🔍 BEFORE CREATING ANY NEW FILE

### 1. CHECK EXISTING CODE FIRST
**ALWAYS** search for existing implementations before creating new files:

```bash
# Search for similar functionality
grep -r "keyword" . --include="*.js" --include="*.ts" --include="*.tsx"

# Check test scripts inventory
cat TEST_SCRIPTS_INVENTORY.md

# Look for existing components
ls -la src/components/**/

# Check for existing utilities
ls -la src/utils/ src/lib/ src/hooks/
```

### 2. EXTEND RATHER THAN DUPLICATE
- If a similar file exists, extend it with new functionality
- If a test script exists that does 80% of what you need, modify it
- Create new files ONLY when existing ones cannot be reasonably extended

### 3. USE EXISTING PATTERNS
- Authentication: Use `auth.json` or `.test-credentials`
- Test scripts: Extend existing Playwright tests
- Components: Follow existing component structure
- Styles: Use existing CSS variables and classes

## 📁 Project Structure Reference

### Test Scripts Location
- **Playwright tests**: `tests/playwright/`
- **Unit tests**: `tests/` (future)
- **Scripts**: `scripts/`
- **Screenshots**: `tests/screenshots/`

### Key Reusable Components
- **Authentication**: 
  - `src/contexts/AuthContext.tsx`
  - Scripts with auth: `test-app.mjs`, `diagnose-app.js`
- **Error Handling**: 
  - `src/lib/errors.ts`
  - `src/hooks/useErrorHandler.ts`
- **API Services**: 
  - `src/services/atproto/`
- **UI Components**: 
  - `src/components/` (organized by feature)

## 🧪 Testing Best Practices

### For UI Issues (like notification badge):
1. **First check**: `diagnose-app.js` - Has comprehensive diagnostics
2. **For auth testing**: `test-app.mjs` - Already handles login flow
3. **For component testing**: Extend existing component tests

### Example: Testing Notification Badge
Instead of creating new script:
```javascript
// ❌ DON'T: Create scripts/debug-notification-badge.js

// ✅ DO: Extend scripts/diagnose-app.js with notification checks
// Or use test-app.mjs and add notification-specific assertions
```

## 📝 Documentation Requirements

### When Creating New Files:
1. Update relevant inventory (e.g., `TEST_SCRIPTS_INVENTORY.md`)
2. Add inline comments explaining why existing files couldn't be used
3. Follow existing naming conventions

### When Extending Files:
1. Add clear section comments
2. Update file's header documentation
3. Maintain backward compatibility

## 🔄 Regular Maintenance

### Weekly Tasks:
- Review and update `TEST_SCRIPTS_INVENTORY.md`
- Remove duplicate functionality
- Consolidate similar scripts

### Before Major Features:
- Audit existing code for reusable patterns
- Update this process document if needed

## 🚨 Red Flags to Avoid

1. **Creating `test-<feature>-2.js`** when `test-<feature>.js` exists
2. **Hardcoding credentials** when `.test-credentials` exists
3. **Writing new auth logic** when `AuthContext` exists
4. **Creating new error classes** when `lib/errors.ts` exists
5. **Making new UI components** without checking existing ones

## 💡 Quick Reference Commands

```bash
# Find all test scripts
find . -name "test-*.js" -o -name "test-*.mjs" -o -name "test-*.ts"

# Find scripts that handle auth
grep -r "login\|auth" scripts/ tests/ --include="*.js" --include="*.mjs"

# Find existing UI components
find src/components -name "*.tsx" | sort

# Check for existing styles
grep -r "notification\|badge" src/styles/
```

---

**Remember**: The best code is often the code you don't write. Reuse, extend, and refactor before creating new files.