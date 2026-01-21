
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

async function fixAllLocationMismatches() {
    console.log('Starting Batch Fix for Location Mismatches...');

    // 1. Fetch all locations with potential issues
    const { data: locations, error: locError } = await supabase
        .from('master_location')
        .select('location_id, location_code, current_qty, current_weight_kg')
        .or('current_qty.gt.0,current_weight_kg.gt.0');

    if (locError) {
        console.error('Error fetching locations:', locError);
        return;
    }

    // 2. Fetch occupied location IDs
    const { data: balances, error: balError } = await supabase
        .from('wms_inventory_balances')
        .select('location_id');

    if (balError) {
        console.error('Error fetching balances:', balError);
        return;
    }

    const occupiedLocationIds = new Set();
    balances.forEach(b => {
        if (b.location_id) occupiedLocationIds.add(b.location_id);
    });

    // 3. Identify targets
    const targets = [];
    locations.forEach(loc => {
        if (!occupiedLocationIds.has(loc.location_id)) {
            targets.push(loc.location_id);
        }
    });

    console.log(`Found ${targets.length} locations to fix.`);

    if (targets.length === 0) {
        console.log('No locations to fix.');
        return;
    }

    // 4. Batch Update (Process in chunks to avoid timeout/payload limits)
    const CHUNK_SIZE = 50;
    let processedCount = 0;

    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
        const chunkIds = targets.slice(i, i + CHUNK_SIZE);

        const { error: updateError } = await supabase
            .from('master_location')
            .update({
                current_qty: 0,
                current_weight_kg: 0,
                updated_at: new Date().toISOString()
            })
            .in('location_id', chunkIds);

        if (updateError) {
            console.error(`Error updating chunk ${i / CHUNK_SIZE + 1}:`, updateError);
        } else {
            processedCount += chunkIds.length;
            console.log(`Updated ${processedCount}/${targets.length} locations...`);
        }
    }

    console.log('Batch fix completed successfully.');
}

fixAllLocationMismatches();
