// Script to add apiLog.success and apiLog.failure calls to wrapped routes
// This completes the logging by adding success/failure tracking

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'app', 'api');

// Extract operation type from path
function getOperationType(filePath) {
  const relativePath = filePath.replace(API_DIR, '').replace(/\\/g, '/');
  const parts = relativePath.split('/').filter(Boolean);
  
  const typeMap = {
    'auth': 'AUTH',
    'orders': 'ORDER',
    'picklists': 'PICKLIST',
    'loadlists': 'LOADLIST',
    'moves': 'MOVE',
    'receives': 'RECEIVE',
    'stock-adjustments': 'ADJUSTMENT',
    'bonus-face-sheets': 'BONUS_FACE_SHEET',
    'face-sheets': 'FACE_SHEET',
    'route-plans': 'ROUTE_PLAN',
    'production': 'PRODUCTION',
    'inventory': 'INVENTORY',
    'master-customer': 'CUSTOMER',
    'master-sku': 'SKU',
    'master-location': 'LOCATION',
    'master-employee': 'EMPLOYEE',
    'master-supplier': 'SUPPLIER',
    'master-vehicle': 'VEHICLE',
    'master-warehouse': 'WAREHOUSE',
    'mobile': 'MOBILE',
    'replenishment': 'REPLENISHMENT',
    'stock-count': 'STOCK_COUNT',
    'stock-import': 'STOCK_IMPORT',
    'users': 'USER',
    'roles': 'ROLE',
    'ai': 'AI',
    'reports': 'REPORT',
    'system': 'SYSTEM',
    'preparation-areas': 'PREP_AREA',
    'online-packing': 'ONLINE_PACKING',
    'online-picklists': 'ONLINE_PICKLIST',
    'freight-rates': 'FREIGHT_RATE',
  };
  
  for (const [key, value] of Object.entries(typeMap)) {
    if (parts.includes(key)) return value;
  }
  
  return parts[0]?.toUpperCase().replace(/-/g, '_') || 'API';
}

// Get activity type from path
function getActivityType(filePath, method = 'POST') {
  const opType = getOperationType(filePath);
  const relativePath = filePath.replace(API_DIR, '').replace(/\\/g, '/');
  
  // Extract action from path
  const actionMatch = relativePath.match(/\/(approve|reject|complete|submit|cancel|delete|confirm|scan|import|export|upload|depart|assign|update|create|batch|login|logout|register)/i);
  const action = actionMatch ? actionMatch[1].toUpperCase() : method;
  
  return `${opType}_${action}`;
}

// Check if file needs success/failure additions
function needsSuccessFailure(content) {
  return content.includes('apiLog.start') && 
         !content.includes('apiLog.success') && 
         !content.includes('apiLog.failure');
}

// Add success/failure to catch blocks and return statements
function addSuccessFailure(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!needsSuccessFailure(content)) {
    return { status: 'skipped', reason: 'already has success/failure or no start' };
  }
  
  const activityType = getActivityType(filePath);
  let modified = false;
  
  // Pattern 1: Add failure to catch blocks that have txId in scope
  // catch (error: any) { ... return NextResponse.json(
  const catchPattern = /(catch\s*\([^)]*\)\s*\{[^}]*?)(return\s+NextResponse\.json\s*\(\s*\{[^}]*error)/g;
  
  if (catchPattern.test(content)) {
    content = content.replace(catchPattern, (match, catchStart, returnPart) => {
      if (match.includes('apiLog.failure')) return match;
      return `${catchStart}apiLog.failure(txId, '${activityType}', error);\n    ${returnPart}`;
    });
    modified = true;
  }
  
  // Pattern 2: Add success before successful returns
  // return NextResponse.json({ data: ... (not error)
  const successReturnPattern = /(return\s+NextResponse\.json\s*\(\s*\{\s*(?:data|success)[^}]*\}[^;]*;)/g;
  
  // Only add success if there's a txId in scope and no apiLog.success before
  if (content.includes('const txId = await apiLog.start')) {
    const lines = content.split('\n');
    const newLines = [];
    let inTryBlock = false;
    let braceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track try blocks
      if (line.includes('try {')) {
        inTryBlock = true;
        braceCount = 1;
      }
      
      if (inTryBlock) {
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
        
        if (braceCount <= 0) {
          inTryBlock = false;
        }
      }
      
      // Add success before successful returns in try blocks
      if (inTryBlock && 
          line.includes('return NextResponse.json') && 
          (line.includes('data') || line.includes('success: true')) &&
          !line.includes('error') &&
          !lines[i-1]?.includes('apiLog.success')) {
        
        const indent = line.match(/^\s*/)[0];
        newLines.push(`${indent}apiLog.success(txId, '${activityType}');`);
        modified = true;
      }
      
      // Add failure before error returns in catch blocks
      if (!inTryBlock && 
          line.includes('return NextResponse.json') && 
          line.includes('error') &&
          !lines[i-1]?.includes('apiLog.failure')) {
        
        const indent = line.match(/^\s*/)[0];
        // Check if we're in a catch block
        let inCatch = false;
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          if (lines[j].includes('catch')) {
            inCatch = true;
            break;
          }
          if (lines[j].includes('try {')) break;
        }
        
        if (inCatch) {
          newLines.push(`${indent}apiLog.failure(txId, '${activityType}', error);`);
          modified = true;
        }
      }
      
      newLines.push(line);
    }
    
    content = newLines.join('\n');
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return { status: 'updated', activityType };
  }
  
  return { status: 'skipped', reason: 'no patterns matched' };
}

// Find all route.ts files
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

// Main
console.log('🔍 Adding apiLog.success/failure to wrapped routes...\n');
const routeFiles = findRouteFiles(API_DIR);

const results = {
  updated: [],
  skipped: [],
  errors: [],
};

for (const file of routeFiles) {
  const relativePath = file.replace(API_DIR, '').replace(/\\/g, '/').slice(1);
  
  try {
    const result = addSuccessFailure(file);
    
    if (result.status === 'updated') {
      results.updated.push({ path: relativePath, activityType: result.activityType });
      console.log(`✅ ${relativePath}`);
    } else {
      results.skipped.push({ path: relativePath, reason: result.reason });
    }
  } catch (err) {
    results.errors.push({ path: relativePath, error: err.message });
    console.error(`❌ ${relativePath}: ${err.message}`);
  }
}

console.log('\n========================================');
console.log(`✅ Updated: ${results.updated.length}`);
console.log(`⏭️  Skipped: ${results.skipped.length}`);
console.log(`❌ Errors: ${results.errors.length}`);
console.log('========================================');
