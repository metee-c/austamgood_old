// Fix broken imports caused by wrap script
const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'app', 'api');

// Pattern to find broken imports like:
// import {
// import { apiLog } from '@/lib/logging'; NextRequest, NextResponse } from 'next/server';
const BROKEN_PATTERN = /import \{\s*\nimport \{ apiLog \} from '@\/lib\/logging'; ([^}]+)\} from/g;

// Also fix inline broken pattern
const BROKEN_INLINE_PATTERN = /import \{\s*import \{ apiLog \} from '@\/lib\/logging'; ([^}]+)\} from/g;

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check for broken pattern
  if (content.includes("import { apiLog } from '@/lib/logging';") && 
      content.includes("import {\nimport { apiLog }")) {
    // Fix multi-line broken import
    content = content.replace(
      /import \{\s*\nimport \{ apiLog \} from '@\/lib\/logging'; /g,
      "import { apiLog } from '@/lib/logging';\nimport { "
    );
    modified = true;
  }
  
  // Fix inline broken import
  if (content.includes("import {\nimport { apiLog } from '@/lib/logging';")) {
    content = content.replace(
      /import \{\s*\nimport \{ apiLog \} from '@\/lib\/logging'; /g,
      "import { apiLog } from '@/lib/logging';\nimport { "
    );
    modified = true;
  }
  
  // Another pattern: import on same line
  if (content.includes("import { apiLog } from '@/lib/logging'; NextRequest")) {
    content = content.replace(
      /import \{ apiLog \} from '@\/lib\/logging'; (NextRequest[^}]+\} from)/g,
      "import { apiLog } from '@/lib/logging';\nimport { $1"
    );
    modified = true;
  }
  
  // Fix pattern where import was inserted in middle of another import
  const brokenImportRegex = /import \{([^}]*?)import \{ apiLog \} from '@\/lib\/logging';([^}]*?)\} from/g;
  if (brokenImportRegex.test(content)) {
    content = content.replace(brokenImportRegex, (match, before, after) => {
      return `import { apiLog } from '@/lib/logging';\nimport {${before}${after}} from`;
    });
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
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

console.log('🔧 Fixing broken imports...\n');

const routeFiles = findRouteFiles(API_DIR);
let fixed = 0;

for (const file of routeFiles) {
  const relativePath = file.replace(API_DIR, '').replace(/\\/g, '/').slice(1);
  if (fixFile(file)) {
    console.log(`✅ Fixed: ${relativePath}`);
    fixed++;
  }
}

console.log(`\n========================================`);
console.log(`Fixed ${fixed} files`);
console.log(`========================================`);
