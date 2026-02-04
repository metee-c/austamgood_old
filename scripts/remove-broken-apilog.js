// Remove all broken apiLog calls - clean slate approach
const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'app', 'api');

// Files that were manually wrapped correctly - don't touch these
const KEEP_FILES = [
  'stock-adjustments/route.ts',
  'stock-adjustments/[id]/approve/route.ts',
  'stock-adjustments/[id]/complete/route.ts',
  'stock-adjustments/[id]/submit/route.ts',
  'stock-adjustments/[id]/cancel/route.ts',
  'stock-adjustments/[id]/reject/route.ts',
  'moves/route.ts',
  'moves/quick-move/route.ts',
  'receives/route.ts',
  'receives/[id]/route.ts',
  'orders/[id]/rollback/route.ts',
  'auth/logout/route.ts',
];

function cleanFile(filePath) {
  const relativePath = filePath.replace(API_DIR, '').replace(/\\/g, '/').slice(1);
  
  // Skip files that were manually wrapped correctly
  if (KEEP_FILES.some(f => relativePath.endsWith(f))) {
    return { status: 'kept', reason: 'manually wrapped' };
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Check if file has apiLog
  if (!content.includes('apiLog')) {
    return { status: 'skipped', reason: 'no apiLog' };
  }
  
  // Remove all apiLog related code
  // 1. Remove apiLog.start lines
  content = content.replace(/^\s*const txId = await apiLog\.start\([^)]+\);\s*\n?\s*/gm, '');
  
  // 2. Remove apiLog.success lines
  content = content.replace(/^\s*apiLog\.success\([^)]+\);\s*$/gm, '');
  
  // 3. Remove apiLog.failure lines  
  content = content.replace(/^\s*apiLog\.failure\([^)]+\);\s*$/gm, '');
  
  // 4. Remove apiLog import
  content = content.replace(/import \{ apiLog \} from '@\/lib\/logging';\s*\n/g, '');
  
  // Clean up extra blank lines
  content = content.replace(/\n{3,}/g, '\n\n');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return { status: 'cleaned' };
  }
  
  return { status: 'skipped', reason: 'no changes needed' };
}

function findRouteFiles(dir) {
  const files = [];
  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === 'route.ts') {
        files.push(fullPath);
      }
    }
  }
  walk(dir);
  return files;
}

console.log('🧹 Removing broken apiLog calls (keeping manually wrapped files)...\n');

const routeFiles = findRouteFiles(API_DIR);
let cleaned = 0;
let kept = 0;

for (const file of routeFiles) {
  const relativePath = file.replace(API_DIR, '').replace(/\\/g, '/').slice(1);
  const result = cleanFile(file);
  
  if (result.status === 'cleaned') {
    console.log(`🧹 Cleaned: ${relativePath}`);
    cleaned++;
  } else if (result.status === 'kept') {
    console.log(`✅ Kept: ${relativePath}`);
    kept++;
  }
}

console.log(`\n========================================`);
console.log(`🧹 Cleaned: ${cleaned} files`);
console.log(`✅ Kept: ${kept} files (manually wrapped)`);
console.log(`========================================`);
