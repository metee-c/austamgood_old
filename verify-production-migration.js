// Script to verify if migration 278 is applied on production
// Run this against your production Supabase instance

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Use production credentials
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyMigration() {
  console.log('🔍 Verifying migration 278 on production...\n');

  // Check if function exists
  const { data: functions, error: funcError } = await supabase
    .rpc('pg_get_functiondef', { funcoid: 'sync_move_item_to_ledger'::regproc })
    .single();

  if (funcError) {
    console.log('❌ Function sync_move_item_to_ledger NOT FOUND');
    console.log('   Error:', funcError.message);
    console.log('\n⚠️  Migration 278 has NOT been applied to production yet!');
    console.log('\n📝 To fix:');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Run the migration file: supabase/migrations/278_create_move_items_to_ledger_trigger.sql');
    console.log('   3. Or use: supabase db push (if using Supabase CLI)');
    return false;
  }

  console.log('✅ Function sync_move_item_to_ledger EXISTS');

  // Check if triggers exist
  const { data: triggers, error: trigError } = await supabase
    .from('information_schema.triggers')
    .select('trigger_name, event_manipulation')
    .eq('event_object_table', 'wms_move_items')
    .in('trigger_name', [
      'trigger_sync_move_item_to_ledger_insert',
      'trigger_sync_move_item_to_ledger_update'
    ]);

  if (trigError) {
    console.log('❌ Error checking triggers:', trigError.message);
    return false;
  }

  if (!triggers || triggers.length === 0) {
    console.log('❌ Triggers NOT FOUND on wms_move_items table');
    console.log('\n⚠️  Migration 278 may be partially applied!');
    return false;
  }

  console.log(`✅ Found ${triggers.length} trigger(s):`);
  triggers.forEach(t => {
    console.log(`   - ${t.trigger_name} (${t.event_manipulation})`);
  });

  console.log('\n✅ Migration 278 is properly applied to production!');
  console.log('\n📝 Next steps:');
  console.log('   1. Make sure the latest code is deployed to Vercel');
  console.log('   2. Test the move functionality on production');
  
  return true;
}

verifyMigration()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
