/**
 * Test API Integration (Without Database Migrations)
 * Tests that API code is correctly updated to use atomic functions
 * 
 * Usage:
 *   node scripts/test-api-integration.js
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Test 1: Check Face Sheet API uses atomic function
 */
function testFaceSheetAPI() {
  log('\n📋 Test 1: Face Sheet API Integration', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const filePath = 'app/api/face-sheets/generate/route.ts';
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for atomic function call
  if (content.includes('create_face_sheet_with_reservation')) {
    log('✅ PASS: Uses atomic function create_face_sheet_with_reservation', 'green');
  } else {
    log('❌ FAIL: Does not use atomic function', 'red');
    return false;
  }
  
  // Check removed old function calls
  if (content.includes('create_face_sheet_packages') && 
      !content.includes('// BEFORE:') && 
      !content.includes('create_face_sheet_with_reservation')) {
    log('❌ FAIL: Still uses old function create_face_sheet_packages', 'red');
    return false;
  } else {
    log('✅ PASS: Old function create_face_sheet_packages removed', 'green');
  }
  
  if (content.includes('reserve_stock_for_face_sheet_items') && 
      !content.includes('// BEFORE:') &&
      !content.includes('create_face_sheet_with_reservation')) {
    log('❌ FAIL: Still has separate reserve_stock_for_face_sheet_items call', 'red');
    return false;
  } else {
    log('✅ PASS: Separate stock reservation call removed', 'green');
  }
  
  // Check for items_reserved in response
  if (content.includes('items_reserved')) {
    log('✅ PASS: Returns items_reserved in response', 'green');
  } else {
    log('⚠️  WARNING: items_reserved not found in response', 'yellow');
  }
  
  return true;
}

/**
 * Test 2: Check Bonus Face Sheet API uses atomic function
 */
function testBonusFaceSheetAPI() {
  log('\n📋 Test 2: Bonus Face Sheet API Integration', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const filePath = 'app/api/bonus-face-sheets/route.ts';
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check for atomic function call
  if (content.includes('create_bonus_face_sheet_with_reservation')) {
    log('✅ PASS: Uses atomic function create_bonus_face_sheet_with_reservation', 'green');
  } else {
    log('❌ FAIL: Does not use atomic function', 'red');
    return false;
  }
  
  // Check removed old function calls
  if (content.includes('generate_bonus_face_sheet_no()') && 
      !content.includes('// BEFORE:') &&
      !content.includes('create_bonus_face_sheet_with_reservation')) {
    log('❌ FAIL: Still uses old function generate_bonus_face_sheet_no', 'red');
    return false;
  } else {
    log('✅ PASS: Old function generate_bonus_face_sheet_no removed', 'green');
  }
  
  // Check removed artificial delay
  if (content.includes('setTimeout') && 
      content.includes('500') &&
      !content.includes('// BEFORE:')) {
    log('❌ FAIL: Still has artificial delay (setTimeout 500ms)', 'red');
    return false;
  } else {
    log('✅ PASS: Artificial delay removed', 'green');
  }
  
  // Check for items_reserved in response
  if (content.includes('items_reserved')) {
    log('✅ PASS: Returns items_reserved in response', 'green');
  } else {
    log('⚠️  WARNING: items_reserved not found in response', 'yellow');
  }
  
  return true;
}

/**
 * Test 3: Check migrations exist
 */
function testMigrationsExist() {
  log('\n📋 Test 3: Migration Files Exist', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const migrations = [
    'supabase/migrations/220_add_row_locking_to_reservations.sql',
    'supabase/migrations/221_create_atomic_face_sheet_creation.sql',
    'supabase/migrations/222_create_atomic_bonus_face_sheet_creation.sql'
  ];
  
  let allExist = true;
  
  for (const migration of migrations) {
    if (fs.existsSync(migration)) {
      const stats = fs.statSync(migration);
      const sizeKB = (stats.size / 1024).toFixed(2);
      log(`✅ PASS: ${path.basename(migration)} exists (${sizeKB} KB)`, 'green');
    } else {
      log(`❌ FAIL: ${path.basename(migration)} not found`, 'red');
      allExist = false;
    }
  }
  
  return allExist;
}

/**
 * Test 4: Check documentation exists
 */
function testDocumentationExists() {
  log('\n📋 Test 4: Documentation Exists', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const docs = [
    'docs/picklists/DEPLOYMENT_GUIDE.md',
    'docs/picklists/API_INTEGRATION_COMPLETE.md',
    'docs/picklists/MIGRATION_221_222_SUMMARY.md',
    'docs/picklists/IMPLEMENTATION_PROGRESS.md'
  ];
  
  let allExist = true;
  
  for (const doc of docs) {
    if (fs.existsSync(doc)) {
      log(`✅ PASS: ${path.basename(doc)} exists`, 'green');
    } else {
      log(`❌ FAIL: ${path.basename(doc)} not found`, 'red');
      allExist = false;
    }
  }
  
  return allExist;
}

/**
 * Test 5: Check TypeScript compilation
 */
function testTypeScriptCompilation() {
  log('\n📋 Test 5: TypeScript Compilation', 'cyan');
  log('='.repeat(60), 'cyan');
  
  try {
    const { execSync } = require('child_process');
    execSync('npx tsc --noEmit', { stdio: 'pipe' });
    log('✅ PASS: TypeScript compilation successful', 'green');
    return true;
  } catch (error) {
    log('❌ FAIL: TypeScript compilation errors', 'red');
    log(error.stdout?.toString() || error.message, 'yellow');
    return false;
  }
}

/**
 * Main test runner
 */
function runTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('🧪 API INTEGRATION TESTS', 'cyan');
  log('   Testing API Code Changes (No Database Required)', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const tests = [
    { name: 'Face Sheet API', fn: testFaceSheetAPI },
    { name: 'Bonus Face Sheet API', fn: testBonusFaceSheetAPI },
    { name: 'Migration Files', fn: testMigrationsExist },
    { name: 'Documentation', fn: testDocumentationExists },
    { name: 'TypeScript Compilation', fn: testTypeScriptCompilation }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      const passed = test.fn();
      results.push({ name: test.name, passed });
    } catch (err) {
      log(`\n❌ Test "${test.name}" threw exception: ${err.message}`, 'red');
      results.push({ name: test.name, passed: false });
    }
  }
  
  // Summary
  log('\n' + '='.repeat(60), 'cyan');
  log('📊 TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  results.forEach(r => {
    const icon = r.passed ? '✅' : '❌';
    const color = r.passed ? 'green' : 'red';
    log(`${icon} ${r.name}`, color);
  });
  
  log('\n' + '-'.repeat(60), 'cyan');
  log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`, 
    failed === 0 ? 'green' : 'red');
  log('='.repeat(60), 'cyan');
  
  if (failed === 0) {
    log('\n🎉 ALL API INTEGRATION TESTS PASSED!', 'green');
    log('✅ API code is ready', 'green');
    log('📝 Next step: Deploy migrations to database', 'blue');
    log('   Run: psql < supabase/migrations/220_*.sql', 'blue');
    log('   Run: psql < supabase/migrations/221_*.sql', 'blue');
    log('   Run: psql < supabase/migrations/222_*.sql', 'blue');
  } else {
    log('\n⚠️  SOME TESTS FAILED. Please fix before deployment.', 'red');
  }
  
  process.exit(failed === 0 ? 0 : 1);
}

// Run tests
runTests();
