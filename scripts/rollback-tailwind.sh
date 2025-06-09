#!/bin/bash

echo "🔄 Rolling back Tailwind CSS installation"
echo "========================================"
echo ""

# Confirm rollback
echo "⚠️  This will remove Tailwind CSS and restore the previous state."
echo "Are you sure you want to proceed? (y/N)"
read -r response

if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 0
fi

echo ""
echo "📦 Removing Tailwind packages..."
npm uninstall tailwindcss postcss autoprefixer

echo ""
echo "🗑️  Removing Tailwind configuration files..."
rm -f tailwind.config.js
rm -f postcss.config.js
rm -f src/styles/tailwind.css

echo ""
echo "📝 Removing Tailwind import from index.css..."
# Remove the Tailwind import lines
sed -i '' '/Import Tailwind CSS/,/tailwind.css/d' src/index.css

echo ""
echo "🧹 Cleaning up any generated files..."
rm -f capture-baseline-simple.mjs
rm -rf tests/visual-baseline-simple

echo ""
echo "✅ Rollback complete!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev' to verify the app still works"
echo "2. Check git status to see all changes"
echo "3. Consider running 'git checkout -- .' to fully restore"