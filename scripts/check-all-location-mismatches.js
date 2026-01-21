
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

async function checkAllLocationMismatches() {
    console.log('Checking for all locations with metadata mismatch...');
    console.log('Condition: master_location has qty/weight BUT wms_inventory_balances is empty.');

    // 1. Fetch all locations that claim to have items
    const { data: locations, error: locError } = await supabase
        .from('master_location')
        .select('location_id, location_code, current_qty, current_weight_kg')
        .or('current_qty.gt.0,current_weight_kg.gt.0');

    if (locError) {
        console.error('Error fetching locations:', locError);
        return;
    }

    console.log(`Found ${locations.length} locations claiming to have items.`);

    if (locations.length === 0) {
        console.log('No locations found with current_qty > 0 or current_weight_kg > 0.');
        return;
    }

    // 2. Fetch all location_ids that actually have balances
    // Using .in() might be too large if we have thousands of locations, 
    // but let's try to get all unique location_ids from balances first.
    // Instead of fetching all balances, we can fetch distinct location_ids.
    // However, Supabase doesn't support .distinct() easily on a column directly in JS client without rpc or some tricks.
    // But we can just fetch 'location_id' from balances. If there are many records, it might be heavy.
    // A better approach for "all" check might be to check in batches or use a smart query.
    // Given this is a script, fetching all location_ids from balances (only the column) should be fine for a WMS of this size unless it's massive.

    const { data: balances, error: balError } = await supabase
        .from('wms_inventory_balances')
        .select('location_id');

    if (balError) {
        console.error('Error fetching balances:', balError);
        return;
    }

    // Create a Set of location_ids that actually have inventory
    const occupiedLocationIds = new Set();
    balances.forEach(b => {
        if (b.location_id) occupiedLocationIds.add(b.location_id);
    });

    console.log(`Found ${occupiedLocationIds.size} locations with actual inventory records.`);

    // 3. Find mismatches
    const mismatches = [];

    locations.forEach(loc => {
        if (!occupiedLocationIds.has(loc.location_id)) {
            mismatches.push(loc);
        }
    });

    console.log('\n--- Mismatch Report ---');
    if (mismatches.length === 0) {
        console.log('✅ No mismatches found. All locations showing quantity have corresponding inventory records.');
    } else {
        console.log(`❌ Found ${mismatches.length} problematic locations.`);
        console.log('These locations show Qty/Weight in master data but have NO inventory records:');
        console.table(mismatches.map(m => ({
            'Location Code': m.location_code,
            'Current Qty': m.current_qty,
            'Current Weight': m.current_weight_kg
        })));

        console.log('\nTo fix these, we should reset their current_qty and current_weight_kg to 0.');
    }
}

checkAllLocationMismatches();
