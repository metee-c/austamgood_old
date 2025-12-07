/**
 * Script สำหรับ Admin Reset Password
 * ใช้เมื่อผู้ใช้ลืมรหัสผ่านและต้องการให้ admin reset ให้
 * 
 * วิธีใช้:
 * node scripts/reset-user-password.js <email> <new-password>
 * 
 * ตัวอย่าง:
 * node scripts/reset-user-password.js user@example.com NewPassword123
 */

const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetPassword(email, newPassword) {
  try {
    console.log('🔄 Resetting password for:', email);

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('master_system_user')
      .select('user_id, username, email, full_name')
      .eq('email', email)
      .single();

    if (userError || !user) {
      console.error('❌ User not found:', email);
      return;
    }

    console.log('👤 Found user:', {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name
    });

    // Hash new password
    console.log('🔐 Hashing new password...');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    const now = new Date();
    const { error: updateError } = await supabase
      .from('master_system_user')
      .update({
        password_hash: passwordHash,
        password_changed_at: now.toISOString(),
        failed_login_attempts: 0,
        is_locked: false,
        locked_until: null,
        force_password_change: false // Don't force password change for admin reset
      })
      .eq('user_id', user.user_id);

    if (updateError) {
      console.error('❌ Error updating password:', updateError);
      return;
    }

    console.log('✅ Password reset successfully!');
    console.log('');
    console.log('📧 Email:', email);
    console.log('🔑 New Password:', newPassword);
    console.log('⚠️  User will be forced to change password on next login');
    console.log('');
    console.log('🔐 Password Hash (for reference):', passwordHash);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Main
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node scripts/reset-user-password.js <email> <new-password>');
  console.log('');
  console.log('Example:');
  console.log('  node scripts/reset-user-password.js user@example.com NewPassword123');
  process.exit(1);
}

const [email, newPassword] = args;

resetPassword(email, newPassword);
