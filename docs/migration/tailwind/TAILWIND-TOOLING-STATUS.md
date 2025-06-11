# Tailwind CSS Tooling Status

## Current Setup (June 9, 2025)

### ✅ Working Tools

#### 1. **Tailwind CSS v4 (Alpha)**
- Successfully integrated and working
- Generating all utility classes correctly
- Compatible with our Vite setup

#### 2. **Prettier with Tailwind Plugin**
- `prettier-plugin-tailwindcss` v0.6.12
- Automatically sorts Tailwind classes in recommended order
- Works with dynamic classes and template literals
- Format on save configured in VS Code

**Example:**
```bash
# Format all files
npm run format

# Check formatting
npm run format:check
```

### ⚠️ Incompatible Tools

#### 1. **ESLint Plugin for Tailwind CSS**
- **Status**: Not compatible with Tailwind v4
- **Issue**: `eslint-plugin-tailwindcss` v3.x requires Tailwind v3
- **Alpha version (v4.0.0-alpha.0)**: Not fully implemented yet

**Error encountered:**
```
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './resolveConfig' 
is not defined by "exports" in tailwindcss/package.json
```

### 📋 Alternative Solutions

Since ESLint plugin isn't available for Tailwind v4, we rely on:

1. **Prettier for Class Ordering**
   - Handles the main benefit of ESLint plugin (class sorting)
   - Consistent ordering across the codebase

2. **VS Code IntelliSense**
   - Install Tailwind CSS IntelliSense extension
   - Provides autocomplete and hover previews
   - Shows conflicts in real-time

3. **Manual Code Review**
   - Check for contradicting classes during PR reviews
   - Use browser DevTools to verify applied styles

### 🔮 Future Updates

When Tailwind v4 reaches stable release:
- ESLint plugin will likely be updated
- More tooling support will become available
- We can re-evaluate our tooling stack

### 📝 Best Practices Without ESLint Plugin

1. **Avoid Contradicting Classes**
   ```tsx
   // ❌ Bad - contradicting padding
   <div className="p-4 p-6">
   
   // ✅ Good - single padding value
   <div className="p-4">
   ```

2. **Use Conditional Classes Properly**
   ```tsx
   // ✅ Good - clear conditions
   className={`
     base-classes
     ${isActive ? 'active-classes' : 'inactive-classes'}
   `}
   ```

3. **Let Prettier Handle Ordering**
   - Don't manually sort classes
   - Run formatter before committing
   - Trust the automatic ordering

### 🛠️ Current Workflow

1. Write Tailwind classes naturally
2. Save file (Prettier formats automatically)
3. Review in browser for visual correctness
4. Commit with properly ordered classes

### 📚 Resources

- [Tailwind CSS v4 Alpha Docs](https://tailwindcss.com/docs/v4-alpha)
- [Prettier Tailwind Plugin](https://github.com/tailwindlabs/prettier-plugin-tailwindcss)
- [VS Code Tailwind IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)

---

*Note: This document will be updated when Tailwind v4 reaches stable and tooling improves.*