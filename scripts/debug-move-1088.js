
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMoveStatus() {
    const MOVE_NO = 'MV-202601-1088';
    console.log(`🔍 Checking Move: ${MOVE_NO}`);

    // 1. Get Move Info
    const { data: move, error: moveError } = await supabase
        .from('wms_moves')
        .select('*')
        .eq('move_no', MOVE_NO)
        .single();

    if (moveError || !move) {
        console.error('❌ Move not found:', moveError);
        return;
    }

    console.log('✅ Move Found:', {
        id: move.move_id,
        status: move.status,
        type: move.move_type,
        created_at: move.created_at
    });

    // 2. Get Move Items
    const { data: items, error: itemsError } = await supabase
        .from('wms_move_items')
        .select('move_item_id, sku_id, status, move_method, requested_piece_qty')
        .eq('move_id', move.move_id);

    if (itemsError) {
        console.error('❌ Error fetching items:', itemsError);
        return;
    }

    console.log(`📦 Found ${items.length} items:`);
    if (items.length > 0) {
        console.table(items);

        // Check pending count
        const pendingCount = items.filter(i => i.status === 'pending').length;
        console.log(`Summary: Total=${items.length}, Pending=${pendingCount}`);

        if (pendingCount === 0) {
            console.log('⚠️ Why 0 pending? Check statuses in table above.');
        }
    } else {
        console.log('⚠️ No items found in this move!');
    }
}

checkMoveStatus().catch(console.error);
