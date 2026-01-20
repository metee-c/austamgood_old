/**
 * Script: Add stock for BFS 67 to fix loading issues
 * Adds stock to MRTD location.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addStockForBFS67() {
    console.log('='.repeat(100));
    console.log('📦 Adding Stock for BFS 67 (BFS-20260120-new?)');
    console.log('='.repeat(100));

    const BFS_ID = 67;
    const TARGET_LOC = 'MRTD';

    // 1. Get Location ID
    const { data: loc } = await supabase
        .from('master_location')
        .select('location_id')
        .eq('location_code', TARGET_LOC)
        .single();

    if (!loc) { console.error('Location MRTD not found'); return; }

    // 2. Get BFS Items
    const { data: items } = await supabase
        .from('bonus_face_sheet_items')
        .select('sku_id, quantity_to_pick, quantity_picked')
        .eq('face_sheet_id', BFS_ID);

    if (!items || items.length === 0) { console.error('No items in BFS 67'); return; }

    console.log(`Found ${items.length} items in BFS ${BFS_ID}`);

    // 3. Process each item
    for (const item of items) {
        const qtyNeed = item.quantity_to_pick || item.quantity_picked || 0;
        if (qtyNeed <= 0) continue;

        // Check current balance
        const { data: balances } = await supabase
            .from('wms_inventory_balances')
            .select('balance_id, total_piece_qty')
            .eq('warehouse_id', 'WH001')
            .eq('location_id', loc.location_id)
            .eq('sku_id', item.sku_id);

        const currentQty = (balances || []).reduce((sum, b) => sum + Number(b.total_piece_qty), 0);

        // Add extra 100 just to be safe
        const targetQty = qtyNeed + 100;

        if (currentQty < targetQty) {
            const qtyToAdd = targetQty - currentQty;
            console.log(`🔧 SKU ${item.sku_id}: Need ${qtyNeed}, Have ${currentQty} -> Adding ${qtyToAdd}`);

            // Insert or Update
            if (balances && balances.length > 0) {
                // Update first balance
                const bal = balances[0];
                await supabase
                    .from('wms_inventory_balances')
                    .update({ total_piece_qty: Number(bal.total_piece_qty) + qtyToAdd })
                    .eq('balance_id', bal.balance_id);
            } else {
                // Insert new balance
                await supabase
                    .from('wms_inventory_balances')
                    .insert({
                        warehouse_id: 'WH001',
                        location_id: loc.location_id,
                        sku_id: item.sku_id,
                        total_piece_qty: targetQty,
                        total_pack_qty: 0, // Simplified
                        expiry_date: '2026-12-31' // Dummy
                    });
            }

            // Add Ledger transaction (Incoming)
            await supabase.from('wms_inventory_ledger').insert({
                warehouse_id: 'WH001',
                location_id: loc.location_id,
                sku_id: item.sku_id,
                piece_qty: qtyToAdd,
                direction: 'in',
                reference_doc_type: 'adjustment_fix',
                reference_no: `FIX_BFS_${BFS_ID}_${Date.now()}`,
                transaction_type: 'adjustment'
            });

        } else {
            console.log(`✅ SKU ${item.sku_id}: Sufficient stock (${currentQty} >= ${qtyNeed})`);
        }
    }

    console.log('\n✅ Stock adjustment complete!');
}

addStockForBFS67().catch(console.error);
