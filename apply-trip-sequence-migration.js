const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log('🔧 กำลังรัน migration: 217_auto_resequence_trips_on_plan_date_change.sql\n');

  const migrationSQL = fs.readFileSync(
    'supabase/migrations/217_auto_resequence_trips_on_plan_date_change.sql',
    'utf8'
  );

  // แยก SQL statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    
    // Skip comments
    if (statement.trim().startsWith('--')) continue;
    
    console.log(`\n[${i + 1}/${statements.length}] กำลังรัน statement...`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error(`❌ Error:`, error.message);
        errorCount++;
      } else {
        console.log(`✅ สำเร็จ`);
        successCount++;
      }
    } catch (err) {
      console.error(`❌ Exception:`, err.message);
      errorCount++;
    }
  }

  console.log(`\n📊 สรุป:`);
  console.log(`  ✅ สำเร็จ: ${successCount}`);
  console.log(`  ❌ ล้มเหลว: ${errorCount}`);

  if (errorCount === 0) {
    console.log('\n✅ Migration รันสำเร็จทั้งหมด!');
  } else {
    console.log('\n⚠️ Migration รันไม่สำเร็จบางส่วน');
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
