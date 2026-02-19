// Re-apply migration 302 to fix function cache
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function reapplyMigration() {
  console.log('🔄 Re-applying migration 302...\n');

  // อ่านไฟล์ migration
  const migrationPath = path.join(__dirname, 'supabase/migrations/302_create_split_balance_on_reservation.sql');
  
  if (!fs.existsSync(migrationPath)) {
    console.error('❌ Migration file not found:', migrationPath);
    return;
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
  
  console.log('📄 Migration file loaded');
  console.log(`   Size: ${migrationSQL.length} characters`);
  console.log(`   Path: ${migrationPath}\n`);

  // แยก SQL statements (แบบง่าย - แยกด้วย semicolon ที่ไม่อยู่ใน function body)
  const statements = migrationSQL
    .split(/;\s*$/gm)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements\n`);

  // Execute แต่ละ statement
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    
    // Skip comments
    if (stmt.startsWith('--')) continue;
    
    // แสดง statement แรก 100 ตัวอักษร
    const preview = stmt.substring(0, 100).replace(/\s+/g, ' ');
    console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt });
      
      if (error) {
        // ลองใช้วิธีอื่น
        const { error: directError } = await supabase
          .from('_migrations')
          .select('*')
          .limit(0); // Just to test connection
        
        console.log(`   ⚠️  Cannot execute via RPC, trying direct execution...`);
        
        // สำหรับ CREATE OR REPLACE FUNCTION ให้ execute ทั้งหมดเป็น statement เดียว
        if (stmt.includes('CREATE OR REPLACE FUNCTION')) {
          console.log('   📝 This is a function definition, executing as single statement...');
          // ต้องใช้ psql หรือ Supabase CLI
          console.log('   ⚠️  Please run this manually using psql or Supabase CLI');
          console.log('   Command: supabase db reset');
          console.log('   Or: psql -h <host> -U postgres -d postgres -f supabase/migrations/302_create_split_balance_on_reservation.sql');
          break;
        }
      } else {
        console.log('   ✅ Success');
      }
    } catch (err) {
      console.error(`   ❌ Error:`, err.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('⚠️  IMPORTANT: Function definitions cannot be updated via JS client');
  console.log('='.repeat(60));
  console.log('\nTo properly refresh the function, use ONE of these methods:\n');
  console.log('1. Supabase CLI (RECOMMENDED):');
  console.log('   supabase db reset\n');
  console.log('2. Direct psql:');
  console.log('   psql -h <host> -U postgres -d postgres -f supabase/migrations/302_create_split_balance_on_reservation.sql\n');
  console.log('3. Supabase Dashboard:');
  console.log('   - Go to SQL Editor');
  console.log('   - Paste the migration SQL');
  console.log('   - Run it\n');
  console.log('4. Wait for cache to clear (if using Supabase Cloud):');
  console.log('   - May take 5-10 minutes');
  console.log('   - Try creating picklist again after waiting\n');
}

reapplyMigration().catch(console.error);
