#!/bin/bash

# Bluesky Client - Local Development Setup for macOS
# This script sets up everything needed to run the Bluesky client locally

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

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS only"
    exit 1
fi

print_header "Bluesky Client Local Development Setup"
echo "This script will set up your macOS machine for Bluesky client development"
echo "It will check for and install necessary dependencies"
echo

# Check for Homebrew
print_header "Checking for Homebrew"
if ! command -v brew &> /dev/null; then
    print_warning "Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon Macs
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    print_success "Homebrew installed"
else
    print_success "Homebrew found"
    brew update
fi

# Check for Node.js
print_header "Checking for Node.js"
if ! command -v node &> /dev/null; then
    print_warning "Node.js not found. Installing via Homebrew..."
    brew install node@18
    print_success "Node.js installed"
else
    NODE_VERSION=$(node -v)
    print_success "Node.js found: $NODE_VERSION"
    
    # Check if version is 18+
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1 | sed 's/v//')
    if [ $MAJOR_VERSION -lt 18 ]; then
        print_warning "Node.js version is less than 18. Updating..."
        brew upgrade node
    fi
fi

# Check for npm
print_header "Checking for npm"
if ! command -v npm &> /dev/null; then
    print_error "npm not found. This should have been installed with Node.js"
    exit 1
else
    NPM_VERSION=$(npm -v)
    print_success "npm found: $NPM_VERSION"
fi

# Check for Git
print_header "Checking for Git"
if ! command -v git &> /dev/null; then
    print_warning "Git not found. Installing via Homebrew..."
    brew install git
    print_success "Git installed"
else
    GIT_VERSION=$(git --version)
    print_success "Git found: $GIT_VERSION"
fi

# Clone repository if not already in project directory
if [ ! -f "package.json" ]; then
    print_header "Setting up project"
    print_warning "Not in project directory. Please run this script from the BSKY project root."
    echo "If you haven't cloned the repository yet, run:"
    echo "  git clone <repository-url>"
    echo "  cd BSKY"
    echo "  ./setup-local-mac.sh"
    exit 1
fi

# Install project dependencies
print_header "Installing project dependencies"
print_warning "This may take a few minutes..."
npm install
print_success "Dependencies installed"

# Set up environment variables
print_header "Setting up environment variables"
if [ ! -f ".env.local" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        print_success "Created .env.local from .env.example"
        print_warning "Please edit .env.local to add your test credentials (optional)"
    else
        # Create a basic .env.local file
        cat > .env.local << EOF
# Bluesky Client Environment Variables
# Add your test account credentials here (optional)
# VITE_TEST_IDENTIFIER=your-test-account@email.com
# VITE_TEST_PASSWORD=your-test-password

# Analytics Settings
VITE_ANALYTICS_ENABLED=true
VITE_ANALYTICS_SAMPLE_RATE=1.0

# Development Settings
VITE_DEBUG_MODE=false
EOF
        print_success "Created .env.local with defaults"
        print_warning "Add test credentials to .env.local if you want to run automated tests"
    fi
else
    print_success ".env.local already exists"
fi

# Create necessary directories
print_header "Creating project directories"
mkdir -p test-screenshots
mkdir -p test-results
mkdir -p coverage
print_success "Directories created"

# Set up git hooks (optional)
print_header "Setting up Git hooks"
if [ -d ".git" ]; then
    # Create pre-commit hook to check for credentials
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook to check for hardcoded credentials

# Check for common credential patterns
if git diff --cached --name-only | xargs grep -E "(password|passwd|pwd|secret|api_key|apikey|token)" | grep -v "\.env\.example" | grep -v "test-credentials\.ts"; then
    echo "⚠️  Warning: Possible hardcoded credentials detected!"
    echo "Please review your changes and use environment variables instead."
    echo "To bypass this check (not recommended), use: git commit --no-verify"
    exit 1
fi
EOF
    chmod +x .git/hooks/pre-commit
    print_success "Git hooks installed"
else
    print_warning "Not a git repository, skipping git hooks"
fi

# Install optional development tools
print_header "Optional Development Tools"
echo "The following tools are recommended but not required:"
echo

# Check for VSCode
if command -v code &> /dev/null; then
    print_success "Visual Studio Code found"
else
    echo "- Visual Studio Code: brew install --cask visual-studio-code"
fi

# Check for Chrome
if [ -d "/Applications/Google Chrome.app" ]; then
    print_success "Google Chrome found"
else
    echo "- Google Chrome: brew install --cask google-chrome"
fi

# Database setup information
print_header "Database Information"
echo "This project uses IndexedDB for client-side analytics storage."
echo "No additional database setup is required!"
echo
echo "Analytics data is stored in the browser and includes:"
echo "- Post engagement metrics"
echo "- Follower growth tracking"
echo "- Content performance analytics"
echo
print_warning "Note: Analytics data is client-side only and will be lost if browser data is cleared"

# Final instructions
print_header "Setup Complete! 🎉"
echo
echo "To start developing:"
echo "  1. Start the development server:"
echo "     ${GREEN}npm run dev${NC}"
echo
echo "  2. Open your browser to:"
echo "     ${GREEN}http://127.0.0.1:5173${NC}"
echo "     (Note: Use 127.0.0.1 instead of localhost for Safari compatibility)"
echo
echo "  3. Log in with your Bluesky account"
echo
echo "Additional commands:"
echo "  - Run tests: ${YELLOW}npm test${NC}"
echo "  - Build for production: ${YELLOW}npm run build${NC}"
echo "  - Check types: ${YELLOW}npm run type-check${NC}"
echo "  - Lint code: ${YELLOW}npm run lint${NC}"
echo
echo "For test automation, add credentials to .env.local:"
echo "  VITE_TEST_IDENTIFIER=your-test-account@email.com"
echo "  VITE_TEST_PASSWORD=your-test-password"
echo
print_success "Happy coding! 🚀"

# Make this script executable for future runs
chmod +x setup-local-mac.sh