/**
 * Script to run VRP migration
 * This creates the necessary tables for the VRP system
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function runMigration() {
  console.log('🚀 Starting VRP migration...\n');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Read migration file
  const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20241110_create_vrp_tables.sql');
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

  console.log('📄 Migration file loaded');
  console.log('📊 Executing SQL...\n');

  try {
    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
      if (statement.includes('COMMENT ON') || statement.includes('CREATE POLICY')) {
        // Skip comments and policies for now
        continue;
      }

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          console.error(`❌ Error executing statement:`, error.message);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err: any) {
        console.error(`❌ Error:`, err.message);
        errorCount++;
      }
    }

    console.log('\n✅ Migration completed!');
    console.log(`   Success: ${successCount} statements`);
    console.log(`   Errors: ${errorCount} statements`);

    if (errorCount === 0) {
      console.log('\n🎉 All tables created successfully!');
      console.log('\nCreated tables:');
      console.log('  - receiving_route_plan_trips');
      console.log('  - receiving_route_plan_stops');
      console.log('  - receiving_route_plan_stop_orders');
      console.log('  - receiving_route_plan_metrics');
    }

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration
runMigration().catch(console.error);
