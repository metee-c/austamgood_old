// Check if shadow tables exist
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkTables() {
  console.log('Checking shadow tables...\n');

  const tables = [
    'wms_transactions',
    'wms_activity_logs', 
    'wms_activity_log_items',
    'wms_errors',
    'wms_user_intents',
    'wms_stock_snapshots'
  ];

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: OK (${data.length} rows sampled)`);
    }
  }

  console.log('\n--- Counts ---');
  
  const { count: txCount } = await supabase.from('wms_transactions').select('*', { count: 'exact', head: true });
  const { count: actCount } = await supabase.from('wms_activity_logs').select('*', { count: 'exact', head: true });
  const { count: errCount } = await supabase.from('wms_errors').select('*', { count: 'exact', head: true });

  console.log(`Transactions: ${txCount || 0}`);
  console.log(`Activities: ${actCount || 0}`);
  console.log(`Errors: ${errCount || 0}`);
}

checkTables().catch(console.error);
