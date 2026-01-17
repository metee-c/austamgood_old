#!/usr/bin/env node

/**
 * Run concurrent tests with environment variables loaded
 */

require('dotenv').config({ path: '.env.local' });

const { execSync } = require('child_process');

console.log('🧪 Running Concurrent Stock Reservation Tests...\n');
console.log('📋 Configuration:');
console.log(`   SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing'}`);
console.log(`   SERVICE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing'}`);
console.log('');

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables!');
  console.error('   Please ensure .env.local contains:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

try {
  execSync('npm test -- tests/stock-reservation.concurrent.test.ts --verbose', {
    stdio: 'inherit',
    env: process.env,
  });
  
  console.log('\n✅ All tests passed!');
} catch (error) {
  console.error('\n❌ Tests failed!');
  process.exit(1);
}
