# Prettier with Tailwind CSS Guide

## Overview
This project uses Prettier with the Tailwind CSS plugin to automatically format code and sort Tailwind utility classes in a consistent order.

## Installation (Already Complete)
```bash
npm install --save-dev prettier prettier-plugin-tailwindcss
```

## Configuration
The project is configured with:
- `.prettierrc.json` - Prettier configuration
- `.prettierignore` - Files to exclude from formatting
- `.vscode/settings.json` - VS Code integration

## Usage

### Format All Files
```bash
npm run format
```

### Check Formatting (CI)
```bash
npm run format:check
```

### Format Specific Files
```bash
npx prettier --write src/components/core/Login.tsx
```

### Format on Save (VS Code)
If you're using VS Code, files will automatically format when you save them.

## Tailwind Class Sorting
The Tailwind Prettier plugin automatically sorts classes in this order:

1. **Layout** - `flex`, `grid`, `block`, `hidden`
2. **Positioning** - `absolute`, `relative`, `fixed`
3. **Box Model** - `m-4`, `p-6`, `w-full`, `h-screen`
4. **Typography** - `text-xl`, `font-bold`, `text-center`
5. **Visual** - `bg-blue-500`, `text-white`, `border`
6. **Filters** - `blur`, `brightness`
7. **Transitions** - `transition`, `duration-200`
8. **Interactivity** - `cursor-pointer`, `select-none`

### Example
Before:
```tsx
<div className="text-white p-4 bg-blue-500 flex font-bold">
```

After:
```tsx
<div className="flex p-4 bg-blue-500 font-bold text-white">
```

## Integration with Existing Code

### Dynamic Classes
The plugin works with dynamic classes:
```tsx
className={`
  flex items-center p-4
  ${isActive ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}
  hover:bg-blue-600 transition-colors
`}
```

### clsx Usage
The plugin is configured to work with `clsx`:
```tsx
className={clsx(
  'flex items-center p-4',
  isActive && 'bg-blue-500 text-white',
  !isActive && 'bg-gray-200 text-gray-800'
)}
```

## Best Practices

### 1. Run Before Committing
Always format your code before committing:
```bash
npm run format
git add .
git commit -m "feat: add new component"
```

### 2. Multi-line Classes
For better readability with many classes:
```tsx
<div
  className="
    flex flex-col items-center justify-center
    w-full max-w-md mx-auto
    p-6 space-y-4
    bg-white rounded-lg shadow-lg
    dark:bg-gray-800
  "
>
```

### 3. Conditional Classes
Keep conditions readable:
```tsx
className={`
  base-classes-here
  ${condition1 ? 'true-classes' : 'false-classes'}
  ${condition2 && 'conditional-classes'}
`}
```

## Troubleshooting

### Classes Not Sorting
1. Ensure the file is saved (if using format-on-save)
2. Check that the file isn't in `.prettierignore`
3. Run `npm run format` manually

### VS Code Not Formatting
1. Install the Prettier extension
2. Reload VS Code window
3. Check that Prettier is the default formatter

### Format Conflicts
If you see formatting conflicts:
1. Ensure everyone uses the same Prettier version
2. Run `npm ci` to install exact versions
3. Commit the `.prettierrc.json` file

## CI Integration
Add to your CI pipeline:
```yaml
- name: Check code formatting
  run: npm run format:check
```

---

*Last Updated: June 9, 2025*