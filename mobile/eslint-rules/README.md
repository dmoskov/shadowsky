# Custom ESLint Rules

## no-quoted-color-references

Prevents the common mistake of using color theme variables as string literals instead of actual variable references.

### Problem

During iOS build fixes, 22 instances of quoted color strings were found, where developers accidentally used color theme properties as strings:

```tsx
// ❌ BAD - String literal, not using actual color
backgroundColor: 'colors.surface'
color: 'colors.text'

// ✅ GOOD - Actual variable reference
backgroundColor: colors.surface
color: colors.text
```

### Rule Details

This rule detects when a string literal matches the pattern of a color theme reference (e.g., `'colors.*'` or `'theme.colors.*'`) and reports an error.

### Configuration

To enable this rule in your mobile ESLint configuration:

```js
module.exports = {
  extends: ['expo', 'prettier'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: "Literal[value=/^(theme\\.)?colors\\./]",
        message:
          'Color reference should not be a string literal. Remove quotes to use the actual color variable',
      },
    ],
  },
};
```

### Examples

#### Fail

```tsx
const styles = StyleSheet.create({
  container: {
    backgroundColor: 'colors.background', // Error
    borderColor: 'colors.border', // Error
  },
  text: {
    color: 'colors.text', // Error
  },
});
```

#### Pass

```tsx
const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background, // OK
    borderColor: colors.border, // OK
  },
  text: {
    color: colors.text, // OK
  },
});
```

### Implementation

The rule uses ESLint's `no-restricted-syntax` with an AST selector that matches string literals containing color references. This approach:

- Works with any ESLint version that supports AST selectors
- Requires no additional dependencies
- Provides clear error messages
- Can be easily extended to match additional patterns

### History

- **Created**: 2026-02-15
- **Reason**: Fix for issue discovered during iOS build where 22 quoted color strings caused runtime errors
- **Files Fixed**: 10 files with 28 total instances
