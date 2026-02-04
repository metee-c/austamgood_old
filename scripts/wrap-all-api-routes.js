// Script to wrap ALL API routes with shadow logging
// SAFE: Only adds logging, does NOT change business logic

const fs = require('fs');
const path = require('path');

const API_DIR = path.join(__dirname, '..', 'app', 'api');
const IMPORT_STATEMENT = "import { apiLog } from '@/lib/logging';";

// Routes already wrapped (skip these)
const ALREADY_WRAPPED = [
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
];

// Extract operation type from path
function getOperationType(filePath) {
  const relativePath = filePath.replace(API_DIR, '').replace(/\\/g, '/');
  const parts = relativePath.split('/').filter(Boolean);
  
  // Map path to operation type
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

// Get activity type from path and method
function getActivityType(filePath, method) {
  const opType = getOperationType(filePath);
  const relativePath = filePath.replace(API_DIR, '').replace(/\\/g, '/');
  
  // Extract action from path
  const actionMatch = relativePath.match(/\/(approve|reject|complete|submit|cancel|delete|confirm|scan|import|export|upload|depart|assign|update|create|batch)/i);
  const action = actionMatch ? actionMatch[1].toUpperCase() : method;
  
  return `${opType}_${action}`;
}

// Check if file has mutation methods (POST, PATCH, DELETE, PUT)
function hasMutationMethods(content) {
  return /export\s+(async\s+)?function\s+(POST|PATCH|DELETE|PUT)/m.test(content) ||
         /export\s+const\s+(POST|PATCH|DELETE|PUT)\s*=/m.test(content);
}

// Check if already has apiLog import
function hasApiLogImport(content) {
  return content.includes("from '@/lib/logging'") || 
         content.includes('from "@/lib/logging"') ||
         content.includes('apiLog');
}

// Wrap a single file
function wrapFile(filePath) {
  const relativePath = filePath.replace(API_DIR, '').replace(/\\/g, '/').slice(1);
  
  // Skip already wrapped
  if (ALREADY_WRAPPED.some(p => relativePath.endsWith(p))) {
    return { status: 'skipped', reason: 'already wrapped' };
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if no mutation methods
  if (!hasMutationMethods(content)) {
    return { status: 'skipped', reason: 'no mutation methods' };
  }
  
  // Skip if already has apiLog
  if (hasApiLogImport(content)) {
    return { status: 'skipped', reason: 'already has apiLog' };
  }
  
  const opType = getOperationType(filePath);
  let modified = false;
  
  // Add import after last import statement
  const lastImportMatch = content.match(/^import .+$/gm);
  if (lastImportMatch) {
    const lastImport = lastImportMatch[lastImportMatch.length - 1];
    content = content.replace(lastImport, `${lastImport}\n${IMPORT_STATEMENT}`);
    modified = true;
  }
  
  // Wrap POST functions
  const postPatterns = [
    // Pattern 1: export async function POST(request: NextRequest) { try {
    {
      regex: /(export\s+async\s+function\s+POST\s*\([^)]*\)\s*\{)\s*(try\s*\{)/g,
      replacement: (match, funcDef, tryBlock) => {
        return `${funcDef}\n  const txId = await apiLog.start('${opType}', request);\n  \n  ${tryBlock}`;
      }
    },
    // Pattern 2: export async function POST(request: NextRequest) { (no try)
    {
      regex: /(export\s+async\s+function\s+POST\s*\([^)]*\)\s*\{)(?!\s*const txId)/g,
      replacement: (match, funcDef) => {
        return `${funcDef}\n  const txId = await apiLog.start('${opType}', request);\n`;
      }
    },
    // Pattern 3: async function handlePost(request: NextRequest, context: any) { try {
    {
      regex: /(async\s+function\s+handlePost\s*\([^)]*\)\s*\{)\s*(try\s*\{)/g,
      replacement: (match, funcDef, tryBlock) => {
        return `${funcDef}\n  const txId = await apiLog.start('${opType}', request);\n  \n  ${tryBlock}`;
      }
    },
  ];
  
  for (const pattern of postPatterns) {
    if (pattern.regex.test(content)) {
      content = content.replace(pattern.regex, pattern.replacement);
      modified = true;
      break;
    }
  }
  
  // Similar patterns for PATCH
  const patchPatterns = [
    {
      regex: /(export\s+async\s+function\s+PATCH\s*\([^)]*\)\s*\{)\s*(try\s*\{)/g,
      replacement: (match, funcDef, tryBlock) => {
        return `${funcDef}\n  const txId = await apiLog.start('${opType}', request);\n  \n  ${tryBlock}`;
      }
    },
    {
      regex: /(export\s+async\s+function\s+PATCH\s*\([^)]*\)\s*\{)(?!\s*const txId)/g,
      replacement: (match, funcDef) => {
        return `${funcDef}\n  const txId = await apiLog.start('${opType}', request);\n`;
      }
    },
  ];
  
  for (const pattern of patchPatterns) {
    if (pattern.regex.test(content)) {
      content = content.replace(pattern.regex, pattern.replacement);
      modified = true;
      break;
    }
  }
  
  // Similar patterns for DELETE
  const deletePatterns = [
    {
      regex: /(export\s+async\s+function\s+DELETE\s*\([^)]*\)\s*\{)\s*(try\s*\{)/g,
      replacement: (match, funcDef, tryBlock) => {
        return `${funcDef}\n  const txId = await apiLog.start('${opType}', request);\n  \n  ${tryBlock}`;
      }
    },
    {
      regex: /(export\s+async\s+function\s+DELETE\s*\([^)]*\)\s*\{)(?!\s*const txId)/g,
      replacement: (match, funcDef) => {
        return `${funcDef}\n  const txId = await apiLog.start('${opType}', request);\n`;
      }
    },
  ];
  
  for (const pattern of deletePatterns) {
    if (pattern.regex.test(content)) {
      content = content.replace(pattern.regex, pattern.replacement);
      modified = true;
      break;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return { status: 'wrapped', opType };
  }
  
  return { status: 'skipped', reason: 'no matching patterns' };
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
console.log('🔍 Finding all API routes...\n');
const routeFiles = findRouteFiles(API_DIR);
console.log(`Found ${routeFiles.length} route files\n`);

const results = {
  wrapped: [],
  skipped: [],
  errors: [],
};

for (const file of routeFiles) {
  const relativePath = file.replace(API_DIR, '').replace(/\\/g, '/').slice(1);
  
  try {
    const result = wrapFile(file);
    
    if (result.status === 'wrapped') {
      results.wrapped.push({ path: relativePath, opType: result.opType });
      console.log(`✅ ${relativePath} → ${result.opType}`);
    } else {
      results.skipped.push({ path: relativePath, reason: result.reason });
    }
  } catch (err) {
    results.errors.push({ path: relativePath, error: err.message });
    console.error(`❌ ${relativePath}: ${err.message}`);
  }
}

console.log('\n========================================');
console.log(`✅ Wrapped: ${results.wrapped.length}`);
console.log(`⏭️  Skipped: ${results.skipped.length}`);
console.log(`❌ Errors: ${results.errors.length}`);
console.log('========================================\n');

// Show skipped breakdown
const skipReasons = {};
for (const s of results.skipped) {
  skipReasons[s.reason] = (skipReasons[s.reason] || 0) + 1;
}
console.log('Skipped breakdown:');
for (const [reason, count] of Object.entries(skipReasons)) {
  console.log(`  - ${reason}: ${count}`);
}
