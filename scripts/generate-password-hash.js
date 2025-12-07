/**
 * Generate bcrypt password hash for default admin users
 * Run with: node scripts/generate-password-hash.js
 */

const bcrypt = require('bcryptjs');

const passwords = {
  'Admin@123456': 'For Super Admin and Admin users',
  'Manager@123': 'For Manager user',
  'User@123': 'For Test User'
};

console.log('='.repeat(80));
console.log('BCRYPT PASSWORD HASHES (Salt Rounds: 10)');
console.log('='.repeat(80));
console.log('');

async function generateHashes() {
  for (const [password, description] of Object.entries(passwords)) {
    try {
      const hash = await bcrypt.hash(password, 10);
      console.log(`Password: ${password}`);
      console.log(`Description: ${description}`);
      console.log(`Hash: ${hash}`);
      console.log('-'.repeat(80));
    } catch (error) {
      console.error(`Error hashing password "${password}":`, error.message);
    }
  }

  console.log('');
  console.log('📋 COPY THIS SQL TO SUPABASE SQL EDITOR:');
  console.log('='.repeat(80));
  console.log(`
-- Insert Super Admin
INSERT INTO master_system_user (
    username, email, password_hash, role_id, is_active,
    email_verified, force_password_change, failed_login_attempts
)
VALUES (
    'superadmin',
    'admin@austamgood.com',
    '${await bcrypt.hash('Admin@123456', 10)}',
    1, true, true, true, 0
)
ON CONFLICT (email) DO NOTHING;

-- Insert Admin
INSERT INTO master_system_user (
    username, email, password_hash, role_id, is_active,
    email_verified, force_password_change, failed_login_attempts
)
VALUES (
    'admin',
    'admin@buzzpetsfood.com',
    '${await bcrypt.hash('Admin@123456', 10)}',
    2, true, true, true, 0
)
ON CONFLICT (email) DO NOTHING;

-- Insert Manager
INSERT INTO master_system_user (
    username, email, password_hash, role_id, is_active,
    email_verified, force_password_change, failed_login_attempts
)
VALUES (
    'manager',
    'manager@austamgood.com',
    '${await bcrypt.hash('Manager@123', 10)}',
    3, true, true, false, 0
)
ON CONFLICT (email) DO NOTHING;

-- Insert Test User
INSERT INTO master_system_user (
    username, email, password_hash, role_id, is_active,
    email_verified, force_password_change, failed_login_attempts
)
VALUES (
    'testuser',
    'user@austamgood.com',
    '${await bcrypt.hash('User@123', 10)}',
    4, true, true, false, 0
)
ON CONFLICT (email) DO NOTHING;
  `);
  console.log('='.repeat(80));
  console.log('');
  console.log('⚠️  IMPORTANT NOTES:');
  console.log('1. Super Admin and Admin require password change on first login');
  console.log('2. Change these default passwords immediately in production!');
  console.log('3. Run this SQL in Supabase Dashboard → SQL Editor');
  console.log('');
}

generateHashes().catch(console.error);
