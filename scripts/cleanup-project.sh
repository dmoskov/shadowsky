#!/bin/bash

# Bluesky Client Project Cleanup Script
# This script cleans up development artifacts and organizes the project structure

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if we're in the project root
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    print_error "This script must be run from the BSKY project root directory"
    exit 1
fi

print_header "Bluesky Client Project Cleanup"
echo "This script will clean up development artifacts and organize the project"
echo "It will NOT delete any source code or important files"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# 1. Clean test artifacts
print_header "Cleaning Test Artifacts"

if [ -d "test-screenshots" ]; then
    rm -rf test-screenshots
    print_success "Removed test-screenshots directory"
fi

if [ -d "test-results" ]; then
    rm -rf test-results
    print_success "Removed test-results directory"
fi

if [ -d "playwright-report" ]; then
    rm -rf playwright-report
    print_success "Removed playwright-report directory"
fi

if [ -d "coverage" ]; then
    rm -rf coverage
    print_success "Removed coverage directory"
fi

# Remove individual screenshot files in tests directory
find tests -name "*.png" -type f -delete 2>/dev/null || true
print_success "Removed screenshot files from tests directory"

# 2. Organize documentation files
print_header "Organizing Documentation"

# Create docs directories if they don't exist
mkdir -p docs/architecture
mkdir -p docs/decisions
mkdir -p docs/progress

# Move documentation files
DOCS_TO_MOVE=(
    "ANALYTICS_*.md"
    "ARCHITECTURE_*.md"
    "COMPONENT_*.md"
    "CSS-*.md"
    "DESIGN-*.md"
    "FEED_*.md"
    "NETWORK_*.md"
    "SECURITY_*.md"
    "THREAD-*.md"
    "*-critique*.md"
    "*-implementation*.md"
)

for pattern in "${DOCS_TO_MOVE[@]}"; do
    for file in $pattern; do
        if [ -f "$file" ] && [ "$file" != "README.md" ] && [ "$file" != "CLAUDE.md" ]; then
            mv "$file" docs/ 2>/dev/null && print_success "Moved $file to docs/"
        fi
    done
done

# 3. Organize test scripts
print_header "Organizing Test Scripts"

mkdir -p scripts/test
mkdir -p scripts/analyze
mkdir -p scripts/capture

# Move test scripts
for file in test-*.mjs test-*.js; do
    if [ -f "$file" ]; then
        mv "$file" scripts/test/ 2>/dev/null && print_success "Moved $file to scripts/test/"
    fi
done

# Move analyze scripts
for file in scripts/analyze-*.mjs; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        mv "$file" scripts/analyze/"$filename" 2>/dev/null && print_success "Moved $filename to scripts/analyze/"
    fi
done

# Move capture scripts
for file in capture-*.js capture-*.mjs; do
    if [ -f "$file" ]; then
        mv "$file" scripts/capture/ 2>/dev/null && print_success "Moved $file to scripts/capture/"
    fi
done

# 4. Clean up node_modules if requested
print_header "Node Modules"
read -p "Remove node_modules to save space? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf node_modules
    print_success "Removed node_modules (run 'npm install' to restore)"
fi

# 5. Update .gitignore
print_header "Updating .gitignore"

# Check if patterns exist in .gitignore, add if not
GITIGNORE_PATTERNS=(
    "# Test artifacts"
    "test-screenshots/"
    "test-results/"
    "playwright-report/"
    "coverage/"
    "*.log"
    ""
    "# Local development"
    ".env.local"
    ".test-credentials"
    ""
    "# OS files"
    ".DS_Store"
    "Thumbs.db"
    ""
    "# IDE"
    ".idea/"
    ".vscode/"
    "*.swp"
)

for pattern in "${GITIGNORE_PATTERNS[@]}"; do
    if ! grep -q "^${pattern}$" .gitignore 2>/dev/null; then
        echo "$pattern" >> .gitignore
    fi
done
print_success "Updated .gitignore"

# 6. Create organized structure summary
print_header "Project Structure Summary"

cat > PROJECT_STRUCTURE.md << 'EOF'
# Bluesky Client Project Structure

## Source Code (`/src`)
- `components/` - React components organized by feature
- `services/` - AT Protocol service layer
- `hooks/` - Custom React hooks
- `contexts/` - React contexts
- `styles/` - CSS modules and design system
- `lib/` - Utilities and helpers
- `types/` - TypeScript definitions

## Documentation (`/docs`)
- `architecture/` - Architecture decisions and diagrams
- `decisions/` - ADRs (Architecture Decision Records)
- `progress/` - Development session logs

## Scripts (`/scripts`)
- `test/` - Test automation scripts
- `analyze/` - Analysis and comparison scripts
- `capture/` - Screenshot capture scripts

## Tests (`/tests`)
- `playwright/` - E2E test files
- Test fixtures and specs

## Configuration (root)
- Core files: package.json, tsconfig.json, vite.config.ts
- Documentation: README.md, CLAUDE.md
- Active notes: SESSION_NOTES.md, DECISIONS.md, PATTERNS.md
EOF

print_success "Created PROJECT_STRUCTURE.md"

# 7. Final summary
print_header "Cleanup Complete!"

echo "✅ Test artifacts removed"
echo "✅ Documentation organized"
echo "✅ Test scripts organized"
echo "✅ .gitignore updated"
echo ""
echo "📁 Project is now clean and organized!"
echo ""
echo "Next steps:"
echo "1. Review the changes with 'git status'"
echo "2. Commit the cleanup: 'git add . && git commit -m \"chore: organize project structure\"'"
echo "3. If you removed node_modules, run 'npm install' to restore dependencies"