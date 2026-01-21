
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSkuBalance() {
    const skuId = 'B-NET-C|SAL|010'; // SKU from user report

    console.log(`Checking balances for SKU: ${skuId}`);

    // 1. Fetch individual balance records
    const { data: balances, error } = await supabase
        .from('wms_inventory_balances')
        .select(`
      balance_id,
      location_id,
      total_piece_qty,
      reserved_piece_qty,
      production_date,
      expiry_date
    `)
        .eq('sku_id', skuId);

    if (error) {
        console.error('Error fetching balances:', error);
        return;
    }

    console.log(`Found ${balances.length} balance records:`);

    let totalSum = 0;
    let availableSum = 0;

    console.log('--- DETAILS ---');
    balances.forEach(b => {
        if (b.total_piece_qty > 0) {
            console.log(`ID: ${b.balance_id} | Loc: ${b.location_id.padEnd(15)} | Total: ${b.total_piece_qty.toString().padEnd(6)} | Reserved: ${b.reserved_piece_qty} | Prod: ${b.production_date}`);
            totalSum += b.total_piece_qty;
            availableSum += (b.total_piece_qty - b.reserved_piece_qty);
        }
    });

    console.log('--- SUMMARY ---');
    console.log(`Total Sum (DB): ${totalSum}`);
    console.log(`Available Sum (DB): ${availableSum}`);
}

checkSkuBalance();
