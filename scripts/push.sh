#!/bin/bash

# Push script with pre-push checks
# This script runs formatting checks and build tests before pushing to ensure code quality
#
# Prod branch elimination (Phase 1): main now invalidates both CloudFront distributions
# (main.shadowsky.io AND shadowsky.io) to support single-branch deployment.

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
AMPLIFY_APP_ID="d1g6mni4b6812x"

# CloudFront distribution IDs
CF_DIST_MAIN="E1FRQ5R58RZE6C"    # main.shadowsky.io
CF_DIST_PROD="E22AUQHZGDBNK"     # shadowsky.io (production)

if [ "$CURRENT_BRANCH" = "main" ]; then
    DEPLOY_URL="https://shadowsky.io"
elif [ "$CURRENT_BRANCH" = "prod" ]; then
    echo "⚠️  The 'prod' branch is deprecated. Please use 'main' for all deployments."
    echo "   Proceeding with deployment, but consider switching to main."
    DEPLOY_URL="https://shadowsky.io"
else
    echo "ℹ️  Branch '$CURRENT_BRANCH' - skipping Amplify/CloudFront checks"
    exit 0
fi

# Wait for Amplify deployment to complete before invalidating CloudFront
echo ""
echo "⏳ Waiting for Amplify deployment to complete..."
echo "   Branch: $CURRENT_BRANCH → $DEPLOY_URL"

# Get the commit we just pushed
PUSHED_COMMIT=$(git rev-parse HEAD)
echo "   Pushed commit: ${PUSHED_COMMIT:0:7}"

# Give Amplify a moment to pick up the push and start the job
sleep 10

# Poll for deployment completion (max 5 minutes)
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    # Get status and commit ID of the latest job (filter out pagination "None")
    JOB_INFO=$(aws amplify list-jobs --app-id "$AMPLIFY_APP_ID" --branch-name "$CURRENT_BRANCH" --max-items 1 --query "jobSummaries[0].[status,commitId]" --output text 2>/dev/null | head -1)
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
        echo "❌ Amplify deployment $STATUS"
        echo "   View logs: https://console.aws.amazon.com/amplify/home#/d1g6mni4b6812x/$CURRENT_BRANCH"
        exit 1
    else
        echo "   Deployment status: $STATUS (attempt $((ATTEMPT + 1))/$MAX_ATTEMPTS)"
        sleep 10
        ATTEMPT=$((ATTEMPT + 1))
    fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "⚠️  Timed out waiting for Amplify deployment"
    echo "   Check status: https://console.aws.amazon.com/amplify/home#/d1g6mni4b6812x/$CURRENT_BRANCH"
    exit 1
fi

# Invalidate CloudFront caches
# Phase 1 prod elimination: main invalidates BOTH distributions
if [ "$CURRENT_BRANCH" = "main" ]; then
    echo "🌐 Invalidating CloudFront caches (main serves both distributions)..."

    # Invalidate main.shadowsky.io
    echo "   → main.shadowsky.io ($CF_DIST_MAIN)"
    if INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id "$CF_DIST_MAIN" --paths "/*" --query "Invalidation.Id" --output text 2>&1); then
        echo "   ✅ Invalidation started (ID: $INVALIDATION_ID)"
    else
        echo "   ❌ CloudFront invalidation failed for main.shadowsky.io:"
        echo "      $INVALIDATION_ID"
        exit 1
    fi

    # Invalidate shadowsky.io (production)
    echo "   → shadowsky.io ($CF_DIST_PROD)"
    if INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id "$CF_DIST_PROD" --paths "/*" --query "Invalidation.Id" --output text 2>&1); then
        echo "   ✅ Invalidation started (ID: $INVALIDATION_ID)"
    else
        echo "   ❌ CloudFront invalidation failed for shadowsky.io:"
        echo "      $INVALIDATION_ID"
        exit 1
    fi
elif [ "$CURRENT_BRANCH" = "prod" ]; then
    # Legacy prod branch support (deprecated)
    echo "🌐 Invalidating CloudFront cache ($CF_DIST_PROD)..."
    if INVALIDATION_ID=$(aws cloudfront create-invalidation --distribution-id "$CF_DIST_PROD" --paths "/*" --query "Invalidation.Id" --output text 2>&1); then
        echo "✅ CloudFront cache invalidation started (ID: $INVALIDATION_ID)"
    else
        echo "❌ CloudFront invalidation failed:"
        echo "   $INVALIDATION_ID"
        exit 1
    fi
fi

# Check if any server files were changed in the last commit (only on main)
if [ "$CURRENT_BRANCH" = "main" ]; then
    if git diff --name-only HEAD~1 HEAD | grep -q "^server/"; then
        echo ""
        echo "🐳 Server files changed - deploying to ECS..."
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        cd "$SCRIPT_DIR/../server" && ./deploy.sh
        echo "✅ Server deployment complete!"
    fi
fi

echo ""
echo "🎉 Deployment complete! View at: $DEPLOY_URL"
