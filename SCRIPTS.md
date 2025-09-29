# NPM Scripts Documentation

## Overview

This document provides detailed explanations for all npm scripts in the ShadowSky project. Scripts use Wireit for task orchestration, which provides caching and dependency management.

## Core Scripts

### Development

#### `npm run dev`

**Purpose**: Start the Vite development server with hot module replacement (HMR)
**Usage**: Primary command for local development
**Port**: Runs on http://localhost:5174
**Features**:

- Hot module replacement for instant updates
- Fast refresh for React components
- Source maps for debugging
- TypeScript compilation on the fly

### Build Scripts

#### `npm run build`

**Purpose**: Complete production build with type checking
**Depends on**:

- `build:app` - Builds the application
- `test:types` - Ensures TypeScript types are valid
  **Output**: Production-ready files in `dist/` directory
  **Use case**: Run before deploying to production

#### `npm run build:app`

**Purpose**: Build the application without type checking
**Command**: `vite build`
**Input files**:

- All source files in `src/`
- Configuration files (vite.config.ts, tsconfig.json, etc.)
- index.html entry point
  **Output**: Optimized, minified bundles in `dist/`
  **Optimizations**:
- Tree shaking to remove unused code
- Minification of JavaScript and CSS
- Asset optimization and fingerprinting
- Code splitting for better caching

#### `npm run preview`

**Purpose**: Preview the production build locally
**Prerequisites**: Must run `npm run build` first
**Port**: Runs on http://localhost:4173
**Use case**: Test production build before deployment

### Testing Scripts

#### `npm run test`

**Purpose**: Run all tests and quality checks
**Includes**:

- Build verification
- Format checking
- Linting
- Type checking
- Unit tests
  **Use case**: Comprehensive check before committing or pushing

#### `npm run test:unit`

**Purpose**: Run unit tests once using Vitest
**Command**: `vitest run`
**Coverage**: Tests in `src/**/*.test.{ts,tsx}` files
**Use case**: CI/CD pipelines or pre-commit hooks

#### `npm run test:unit:watch`

**Purpose**: Run unit tests in watch mode for TDD
**Command**: `vitest watch`
**Features**:

- Auto-reruns tests on file changes
- Interactive test filtering
- Coverage reporting
  **Use case**: Active development with test-driven approach

#### `npm run test:format`

**Purpose**: Check code formatting without making changes
**Tool**: Prettier
**Checks**:

- All TypeScript/TSX files in `src/`
- Configuration files (_.html, _.js, _.md, _.yml)
- Documentation files
- Server files
  **Exit code**: Non-zero if formatting issues found
  **Use case**: CI checks or pre-push validation

#### `npm run test:lint`

**Purpose**: Check code quality and potential errors
**Tool**: ESLint
**Scope**:

- All TypeScript/TSX files in `src/`
- Root-level JS/TS files
  **Features**:
- Type-aware linting rules
- React-specific rules
- Caches results for faster subsequent runs
  **Use case**: Identify code quality issues

#### `npm run test:types`

**Purpose**: Validate TypeScript types without emitting files
**Command**: `tsc --build --pretty`
**Checks**:

- All TypeScript files for type errors
- Strict mode compliance
- Declaration file generation
  **Use case**: Ensure type safety before build

### Fixing Scripts

#### `npm run fix`

**Purpose**: Auto-fix all fixable issues
**Runs**:

- `fix:format` - Fix formatting issues
- `fix:lint` - Fix linting issues
  **Use case**: Quick cleanup before committing

#### `npm run fix:format`

**Purpose**: Automatically format all code files
**Tool**: Prettier with plugins
**Plugins**:

- `prettier-plugin-organize-imports` - Sorts and organizes imports
- `prettier-plugin-tailwindcss` - Sorts Tailwind classes
  **Scope**: Same files as `test:format`
  **Changes**: Writes formatted files directly
  **Use case**: Standardize code formatting

#### `npm run fix:lint`

**Purpose**: Auto-fix linting issues where possible
**Tool**: ESLint with --fix flag
**Capabilities**:

- Add missing semicolons
- Fix indentation
- Remove unused imports
- Apply consistent code style
  **Limitations**: Cannot fix all issues (some require manual intervention)
  **Use case**: Quick automated cleanup

## Wireit Configuration

### How Wireit Works

Wireit provides intelligent caching and dependency management for npm scripts:

1. **Caching**: Skips tasks if inputs haven't changed
2. **Dependencies**: Runs dependent tasks automatically
3. **Parallelization**: Runs independent tasks concurrently
4. **File watching**: Tracks input and output files

### Task Dependencies

```
build
├── build:app
└── test:types

test
├── build:app
├── test:format
├── test:lint
├── test:types
└── test:unit

fix
├── fix:format
└── fix:lint
```

### Cache Location

Wireit caches are stored in `.wireit/` directory (git-ignored)

## Script Combinations and Workflows

### Development Workflow

```bash
npm run dev              # Start development
npm run test:unit:watch  # Run tests alongside
```

### Pre-commit Workflow

```bash
npm run fix              # Auto-fix issues
npm run test             # Verify everything passes
```

### Pre-push Workflow

```bash
npm run test:format      # Check formatting
npm run test:lint        # Check code quality
npm run build            # Ensure it builds
```

### CI/CD Workflow

```bash
npm install              # Install dependencies
npm run test             # Run all checks
npm run build            # Build for production
```

## Debugging Scripts

### Enable Verbose Output

```bash
# For Vite
DEBUG=vite:* npm run dev

# For Wireit
WIREIT_LOG_LEVEL=debug npm run build

# For ESLint
DEBUG=eslint:* npm run test:lint
```

### Skip Caching (Wireit)

```bash
WIREIT_CACHE=none npm run build
```

### Profile Build Performance

```bash
# Analyze bundle size
npm run build -- --report
```

## Common Issues and Solutions

### Issue: "Cannot find module" errors

**Solution**: Clear caches and rebuild

```bash
rm -rf .wireit node_modules
npm install
npm run build
```

### Issue: Formatting and linting conflicts

**Solution**: Run fix commands in order

```bash
npm run fix:format
npm run fix:lint
```

### Issue: Build fails but dev works

**Solution**: Type checking is stricter in build

```bash
npm run test:types  # Check type errors
npm run build:app   # Build without type checking (temporary)
```

### Issue: Tests fail in CI but pass locally

**Solution**: Clear cache and match CI environment

```bash
rm -rf .wireit
npm ci              # Clean install
npm test
```

## Performance Tips

1. **Use Watch Mode**: During development, use watch modes to avoid repeated work
2. **Leverage Caching**: Wireit caches results - avoid clearing unless necessary
3. **Parallel Execution**: Wireit runs independent tasks in parallel automatically
4. **Incremental Builds**: Only changed files are reprocessed

## Script Maintenance

### Adding New Scripts

1. Add to `package.json` scripts section
2. If using Wireit, add configuration to `wireit` section
3. Document in this file
4. Update CI/CD configurations if needed

### Modifying Scripts

1. Update both `scripts` and `wireit` sections if applicable
2. Clear `.wireit` cache after significant changes
3. Test all dependent scripts
4. Update this documentation

## Related Documentation

- **[CONTRIBUTING.md](CONTRIBUTING.md)**: Development workflow using these scripts
- **[.github/workflows/](.github/workflows/)**: CI/CD script usage
- **[scripts/push.sh](scripts/push.sh)**: Git push wrapper using these scripts

---

_Last updated: 2024 - Keep this document in sync with package.json changes_
