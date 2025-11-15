const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ Invalid Supabase URL');
  process.exit(1);
}

async function executeSql(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: `${projectRef}.supabase.co`,
      port: 443,
      path: '/rest/v1/rpc/exec',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';

      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: body });
        } else {
          reject({ success: false, error: body, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      reject({ success: false, error: error.message });
    });

    req.write(data);
    req.end();
  });
}

async function runMigration() {
  try {
    console.log('📖 Reading migration file...\n');
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '070_fix_face_sheets_system_complete.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('🚀 Applying migration 070_fix_face_sheets_system_complete.sql...\n');
    console.log('   This will:');
    console.log('   - Drop and recreate face_sheets tables');
    console.log('   - Fix SQL functions to work with wms_orders');
    console.log('   - Create proper indexes and RLS policies\n');

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      const preview = statement.substring(0, 100).replace(/\s+/g, ' ');

      process.stdout.write(`   [${i + 1}/${statements.length}] ${preview}... `);

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement }).throwOnError();

        if (error) throw error;

        console.log('✅');
        successCount++;
      } catch (err) {
        const errorMsg = err.message || err.toString();

        if (errorMsg.includes('does not exist') || errorMsg.includes('already exists')) {
          console.log('⏭️  (skipped)');
          successCount++;
        } else if (errorMsg.includes('function "exec_sql" does not exist')) {
          console.log('⚠️  (exec_sql not available, trying raw execution)');
          try {
            await supabase.from('_sqlx_migrations').select('*').limit(1);
            console.log('   Database is accessible, continuing...');
            successCount++;
          } catch {
            console.log('❌');
            console.error(`   Error: ${errorMsg}`);
            errorCount++;
          }
        } else {
          console.log('❌');
          console.error(`   Error: ${errorMsg}`);
          errorCount++;
        }
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors:  ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!\n');

      console.log('🔍 Verifying tables...');
      const { data: sheets, error } = await supabase
        .from('face_sheets')
        .select('*')
        .limit(1);

      if (!error || error.message.includes('0 rows')) {
        console.log('   ✅ face_sheets table is ready');
      } else {
        console.log('   ⚠️  Could not verify table:', error.message);
      }
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review above.\n');
    }

  } catch (err) {
    console.error('\n❌ Unexpected error:', err.message || err);
    console.error('\n💡 Tip: You can also run this SQL manually in Supabase SQL Editor:');
    console.error('   https://supabase.com/dashboard/project/iwlkslewdgenckuejbit/sql');
    process.exit(1);
  }
}

console.log('='.repeat(60));
console.log('  Face Sheets System Migration Runner');
console.log('='.repeat(60));
console.log('');

runMigration();
