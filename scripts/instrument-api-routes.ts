#!/usr/bin/env ts-node
/**
 * Auto-Instrumentation Script for API Routes
 *
 * Scans all app/api/** /route.ts files and wraps exported handlers
 * with withShadowLog for 100% shadow logging coverage.
 *
 * Usage:
 *   npx ts-node scripts/instrument-api-routes.ts          # Dry run
 *   npx ts-node scripts/instrument-api-routes.ts --apply   # Apply changes
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRY_RUN = !process.argv.includes('--apply');
const ROOT = path.resolve(__dirname, '..');
const API_DIR = path.join(ROOT, 'app', 'api');

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const SHADOW_IMPORT = `import { withShadowLog } from '@/lib/logging/with-shadow-log';`;

interface FileReport {
  file: string;
  relativePath: string;
  action: 'instrumented' | 'skipped_already' | 'skipped_no_exports' | 'error';
  methods: string[];
  detail?: string;
}

const reports: FileReport[] = [];

// ============================================================================
// Find all route.ts files
// ============================================================================

function findRouteFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules, .next, etc.
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        walk(full);
      } else if (entry.name === 'route.ts') {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

// ============================================================================
// Process a single route file
// ============================================================================

function processFile(filePath: string): void {
  const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err: any) {
    reports.push({ file: filePath, relativePath, action: 'error', methods: [], detail: err.message });
    return;
  }

  // Check if already instrumented
  if (content.includes('withShadowLog')) {
    reports.push({ file: filePath, relativePath, action: 'skipped_already', methods: [] });
    return;
  }

  // Skip the shadow-log endpoint itself and command-center APIs
  if (relativePath.includes('api/system/shadow-log') || relativePath.includes('api/command-center')) {
    reports.push({ file: filePath, relativePath, action: 'skipped_already', methods: [], detail: 'system/logging endpoint' });
    return;
  }

  // Find all exported HTTP methods
  const methodsToWrap: { method: string; pattern: 'function' | 'const_withAuth' | 'const_other' }[] = [];

  for (const method of HTTP_METHODS) {
    // Pattern 1: export async function GET(
    const funcPattern = new RegExp(`^export\\s+async\\s+function\\s+${method}\\s*\\(`, 'm');
    if (funcPattern.test(content)) {
      methodsToWrap.push({ method, pattern: 'function' });
      continue;
    }

    // Pattern 2: export const GET = withAuth(
    const constAuthPattern = new RegExp(`^export\\s+const\\s+${method}\\s*=\\s*withAuth\\(`, 'm');
    if (constAuthPattern.test(content)) {
      methodsToWrap.push({ method, pattern: 'const_withAuth' });
      continue;
    }

    // Pattern 3: export const GET = someOtherWrapper( or handler directly
    const constOtherPattern = new RegExp(`^export\\s+const\\s+${method}\\s*=`, 'm');
    if (constOtherPattern.test(content)) {
      methodsToWrap.push({ method, pattern: 'const_other' });
      continue;
    }

    // Pattern 4: export function GET( (non-async)
    const syncFuncPattern = new RegExp(`^export\\s+function\\s+${method}\\s*\\(`, 'm');
    if (syncFuncPattern.test(content)) {
      methodsToWrap.push({ method, pattern: 'function' });
      continue;
    }
  }

  if (methodsToWrap.length === 0) {
    reports.push({ file: filePath, relativePath, action: 'skipped_no_exports', methods: [] });
    return;
  }

  // Apply transformations
  let modified = content;

  for (const { method, pattern } of methodsToWrap) {
    if (pattern === 'function') {
      // Transform: export async function GET(req) { ... }
      // To: async function _GET(req) { ... } (at end add export const GET = withShadowLog(_GET))

      // Handle async
      modified = modified.replace(
        new RegExp(`^export\\s+async\\s+function\\s+${method}(\\s*\\()`, 'm'),
        `async function _${method}$1`
      );
      // Handle non-async
      modified = modified.replace(
        new RegExp(`^export\\s+function\\s+${method}(\\s*\\()`, 'm'),
        `function _${method}$1`
      );

    } else if (pattern === 'const_withAuth') {
      // Transform: export const GET = withAuth(handleGet);
      // To: export const GET = withShadowLog(withAuth(handleGet));
      modified = modified.replace(
        new RegExp(`^(export\\s+const\\s+${method}\\s*=\\s*)(withAuth\\()`, 'm'),
        `$1withShadowLog($2`
      );
      // Add closing paren - find the line and add ) before ;
      // This handles: export const GET = withShadowLog(withAuth(handleGet));
      // Need to close the withShadowLog( ... )
      modified = modified.replace(
        new RegExp(`^(export\\s+const\\s+${method}\\s*=\\s*withShadowLog\\(withAuth\\([^)]*\\))(\\s*;)`, 'm'),
        `$1)$2`
      );
      // Handle multi-arg withAuth like withAuth(handler, { requireAuth: true })
      // Find the full withAuth(...) expression and wrap it
      // Actually, let me use a simpler approach - find the line(s) and work with them
    } else if (pattern === 'const_other') {
      // Transform: export const GET = someHandler;
      // To: export const GET = withShadowLog(someHandler);
      modified = modified.replace(
        new RegExp(`^(export\\s+const\\s+${method}\\s*=\\s*)(.+?)(\\s*;\\s*)$`, 'm'),
        `$1withShadowLog($2)$3`
      );
    }
  }

  // Add export statements for function pattern methods
  const funcMethods = methodsToWrap.filter(m => m.pattern === 'function');
  if (funcMethods.length > 0) {
    const exports = funcMethods
      .map(m => `export const ${m.method} = withShadowLog(_${m.method});`)
      .join('\n');
    modified = modified.trimEnd() + '\n\n' + exports + '\n';
  }

  // Add import if any changes were made
  if (modified !== content) {
    // Add import after existing imports
    if (!modified.includes(SHADOW_IMPORT)) {
      // Find the last import statement and add after it
      const importLines = modified.split('\n');
      let lastImportIndex = -1;
      for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].trim().startsWith('import ') ||
            importLines[i].trim().startsWith('} from ') ||
            (importLines[i].trim().startsWith('from ') && i > 0)) {
          lastImportIndex = i;
        }
        // Also track multi-line imports
        if (importLines[i].includes("from '") || importLines[i].includes('from "')) {
          lastImportIndex = i;
        }
      }

      if (lastImportIndex >= 0) {
        importLines.splice(lastImportIndex + 1, 0, SHADOW_IMPORT);
      } else {
        // No imports found, add at top
        importLines.unshift(SHADOW_IMPORT);
      }
      modified = importLines.join('\n');
    }
  }

  if (modified === content) {
    reports.push({ file: filePath, relativePath, action: 'skipped_no_exports', methods: [], detail: 'no changes needed' });
    return;
  }

  if (!DRY_RUN) {
    fs.writeFileSync(filePath, modified, 'utf-8');
  }

  reports.push({
    file: filePath,
    relativePath,
    action: 'instrumented',
    methods: methodsToWrap.map(m => `${m.method}(${m.pattern})`),
  });
}

// ============================================================================
// Main
// ============================================================================

console.log(`\n${'='.repeat(60)}`);
console.log(`Shadow Log Auto-Instrumentation`);
console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no files changed)' : 'APPLY (writing files)'}`);
console.log(`${'='.repeat(60)}\n`);

const files = findRouteFiles(API_DIR);
console.log(`Found ${files.length} route files\n`);

for (const file of files) {
  processFile(file);
}

// Print report
const instrumented = reports.filter(r => r.action === 'instrumented');
const skippedAlready = reports.filter(r => r.action === 'skipped_already');
const skippedNoExports = reports.filter(r => r.action === 'skipped_no_exports');
const errors = reports.filter(r => r.action === 'error');

console.log(`\n${'='.repeat(60)}`);
console.log(`RESULTS`);
console.log(`${'='.repeat(60)}`);
console.log(`Instrumented: ${instrumented.length}`);
console.log(`Skipped (already done): ${skippedAlready.length}`);
console.log(`Skipped (no exports): ${skippedNoExports.length}`);
console.log(`Errors: ${errors.length}`);
console.log(`Total: ${reports.length}\n`);

if (instrumented.length > 0) {
  console.log(`\nINSTRUMENTED FILES:`);
  for (const r of instrumented) {
    console.log(`  ✅ ${r.relativePath} [${r.methods.join(', ')}]`);
  }
}

if (errors.length > 0) {
  console.log(`\nERRORS:`);
  for (const r of errors) {
    console.log(`  ❌ ${r.relativePath}: ${r.detail}`);
  }
}

if (DRY_RUN) {
  console.log(`\n⚠️  DRY RUN - No files were changed.`);
  console.log(`Run with --apply to write changes:\n`);
  console.log(`  npx ts-node scripts/instrument-api-routes.ts --apply\n`);
}
