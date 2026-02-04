// Comprehensive fix for all apiLog issues
const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'app', 'api');

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Issue 1: apiLog.success/failure with txId but txId not defined in that scope
  // Remove orphaned apiLog calls where txId is referenced but not defined nearby
  
  // Check if file has apiLog import
  if (!content.includes("from '@/lib/logging'")) {
    return false;
  }
  
  // Check if txId is properly defined
  const hasTxIdDef = content.includes('const txId = await apiLog.start');
  
  // If has apiLog.success/failure but no txId definition, remove those calls
  if (!hasTxIdDef) {
    content = content.replace(/^\s*apiLog\.success\(txId[^;]*;\s*$/gm, '');
    content = content.replace(/^\s*apiLog\.failure\(txId[^;]*;\s*$/gm, '');
    
    // Also remove the start call if it references undefined request
    content = content.replace(/^\s*const txId = await apiLog\.start\([^)]+\);\s*\n?\s*$/gm, '');
    
    // Remove import if no longer used
    if (!content.includes('apiLog.')) {
      content = content.replace(/import \{ apiLog \} from '@\/lib\/logging';\s*\n/g, '');
    }
  }
  
  // Issue 2: POST() without request parameter but apiLog.start uses request
  // Pattern: export async function POST() { ... apiLog.start('X', request)
  const noParamPostMatch = content.match(/export\s+async\s+function\s+POST\s*\(\s*\)\s*\{/);
  if (noParamPostMatch && content.includes("apiLog.start('")) {
    // Add request parameter
    content = content.replace(
      /export\s+async\s+function\s+POST\s*\(\s*\)\s*\{/,
      'export async function POST(request: NextRequest) {'
    );
    // Ensure NextRequest is imported
    if (!content.includes('NextRequest')) {
      content = content.replace(
        /import \{ NextResponse \} from 'next\/server';/,
        "import { NextRequest, NextResponse } from 'next/server';"
      );
    }
  }
  
  // Issue 3: Function uses Request instead of NextRequest
  // apiLog.start expects NextRequest, so remove logging from these files
  if (content.includes('Request,') && !content.includes('NextRequest') && content.includes('apiLog')) {
    content = content.replace(/^\s*const txId = await apiLog\.start\([^)]+\);\s*\n?\s*/gm, '');
    content = content.replace(/^\s*apiLog\.success\(txId[^;]*;\s*$/gm, '');
    content = content.replace(/^\s*apiLog\.failure\(txId[^;]*;\s*$/gm, '');
    if (!content.includes('apiLog.')) {
      content = content.replace(/import \{ apiLog \} from '@\/lib\/logging';\s*\n/g, '');
    }
  }
  
  // Clean up extra blank lines
  content = content.replace(/\n{3,}/g, '\n\n');
  
  if (content !== originalContent) {
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

console.log('🔧 Fixing all apiLog issues...\n');

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
