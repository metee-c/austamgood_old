
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLedger() {
    const MOVE_NO = 'MV-202601-1088';
    console.log(`🔍 Checking Inventory Ledger for: ${MOVE_NO}`);

    // 1. Check Ledger
    const { data: ledgers, error } = await supabase
        .from('wms_inventory_ledger')
        .select('*')
        .eq('reference_no', MOVE_NO);

    if (error) {
        console.error('❌ Error fetching ledger:', error);
        return;
    }

    console.log(`📊 Found ${ledgers.length} ledger records.`);

    if (ledgers.length > 0) {
        console.table(ledgers.map(l => ({
            id: l.ledger_id,
            type: l.transaction_type,
            direction: l.direction,
            qty: l.piece_qty,
            loc: l.location_id,
            sku: l.sku_id,
            time: l.movement_at
        })));
    } else {
        console.log('🔴 No ledger records found! (Inventory NOT moved)');
    }

    // 2. Check Items status again
    const { data: items } = await supabase
        .from('wms_move_items')
        .select('move_item_id, status, confirmed_piece_qty')
        .eq('move_id', 1195); // ID from previous check

    console.log(`📦 Items status check:`);
    console.table(items);
}

checkLedger().catch(console.error);
