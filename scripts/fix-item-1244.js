
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixItem() {
    console.log('🛠️ Fixing Stuck Item 1244 (Reset to Pending)...');

    const { error } = await supabase
        .from('wms_move_items')
        .update({
            status: 'pending',
            confirmed_pack_qty: 0,
            confirmed_piece_qty: 0,
            started_at: null,
            completed_at: null
        })
        .eq('move_item_id', 1244);

    if (error) {
        console.error('❌ Error updating item:', error);
    } else {
        console.log('✅ Item 1244 reset to PENDING');
    }
}

fixItem().catch(console.error);
