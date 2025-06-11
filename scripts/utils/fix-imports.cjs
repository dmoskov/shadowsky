const fs = require('fs');
const path = require('path');

// Map of components that have moved
const componentMoves = {
  // From feed components referencing thread components
  './ParentPost': '../thread/ParentPost',
  './ReplyContext': '../ui/ReplyContext',
  './ErrorBoundary': '../core/ErrorBoundary',
  './PostCard': '../feed/PostCard',
  './CompactPostCard': '../feed/CompactPostCard',
  './EmptyStates': '../ui/EmptyStates',
  './SkeletonLoaders': '../ui/SkeletonLoaders',
  './ComposeModal': '../modals/ComposeModal',
  './FollowersModal': '../modals/FollowersModal',
};

// Function to fix imports in a file
function fixImports(filePath) {
  console.log(`Fixing imports in: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Fix relative imports that need to go up one more level
  // Components are now one level deeper, so ../ becomes ../../
  if (filePath.includes('/components/') && !filePath.includes('/components/index.ts')) {
    content = content.replace(/from ['"]\.\.\/contexts/g, (match) => {
      modified = true;
      return `from '../../contexts`;
    });
    
    content = content.replace(/from ['"]\.\.\/hooks/g, (match) => {
      modified = true;
      return `from '../../hooks`;
    });
    
    content = content.replace(/from ['"]\.\.\/services/g, (match) => {
      modified = true;
      return `from '../../services`;
    });
    
    content = content.replace(/from ['"]\.\.\/lib/g, (match) => {
      modified = true;
      return `from '../../lib`;
    });
    
    content = content.replace(/from ['"]\.\.\/types/g, (match) => {
      modified = true;
      return `from '../../types`;
    });
    
    content = content.replace(/from ['"]\.\.\/utils/g, (match) => {
      modified = true;
      return `from '../../utils`;
    });
  }

  // Fix component references
  Object.entries(componentMoves).forEach(([oldPath, newPath]) => {
    const regex = new RegExp(`from ['"]${oldPath.replace('.', '\\.')}['"]`, 'g');
    if (content.includes(oldPath)) {
      content = content.replace(regex, `from '${newPath}'`);
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✓ Fixed imports`);
  } else {
    console.log(`  - No changes needed`);
  }
}

// Get all TypeScript files in components subdirectories
const componentsDir = path.join(__dirname, 'src/components');
const subdirs = ['core', 'feed', 'thread', 'modals', 'profile', 'ui'];

subdirs.forEach(subdir => {
  const dir = path.join(componentsDir, subdir);
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      if (file.endsWith('.tsx')) {
        fixImports(path.join(dir, file));
      }
    });
  }
});

console.log('\n✅ Import fixing complete!');