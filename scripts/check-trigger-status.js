// Check if trigger is working
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get latest activity logs
  const { data: activities } = await s
    .from('wms_activity_logs')
    .select('log_id, activity_type, logged_at')
    .order('logged_at', { ascending: false })
    .limit(5);

  console.log('=== Latest 5 Activity Logs ===');
  activities?.forEach(x => console.log(`  ${x.log_id}: ${x.activity_type} @ ${x.logged_at}`));

  // Get latest ledger entries
  const { data: ledger } = await s
    .from('wms_inventory_ledger')
    .select('ledger_id, transaction_type, direction, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n=== Latest 5 Ledger Entries ===');
  ledger?.forEach(x => console.log(`  ${x.ledger_id}: ${x.transaction_type}_${x.direction} @ ${x.created_at}`));

  // Compare timestamps
  const latestActivity = activities?.[0]?.logged_at;
  const latestLedger = ledger?.[0]?.created_at;

  console.log('\n=== Comparison ===');
  console.log('Latest Activity:', latestActivity);
  console.log('Latest Ledger:', latestLedger);

  if (latestLedger && latestActivity) {
    const actDate = new Date(latestActivity);
    const ledDate = new Date(latestLedger);
    
    if (ledDate > actDate) {
      console.log('\n⚠️ Ledger has newer entries than Activity Logs!');
      console.log('   Trigger may not be working or needs time to sync.');
    } else {
      console.log('\n✅ Activity logs are up to date with ledger.');
    }
  }

  // Count totals
  const { count: actCount } = await s.from('wms_activity_logs').select('*', { count: 'exact', head: true });
  const { count: ledCount } = await s.from('wms_inventory_ledger').select('*', { count: 'exact', head: true });

  console.log('\n=== Totals ===');
  console.log('Activity Logs:', actCount);
  console.log('Ledger Entries:', ledCount);
}

check();
