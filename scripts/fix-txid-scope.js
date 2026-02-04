// Fix txId scope issues - remove apiLog calls where txId is not in scope
const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'app', 'api');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;
  
  // Check if file has txId definition
  const hasTxIdDef = content.includes('const txId = await apiLog.start');
  
  // If no txId definition but has apiLog.success/failure, remove them
  if (!hasTxIdDef && (content.includes('apiLog.success(txId') || content.includes('apiLog.failure(txId'))) {
    content = content.replace(/\s*apiLog\.success\(txId[^;]*;\s*/g, '\n    ');
    content = content.replace(/\s*apiLog\.failure\(txId[^;]*;\s*/g, '\n    ');
    modified = true;
  }
  
  // Fix: apiLog.start with wrong parameter name (req instead of request)
  if (content.includes("apiLog.start('") && content.includes(', req)')) {
    content = content.replace(/apiLog\.start\('([^']+)',\s*req\)/g, "apiLog.start('$1', request)");
    modified = true;
  }
  
  // Fix: Remove apiLog calls that reference undefined 'request' in functions using 'req'
  // Check if function uses 'req' parameter
  const usesReq = /function\s+\w+\s*\(\s*req\s*[,:)]/m.test(content);
  if (usesReq && content.includes("apiLog.start('") && content.includes(', request)')) {
    // Change request to req
    content = content.replace(/apiLog\.start\('([^']+)',\s*request\)/g, "apiLog.start('$1', req)");
    modified = true;
  }
  
  // Fix: Functions that use Request instead of NextRequest
  // These can't use apiLog.start properly, remove the calls
  if (content.includes('Request,') && !content.includes('NextRequest') && content.includes('apiLog.start')) {
    // Remove apiLog.start line
    content = content.replace(/\s*const txId = await apiLog\.start\([^)]+\);\s*\n?\s*/g, '\n  ');
    content = content.replace(/\s*apiLog\.success\(txId[^;]*;\s*/g, '\n    ');
    content = content.replace(/\s*apiLog\.failure\(txId[^;]*;\s*/g, '\n    ');
    // Remove import if no longer needed
    if (!content.includes('apiLog.')) {
      content = content.replace(/import \{ apiLog \} from '@\/lib\/logging';\s*\n/g, '');
    }
    modified = true;
  }
  
  if (modified && content !== originalContent) {
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

console.log('🔧 Fixing txId scope issues...\n');

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
