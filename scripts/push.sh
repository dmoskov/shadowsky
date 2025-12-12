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

# Check if we're pushing to main
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" = "main" ]; then
    AMPLIFY_APP_ID="d1g6mni4b6812x"
    CLOUDFRONT_DISTRIBUTION_ID="E22AUQHZGDBNK"

    # Wait for Amplify deployment to complete before invalidating CloudFront
    echo ""
    echo "⏳ Waiting for Amplify deployment to complete..."

    # Get the commit we just pushed
    PUSHED_COMMIT=$(git rev-parse HEAD)
    echo "   Pushed commit: ${PUSHED_COMMIT:0:7}"

    # Give Amplify a moment to pick up the push and start the job
    sleep 10

    # Poll for deployment completion (max 5 minutes)
    MAX_ATTEMPTS=30
    ATTEMPT=0
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        # Get both status and commit ID of the latest job
        JOB_INFO=$(aws amplify list-jobs --app-id "$AMPLIFY_APP_ID" --branch-name main --max-items 1 --query "jobSummaries[0].[status,commitId]" --output text 2>/dev/null)
        STATUS=$(echo "$JOB_INFO" | awk '{print $1}')
        JOB_COMMIT=$(echo "$JOB_INFO" | awk '{print $2}')

        # Check if this is our commit
        if [ "$JOB_COMMIT" != "$PUSHED_COMMIT" ]; then
            echo "   Waiting for Amplify to pick up commit... (attempt $((ATTEMPT + 1))/$MAX_ATTEMPTS)"
            sleep 10
            ATTEMPT=$((ATTEMPT + 1))
            continue
        fi

        if [ "$STATUS" = "SUCCEED" ]; then
            echo "✅ Amplify deployment succeeded"
            break
        elif [ "$STATUS" = "FAILED" ] || [ "$STATUS" = "CANCELLED" ]; then
            echo "❌ Amplify deployment $STATUS - skipping CloudFront invalidation"
            break
        else
            echo "   Deployment status: $STATUS (attempt $((ATTEMPT + 1))/$MAX_ATTEMPTS)"
            sleep 10
            ATTEMPT=$((ATTEMPT + 1))
        fi
    done

    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "⚠️  Timed out waiting for Amplify - invalidating anyway"
    fi

    # Invalidate CloudFront cache
    if [ "$STATUS" != "FAILED" ] && [ "$STATUS" != "CANCELLED" ]; then
        echo "🌐 Invalidating CloudFront cache..."
        if aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*" > /dev/null 2>&1; then
            echo "✅ CloudFront cache invalidation started"
        else
            echo "⚠️  CloudFront invalidation failed - you may need to invalidate manually"
        fi
    fi

    # Check if any server files were changed in the last commit
    if git diff --name-only HEAD~1 HEAD | grep -q "^server/"; then
        echo ""
        echo "🐳 Server files changed - deploying to ECS..."
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        cd "$SCRIPT_DIR/../server" && ./deploy.sh
        echo "✅ Server deployment complete!"
    fi
fi