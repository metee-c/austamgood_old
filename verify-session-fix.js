/**
 * Verification Script: Session Mixing Fix
 * 
 * ตรวจสอบว่าการแก้ไข Session Mixing ทำงานถูกต้อง
 * 
 * การใช้งาน:
 * node verify-session-fix.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Session Mixing Fix...\n');

let allPassed = true;

// ========================================
// 1. ตรวจสอบไฟล์ที่แก้ไข
// ========================================
console.log('📁 1. Checking Modified Files...');

const filesToCheck = [
  'app/api/auth/login/route.ts',
  'lib/auth/simple-auth.ts',
  'app/api/auth/me/route.ts',
  'middleware.ts'
];

filesToCheck.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
  if (!exists) allPassed = false;
});

console.log('');

// ========================================
// 2. ตรวจสอบ Cookie Settings
// ========================================
console.log('🍪 2. Checking Cookie Settings...');

const loginFile = fs.readFileSync('app/api/auth/login/route.ts', 'utf8');

const checks = [
  {
    name: 'SameSite=strict',
    pattern: /sameSite:\s*['"]strict['"]/,
    file: loginFile
  },
  {
    name: 'HttpOnly=true',
    pattern: /httpOnly:\s*true/,
    file: loginFile
  },
  {
    name: 'Cache-Control headers',
    pattern: /Cache-Control.*private.*no-cache.*no-store/,
    file: loginFile
  },
  {
    name: 'Pragma: no-cache',
    pattern: /Pragma.*no-cache/,
    file: loginFile
  },
  {
    name: 'Expires: 0',
    pattern: /Expires.*0/,
    file: loginFile
  }
];

checks.forEach(check => {
  const passed = check.pattern.test(check.file);
  console.log(`   ${passed ? '✅' : '❌'} ${check.name}`);
  if (!passed) allPassed = false;
});

console.log('');

// ========================================
// 3. ตรวจสอบ JWT Token with jti
// ========================================
console.log('🔐 3. Checking JWT Token Implementation...');

const authFile = fs.readFileSync('lib/auth/simple-auth.ts', 'utf8');

const jtiChecks = [
  {
    name: 'jti field in TokenPayload interface',
    pattern: /jti\?:\s*string/
  },
  {
    name: 'crypto.randomBytes for jti',
    pattern: /crypto\.randomBytes\(16\)\.toString\(['"]hex['"]\)/
  },
  {
    name: 'jti in token payload',
    pattern: /jti.*\/\/.*unique identifier/i
  }
];

jtiChecks.forEach(check => {
  const passed = check.pattern.test(authFile);
  console.log(`   ${passed ? '✅' : '❌'} ${check.name}`);
  if (!passed) allPassed = false;
});

console.log('');

// ========================================
// 4. ตรวจสอบ /api/auth/me Cache Headers
// ========================================
console.log('📡 4. Checking /api/auth/me Cache Headers...');

const meFile = fs.readFileSync('app/api/auth/me/route.ts', 'utf8');

const meChecks = [
  {
    name: 'Cache-Control headers',
    pattern: /Cache-Control.*private.*no-cache.*no-store/
  },
  {
    name: 'Vary: Cookie header',
    pattern: /Vary.*Cookie/
  }
];

meChecks.forEach(check => {
  const passed = check.pattern.test(meFile);
  console.log(`   ${passed ? '✅' : '❌'} ${check.name}`);
  if (!passed) allPassed = false;
});

console.log('');

// ========================================
// 5. ตรวจสอบ Middleware
// ========================================
console.log('🛡️  5. Checking Middleware...');

const middlewareFile = fs.readFileSync('middleware.ts', 'utf8');

const middlewareChecks = [
  {
    name: 'Middleware function exists',
    pattern: /export\s+function\s+middleware/
  },
  {
    name: 'API route matcher',
    pattern: /matcher:\s*['"]\/api\/:path\*/
  },
  {
    name: 'Cache-Control in middleware',
    pattern: /Cache-Control.*private.*no-cache/
  },
  {
    name: 'Vary: Cookie in middleware',
    pattern: /Vary.*Cookie/
  }
];

middlewareChecks.forEach(check => {
  const passed = check.pattern.test(middlewareFile);
  console.log(`   ${passed ? '✅' : '❌'} ${check.name}`);
  if (!passed) allPassed = false;
});

console.log('');

// ========================================
// 6. ตรวจสอบ Environment Variables
// ========================================
console.log('🔑 6. Checking Environment Variables...');

const envFile = fs.existsSync('.env.local') 
  ? fs.readFileSync('.env.local', 'utf8') 
  : '';

const hasJwtSecret = /JWT_SECRET=/.test(envFile);
console.log(`   ${hasJwtSecret ? '✅' : '❌'} JWT_SECRET in .env.local`);
if (!hasJwtSecret) {
  console.log('   ⚠️  Warning: JWT_SECRET not found in .env.local');
  console.log('   ℹ️  Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

console.log('');

// ========================================
// 7. ตรวจสอบเอกสาร
// ========================================
console.log('📚 7. Checking Documentation...');

const docs = [
  'DEPLOY_SESSION_FIX.md',
  'docs/auth/SESSION_MIXING_FIX_VERCEL.md'
];

docs.forEach(doc => {
  const exists = fs.existsSync(doc);
  console.log(`   ${exists ? '✅' : '❌'} ${doc}`);
  if (!exists) allPassed = false;
});

console.log('');

// ========================================
// สรุปผล
// ========================================
console.log('═'.repeat(60));
if (allPassed) {
  console.log('✅ ALL CHECKS PASSED!');
  console.log('');
  console.log('🚀 Ready to Deploy to Vercel');
  console.log('');
  console.log('Next Steps:');
  console.log('1. Set JWT_SECRET on Vercel Environment Variables');
  console.log('2. git add . && git commit -m "fix(auth): prevent session mixing"');
  console.log('3. git push origin main');
  console.log('4. Test with multiple users after deployment');
} else {
  console.log('❌ SOME CHECKS FAILED!');
  console.log('');
  console.log('Please review the failed checks above and fix them before deploying.');
}
console.log('═'.repeat(60));

process.exit(allPassed ? 0 : 1);
