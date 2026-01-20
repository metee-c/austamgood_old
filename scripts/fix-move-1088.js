
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixMove() {
    const MOVE_NO = 'MV-202601-1088';
    console.log(`🛠️ Fixing Move: ${MOVE_NO} (Resetting to Pending)`);

    // 1. Get Move info
    const { data: move } = await supabase
        .from('wms_moves')
        .select('move_id')
        .eq('move_no', MOVE_NO)
        .single();

    if (!move) {
        console.error('❌ Move not found!');
        return;
    }

    const moveId = move.move_id;
    console.log(`Processing Move ID: ${moveId}`);

    // 2. Reset Items Status
    const { error: itemError } = await supabase
        .from('wms_move_items')
        .update({
            status: 'pending',
            confirmed_pack_qty: 0,
            confirmed_piece_qty: 0,
            started_at: null,
            completed_at: null
        })
        .eq('move_id', moveId);

    if (itemError) {
        console.error('❌ Error updating items:', itemError);
    } else {
        console.log('✅ Items reset to PENDING');
    }

    // 3. Reset Header Status
    const { error: headerError } = await supabase
        .from('wms_moves')
        .update({
            status: 'pending',
            completed_at: null
        })
        .eq('move_id', moveId);

    if (headerError) {
        console.error('❌ Error updating header:', headerError);
    } else {
        console.log('✅ Header reset to PENDING');
    }

    // 4. Ensure no partial ledger exists (Cleanup)
    const { count, error: delError } = await supabase
        .from('wms_inventory_ledger')
        .delete()
        .eq('reference_no', MOVE_NO);

    if (!delError) {
        console.log(`🧹 Cleaned up inventory ledger records.`);
    }

    console.log('🏁 FIX COMPLETE. Please refresh the page and try assigning/completing again.');
}

fixMove().catch(console.error);
