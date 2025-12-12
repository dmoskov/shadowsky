#!/bin/bash

# Push script with pre-push checks
# This script runs formatting checks and build tests before pushing to ensure code quality

set -e  # Exit on any error

echo "🔍 Running pre-push checks..."

# Check if there are any uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: You have uncommitted changes. Please commit or stash them before pushing."
    exit 1
fi

# Run format check
echo "📝 Checking code formatting..."
if ! npm run test:format; then
    echo "❌ Formatting issues detected!"
    echo "💡 Run 'npm run fix:format' to fix formatting issues automatically"
    exit 1
fi

# Run linter
echo "🔍 Running linter..."
if ! npm run test:lint; then
    echo "❌ Linting issues detected!"
    echo "💡 Run 'npm run fix:lint' to fix some issues automatically"
    echo "💡 Note: Some issues may require manual fixes"
    exit 1
fi

# Run build
echo "🔨 Testing build..."
if ! npm run build; then
    echo "❌ Build failed!"
    exit 1
fi

# All checks passed, proceed with push
echo "✅ All checks passed!"
echo "🚀 Pushing to remote..."

# Push with all arguments passed to the script
git push "$@"

echo "✅ Push completed successfully!"

# Check if we're pushing to main and if server files changed
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" = "main" ]; then
    # Check if any server files were changed in the last commit
    if git diff --name-only HEAD~1 HEAD | grep -q "^server/"; then
        echo ""
        echo "🐳 Server files changed - deploying to ECS..."
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        cd "$SCRIPT_DIR/../server" && ./deploy.sh
        echo "✅ Server deployment complete!"
    fi
fi