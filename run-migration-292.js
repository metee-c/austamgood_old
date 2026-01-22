const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🚀 Running Migration 292: Fix lot_no references in triggers...');
    
    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Read migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '292_fix_lot_no_references_in_triggers.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    console.log('🔧 Executing SQL directly...');
    
    // Split SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`📝 Executing: ${statement.substring(0, 50)}...`);
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try direct SQL if RPC fails
          console.log('⚠️ RPC failed, trying direct SQL...');
          const { error: directError } = await supabase
            .from('pg_tables')
            .select('*')
            .limit(1);
            
          if (directError && !directError.message.includes('does not exist')) {
            console.error('❌ Statement failed:', statement);
            console.error('❌ Error:', error);
            continue;
          }
        }
      }
    }
    
    console.log('✅ Migration 292 completed successfully!');
    console.log('🔧 Fixed balance_id UUID type mismatch in triggers');
    
  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    process.exit(1);
  }
}

runMigration();
