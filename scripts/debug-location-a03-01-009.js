
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLocation() {
    const locationCode = 'A03-01-009';
    console.log(`Checking location: ${locationCode}`);

    // 1. Get Location Details
    const { data: location, error: locError } = await supabase
        .from('master_location')
        .select('*')
        .eq('location_code', locationCode)
        .single();

    if (locError) {
        console.error('Error fetching location:', locError);
        return;
    }

    console.log('Location Details:', {
        location_id: location.location_id,
        location_code: location.location_code,
        current_qty: location.current_qty,
        current_weight_kg: location.current_weight_kg,
        status: location.active_status || location.status // Check status field name
    });

    // 2. Check Inventory Balances
    const { data: balances, error: balError } = await supabase
        .from('wms_inventory_balances')
        .select('*')
        .eq('location_id', location.location_id);

    if (balError) {
        console.error('Error fetching balances:', balError);
        return;
    }

    console.log(`Found ${balances.length} inventory records.`);

    let actualQty = 0;
    if (balances.length > 0) {
        balances.forEach(b => {
            console.log(`- SKU: ${b.sku_id}, Qty: ${b.qty_piec}, Pallet: ${b.pallet_id}`);
            actualQty += (b.qty_piec || b.quantity || 0); // Adjust based on actual column name
        });
    } else {
        console.log('No inventory records found for this location.');
    }

    console.log('--- Comparison ---');
    console.log(`Location Table Qty: ${location.current_qty}`);
    console.log(`Calculated Balances Qty: ${actualQty}`);

    if (location.current_qty !== actualQty) {
        console.log('MISMATCH DETECTED!');
    }
}

checkLocation();
