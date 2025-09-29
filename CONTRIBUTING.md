# Contributing to ShadowSky

## Welcome Contributors!

Thank you for your interest in contributing to ShadowSky! This document provides guidelines and instructions for contributing to the project. Please read through this guide before submitting your first contribution.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Development Workflow](#development-workflow)
5. [Code Standards](#code-standards)
6. [Testing Guidelines](#testing-guidelines)
7. [Submitting Changes](#submitting-changes)
8. [Release Process](#release-process)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors. We expect all participants to:

- Be respectful and considerate
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Show empathy towards other community members

### Unacceptable Behavior

- Harassment or discriminatory language
- Personal attacks
- Trolling or insulting comments
- Public or private harassment

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** installed
- **npm** or **yarn** package manager
- **Git** for version control
- **Bluesky account** for testing
- **Code editor** (VS Code recommended)

### First Steps

1. **Fork the Repository**

   ```bash
   # Fork via GitHub UI, then clone your fork
   git clone https://github.com/YOUR_USERNAME/shadowsky.git
   cd shadowsky
   ```

2. **Set Up Upstream**

   ```bash
   git remote add upstream https://github.com/original/shadowsky.git
   git fetch upstream
   ```

3. **Install Dependencies**

   ```bash
   npm install
   ```

4. **Create Environment File**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   # Opens at http://localhost:5174
   ```

## Development Setup

### Recommended IDE Setup

#### VS Code Extensions

- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Tailwind CSS IntelliSense**: CSS utilities
- **TypeScript Vue Plugin**: TypeScript support
- **GitLens**: Git integration

#### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

### Browser Extensions

- **React Developer Tools**: Component debugging
- **Redux DevTools**: State inspection (for React Query)

### Debug Mode

Enable verbose logging in browser console:

```javascript
window.enableDebug();
```

## Development Workflow

### 1. Choose an Issue

- Check [open issues](https://github.com/shadowsky/issues)
- Look for `good first issue` or `help wanted` labels
- Comment on the issue to claim it
- Wait for maintainer approval before starting

### 2. Create a Feature Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test improvements
- `perf/` - Performance improvements

### 3. Make Your Changes

#### Before Coding

1. Read existing code in the area you're modifying
2. Check `ARCHITECTURE.md` for system design
3. Review `CONTEXT.md` for domain knowledge
4. Look at similar features for patterns

#### While Coding

1. Follow existing patterns and conventions
2. Write clear, self-documenting code
3. Add comments for complex logic
4. Update types as needed
5. Consider mobile responsiveness
6. Test with both storage types

#### After Coding

1. Remove debug console.log statements
2. Run formatting and linting
3. Ensure tests pass
4. Update documentation if needed

### 4. Test Your Changes

```bash
# Run all tests and checks
npm run test

# Individual test commands
npm run test:unit        # Unit tests
npm run test:format      # Format check
npm run test:lint        # Lint check
npm run test:types       # Type check

# Fix issues automatically
npm run fix             # Fix all
npm run fix:format      # Fix formatting
npm run fix:lint        # Fix linting
```

### 5. Commit Your Changes

#### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or fixes
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes

#### Examples

```bash
# Feature
git commit -m "feat(bookmarks): add search functionality

- Implement full-text search for bookmarks
- Add search UI component
- Update bookmark service with search method

Closes #123"

# Bug fix
git commit -m "fix(auth): resolve session refresh loop

Session was refreshing infinitely due to incorrect
token expiry check. Now properly validates expiry
time before attempting refresh.

Fixes #456"

# Documentation
git commit -m "docs: update setup instructions

Add troubleshooting section for common setup issues"
```

### 6. Push Your Changes

Use the provided push script for safety checks:

```bash
# Runs format check and build before pushing
./scripts/push.sh

# Or manually
npm run test:format
npm run build
git push origin feature/your-feature-name
```

## Code Standards

### TypeScript Guidelines

#### Type Safety

```typescript
// ✅ Good: Explicit types
function processBookmark(bookmark: Bookmark): ProcessedBookmark {
  return { ...bookmark, processed: true };
}

// ❌ Bad: Using any
function processBookmark(bookmark: any): any {
  return { ...bookmark, processed: true };
}
```

#### Null Handling

```typescript
// ✅ Good: Explicit null checks
function getUsername(user: User | null): string {
  return user?.name ?? "Anonymous";
}

// ❌ Bad: Assuming non-null
function getUsername(user: User): string {
  return user.name; // Can crash if user is null
}
```

### React Guidelines

#### Component Structure

```typescript
// ✅ Good: Clear component structure
export function BookmarkCard({ bookmark, onDelete }: BookmarkCardProps) {
  // Hooks first
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuth();

  // Event handlers
  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(bookmark.id);
  };

  // Render
  return (
    <div className="bookmark-card">
      {/* JSX */}
    </div>
  );
}
```

#### Hooks Rules

```typescript
// ✅ Good: Consistent hook usage
function Component() {
  const [state, setState] = useState();
  const data = useData();

  useEffect(() => {
    // Effect logic
  }, [data]);
}

// ❌ Bad: Conditional hooks
function Component({ condition }) {
  if (condition) {
    const [state, setState] = useState(); // ERROR!
  }
}
```

### CSS/Styling Guidelines

#### Tailwind Classes

```typescript
// ✅ Good: Organized Tailwind classes
<div className="
  flex items-center justify-between
  p-4 mx-2
  bg-white dark:bg-gray-800
  rounded-lg shadow-md
  hover:shadow-lg transition-shadow
">

// ❌ Bad: Unorganized classes
<div className="shadow-md p-4 flex dark:bg-gray-800 mx-2 hover:shadow-lg bg-white items-center rounded-lg transition-shadow justify-between">
```

### Error Handling

```typescript
// ✅ Good: Comprehensive error handling
try {
  const result = await riskyOperation();
  return { success: true, data: result };
} catch (error) {
  logger.error("Operation failed", error);

  // User-friendly message
  toast.error("Unable to complete operation. Please try again.");

  // Re-throw or return error state
  return { success: false, error };
}

// ❌ Bad: Silent failures
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  // Silent failure - user won't know something went wrong
  return null;
}
```

## Testing Guidelines

### Unit Tests

#### What to Test

- Pure functions and utilities
- Service business logic
- Custom hooks
- Component rendering
- User interactions

#### Test Structure

```typescript
describe("BookmarkService", () => {
  let service: BookmarkService;

  beforeEach(() => {
    service = new BookmarkService();
  });

  describe("add", () => {
    it("should add bookmark successfully", async () => {
      const bookmark = createMockBookmark();
      await service.add(bookmark);

      const bookmarks = await service.getAll();
      expect(bookmarks).toContainEqual(bookmark);
    });

    it("should throw error for invalid bookmark", async () => {
      const invalid = { uri: null };

      await expect(service.add(invalid)).rejects.toThrow("Invalid bookmark");
    });
  });
});
```

### Integration Tests

Test complete user flows:

```typescript
it("should complete bookmark flow", async () => {
  // Login
  await loginUser("test@example.com", "password");

  // Navigate to post
  await navigateToPost("post-123");

  // Add bookmark
  await clickBookmarkButton();

  // Verify bookmark saved
  await navigateToBookmarks();
  expect(screen.getByText("Post content")).toBeInTheDocument();
});
```

### Test Coverage Goals

- **Utilities**: 90%+ coverage
- **Services**: 80%+ coverage
- **Components**: 70%+ coverage
- **Critical paths**: 100% coverage

## Submitting Changes

### Pull Request Process

1. **Update Your Branch**

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Create Pull Request**
   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Select your branch
   - Fill out PR template

3. **PR Title Format**

   ```
   [Type] Brief description

   Examples:
   [Feature] Add bookmark search functionality
   [Fix] Resolve infinite scroll bug in timeline
   [Docs] Update installation instructions
   ```

4. **PR Description Template**

   ```markdown
   ## Description

   Brief description of changes

   ## Type of Change

   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing

   - [ ] Unit tests pass
   - [ ] Manual testing completed
   - [ ] No console errors

   ## Checklist

   - [ ] Code follows style guidelines
   - [ ] Self-review completed
   - [ ] Documentation updated
   - [ ] No debug code left

   ## Screenshots (if UI changes)

   Before: [screenshot]
   After: [screenshot]

   Closes #issue_number
   ```

### Code Review Process

1. **Automated Checks**
   - CI/CD runs tests
   - Format and lint checks
   - Build verification

2. **Manual Review**
   - Code quality review
   - Architecture compliance
   - Performance impact
   - Security considerations

3. **Feedback Integration**
   - Address review comments
   - Update PR if needed
   - Re-request review

4. **Merge**
   - Maintainer approves
   - CI passes
   - Merged to main

### After Merge

1. **Delete Feature Branch**

   ```bash
   git branch -d feature/your-feature
   git push origin --delete feature/your-feature
   ```

2. **Update Local Main**
   ```bash
   git checkout main
   git pull upstream main
   ```

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features
- **PATCH**: Bug fixes

### Release Cycle

- **Weekly**: Patch releases for bug fixes
- **Bi-weekly**: Minor releases for features
- **Quarterly**: Major releases if needed

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Release notes prepared
- [ ] Migration guide (if breaking changes)

## Getting Help

### Resources

- **Documentation**: Start with README.md
- **Architecture**: Review ARCHITECTURE.md
- **Context**: Read CONTEXT.md for domain knowledge
- **Issues**: Check existing issues and discussions

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Discord**: Real-time chat (if available)

### Asking Questions

When asking for help, provide:

1. Clear problem description
2. Steps to reproduce
3. Expected vs actual behavior
4. Environment details
5. Error messages/logs

## Recognition

Contributors are recognized in:

- CONTRIBUTORS.md file
- Release notes
- Project README

## Tips for Success

### Do's

- ✅ Read documentation before starting
- ✅ Follow existing patterns
- ✅ Write tests for new features
- ✅ Update documentation
- ✅ Be patient with review process
- ✅ Ask questions when unsure

### Don'ts

- ❌ Submit large PRs without discussion
- ❌ Include unrelated changes
- ❌ Skip testing
- ❌ Leave debug code
- ❌ Ignore review feedback
- ❌ Break existing functionality

## Thank You!

Your contributions make ShadowSky better for everyone. We appreciate your time and effort in improving the project!

---

_This guide is subject to updates. Always check for the latest version before contributing._
