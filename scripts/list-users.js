/**
 * Script สำหรับแสดงรายชื่อผู้ใช้ทั้งหมด
 * ใช้เมื่อต้องการดูว่ามี user อะไรบ้างในระบบ
 * 
 * วิธีใช้:
 * node scripts/list-users.js
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listUsers() {
  try {
    console.log('📋 Fetching all users...\n');

    const { data: users, error } = await supabase
      .from('master_system_user')
      .select(`
        user_id,
        username,
        email,
        full_name,
        role_id,
        is_active,
        is_locked,
        last_login_at,
        master_system_role (
          role_name
        )
      `)
      .order('user_id');

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (!users || users.length === 0) {
      console.log('No users found.');
      return;
    }

    console.log(`Found ${users.length} users:\n`);
    console.log('─'.repeat(100));

    users.forEach(user => {
      const roleData = user.master_system_role;
      const roleName = roleData?.role_name || 'No Role';
      const status = user.is_active ? '✅ Active' : '❌ Inactive';
      const locked = user.is_locked ? '🔒 Locked' : '';
      const lastLogin = user.last_login_at 
        ? new Date(user.last_login_at).toLocaleString('th-TH')
        : 'Never';

      console.log(`ID: ${user.user_id}`);
      console.log(`Username: ${user.username}`);
      console.log(`Email: ${user.email}`);
      console.log(`Full Name: ${user.full_name}`);
      console.log(`Role: ${roleName} (ID: ${user.role_id})`);
      console.log(`Status: ${status} ${locked}`);
      console.log(`Last Login: ${lastLogin}`);
      console.log('─'.repeat(100));
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

listUsers();
