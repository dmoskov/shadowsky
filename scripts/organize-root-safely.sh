#!/bin/bash

# Safe Root Directory Organization Script
# This script carefully organizes files while preserving git history

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

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    print_error "You have uncommitted changes. Please commit or stash them first."
    echo "Run: git status"
    exit 1
fi

print_header "Safe Root Directory Organization"
echo "This script will organize ~80 files from root into logical directories"
echo "All moves use 'git mv' to preserve history"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 0
fi

# Create directory structure
print_header "Creating Directory Structure"

mkdir -p docs/{architecture,decisions,guides,handoff,migration/tailwind,analysis,features,progress}
mkdir -p scripts/{test,capture,utils}
mkdir -p tools/style-guides

print_success "Directory structure created"

# Move architecture docs
print_header "Moving Architecture Documentation"

for file in ARCHITECTURE_ANALYSIS.md COMPONENT_REFACTOR_PLAN.md CSS-ARCHITECTURE-PLAN.md SAFE_REFACTORING_PLAN.md CSS-AUDIT.md CSS-REFACTOR-SUMMARY.md; do
    if [ -f "$file" ]; then
        git mv "$file" docs/architecture/ 2>/dev/null && print_success "Moved $file" || print_warning "$file already moved or doesn't exist"
    fi
done

# Move decision docs
print_header "Moving Decision Documentation"

for file in DECISIONS.md PATTERNS.md METRICS.md; do
    if [ -f "$file" ]; then
        git mv "$file" docs/decisions/ 2>/dev/null && print_success "Moved $file" || print_warning "$file already moved or doesn't exist"
    fi
done

# Move guides
print_header "Moving Guides and How-tos"

for file in DEVELOPMENT_PROCESS.md TESTING_STRATEGY.md TEST_SCRIPTS_INVENTORY.md LIKE_BUTTON_DEBUG_GUIDE.md SHARE_LINK_FIX.md TODO_AUTH_FIXES.md RATE_LIMITING_SOLUTION.md SECURITY_IMPROVEMENTS.md manual-screenshot-guide.md; do
    if [ -f "$file" ]; then
        git mv "$file" docs/guides/ 2>/dev/null && print_success "Moved $file" || print_warning "$file already moved or doesn't exist"
    fi
done

# Move handoff docs
print_header "Moving Handoff Documentation"

for file in README-HANDOFF.md CLAUDE-HANDOFF.md CLEANUP_PLAN.md DISTINGUISHED_ENGINEER_ANALYSIS.md DISTINGUISHED_ENGINEER_AUDIT.md; do
    if [ -f "$file" ]; then
        git mv "$file" docs/handoff/ 2>/dev/null && print_success "Moved $file" || print_warning "$file already moved or doesn't exist"
    fi
done

# Move Tailwind migration docs
print_header "Moving Tailwind Migration Documentation"

for file in TAILWIND-*.md PRETTIER-TAILWIND-GUIDE.md; do
    if [ -f "$file" ]; then
        git mv "$file" docs/migration/tailwind/ 2>/dev/null && print_success "Moved $file" || print_warning "$file already moved or doesn't exist"
    fi
done

# Move migration reports
if [ -f "CREDENTIAL_MIGRATION_REPORT.json" ]; then
    git mv CREDENTIAL_MIGRATION_REPORT.json docs/migration/ 2>/dev/null && print_success "Moved CREDENTIAL_MIGRATION_REPORT.json"
fi

# Move analysis docs
print_header "Moving Analysis Documentation"

for file in FEED_AUDIT_AND_FIXES.md comprehensive-ui-ux-critique.md feed-design-critique.md feed-implementation-plan.md principal-engineer-implementation-plan.md thread-branch-diagram-ux-critique*.md thread-branch-implementation-plan*.md DESIGN-COMPARISON.md FEATURE-COMPARISON.md test-search-report.md; do
    if [ -f "$file" ]; then
        git mv "$file" docs/analysis/ 2>/dev/null && print_success "Moved $file" || print_warning "$file already moved or doesn't exist"
    fi
done

# Move feature docs
print_header "Moving Feature Documentation"

for file in ANALYTICS_*.md NETWORK_*.md THREAD-*.md THREAD_STYLING_CHANGES.md DESIGN-IMPLEMENTATION-PLAN.md DESIGN-IMPROVEMENTS-SUMMARY.md; do
    if [ -f "$file" ]; then
        git mv "$file" docs/features/ 2>/dev/null && print_success "Moved $file" || print_warning "$file already moved or doesn't exist"
    fi
done

# Move progress docs
print_header "Moving Progress Documentation"

for file in PROJECT_ORGANIZATION_REPORT.md REFACTORING_LOG.md IMPLEMENTATION_TRACKER.md; do
    if [ -f "$file" ]; then
        git mv "$file" docs/progress/ 2>/dev/null && print_success "Moved $file" || print_warning "$file already moved or doesn't exist"
    fi
done

# Move test scripts
print_header "Moving Test Scripts"

for file in test-*.mjs debug-*.mjs verify-*.mjs check-*.mjs; do
    if [ -f "$file" ]; then
        git mv "$file" scripts/test/ 2>/dev/null && print_success "Moved $file" || print_warning "$file already moved or doesn't exist"
    fi
done

# Move capture scripts
print_header "Moving Capture Scripts"

for file in capture-*.js capture-*.mjs; do
    if [ -f "$file" ]; then
        git mv "$file" scripts/capture/ 2>/dev/null && print_success "Moved $file" || print_warning "$file already moved or doesn't exist"
    fi
done

# Move utility files
print_header "Moving Utility Files"

if [ -f "fix-imports.cjs" ]; then
    git mv fix-imports.cjs scripts/utils/ 2>/dev/null && print_success "Moved fix-imports.cjs"
fi

# Move tool files
print_header "Moving Tool Files"

for file in screenshot-helper.html visual-comparison.html test-tailwind-*.html; do
    if [ -f "$file" ]; then
        git mv "$file" tools/ 2>/dev/null && print_success "Moved $file" || print_warning "$file already moved or doesn't exist"
    fi
done

for file in tailwind-style-guide.html tailwind-v4-test.css; do
    if [ -f "$file" ]; then
        git mv "$file" tools/style-guides/ 2>/dev/null && print_success "Moved $file" || print_warning "$file already moved or doesn't exist"
    fi
done

# Create a directory index
print_header "Creating Directory Index"

cat > docs/DIRECTORY_INDEX.md << 'EOF'
# Documentation Directory Index

## 📁 Directory Structure

### `/docs/architecture/`
Technical architecture documentation and plans
- Architecture analysis
- Component refactoring plans
- CSS architecture plans

### `/docs/decisions/`
Core project decision records
- DECISIONS.md - Architecture Decision Records (ADRs)
- PATTERNS.md - Development patterns and best practices
- METRICS.md - Performance and progress metrics

### `/docs/guides/`
How-to guides and documentation
- Development process
- Testing strategy
- Debug guides
- Fix documentation

### `/docs/handoff/`
Project handoff documentation
- README for new developers
- Claude AI instructions
- Cleanup plans
- Engineering audits

### `/docs/migration/`
Migration documentation and reports
- Tailwind CSS migration docs
- Credential migration report

### `/docs/analysis/`
Analysis and critique documents
- UI/UX critiques
- Feed analysis
- Implementation plans

### `/docs/features/`
Feature-specific documentation
- Analytics system
- Network health
- Thread improvements

### `/docs/progress/`
Progress tracking and logs
- Organization reports
- Refactoring logs
- Implementation tracking
EOF

print_success "Created docs/DIRECTORY_INDEX.md"

# Summary
print_header "Organization Complete!"

echo "📊 Summary:"
echo "- Moved ~80 documentation files to /docs"
echo "- Moved test scripts to /scripts/test"
echo "- Moved capture scripts to /scripts/capture"
echo "- Moved tools to /tools"
echo ""
echo "Root directory is now clean with only:"
echo "- Essential config files"
echo "- README.md"
echo "- CLAUDE.md"
echo "- SESSION_NOTES.md"
echo "- index.html"
echo "- setup-local-mac.sh"
echo ""
echo "✅ All moves preserved git history!"
echo ""
echo "Next steps:"
echo "1. Review the changes: git status"
echo "2. Commit the organization: git commit -m \"chore: organize root directory for clarity\""
echo "3. Update any scripts that reference moved files"