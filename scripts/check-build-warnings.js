// Script to check for deprecated patterns in build output
const fs = require('fs');
const path = require('path');

const BUILD_LOG_PATH = path.join(__dirname, '..', 'build.log');

// Define deprecated patterns to check
const deprecatedPatterns = [
  {
    pattern: 'deprecated',
    severity: 'warning',
    message: 'Deprecated package or API detected'
  },
  {
    pattern: '@supabase/auth-helpers',
    severity: 'critical',
    message: 'Supabase auth-helpers detected (should use @supabase/ssr)'
  },
  {
    pattern: 'middleware" file convention is deprecated',
    severity: 'high',
    message: 'Middleware convention deprecated (plan migration to proxy.ts for Next.js 17+)'
  },
  {
    pattern: 'rimraf',
    severity: 'low',
    message: 'rimraf deprecated (consider using del-cli or native fs)'
  },
  {
    pattern: 'glob@7',
    severity: 'low',
    message: 'glob v7 deprecated (update to v10+)'
  },
  {
    pattern: 'eslint@8',
    severity: 'medium',
    message: 'ESLint 8 deprecated (plan migration to v9)'
  }
];

function checkBuildWarnings() {
  console.log('🔍 Checking build warnings...\n');

  // Check if build log exists
  if (!fs.existsSync(BUILD_LOG_PATH)) {
    console.log('⚠️  Build log not found. Run "npm run build" first.');
    return;
  }

  // Read build log
  const log = fs.readFileSync(BUILD_LOG_PATH, 'utf8');

  // Check for each pattern
  const findings = [];
  deprecatedPatterns.forEach(({ pattern, severity, message }) => {
    if (log.includes(pattern)) {
      findings.push({ pattern, severity, message });
    }
  });

  // Report findings
  if (findings.length === 0) {
    console.log('✅ No deprecated patterns detected in build output!\n');
    return;
  }

  console.log('🚨 Deprecated patterns found:\n');
  
  const critical = findings.filter(f => f.severity === 'critical');
  const high = findings.filter(f => f.severity === 'high');
  const medium = findings.filter(f => f.severity === 'medium');
  const low = findings.filter(f => f.severity === 'low');
  const warnings = findings.filter(f => f.severity === 'warning');

  if (critical.length > 0) {
    console.log('🔴 CRITICAL:');
    critical.forEach(f => console.log(`   - ${f.message}`));
    console.log('');
  }

  if (high.length > 0) {
    console.log('🟠 HIGH:');
    high.forEach(f => console.log(`   - ${f.message}`));
    console.log('');
  }

  if (medium.length > 0) {
    console.log('🟡 MEDIUM:');
    medium.forEach(f => console.log(`   - ${f.message}`));
    console.log('');
  }

  if (low.length > 0) {
    console.log('🟢 LOW:');
    low.forEach(f => console.log(`   - ${f.message}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach(f => console.log(`   - ${f.message}`));
    console.log('');
  }

  // Exit with error if critical issues found
  if (critical.length > 0) {
    console.log('❌ Build contains CRITICAL deprecated patterns. Please fix before deploying.\n');
    process.exit(1);
  }

  console.log('⚠️  Build contains deprecated patterns. Consider fixing in next sprint.\n');
}

// Run check
checkBuildWarnings();
