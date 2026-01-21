
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

async function fixLocationMismatch() {
    const locationCode = 'A03-01-009';
    console.log(`Fixing mismatch for location: ${locationCode}`);

    // 1. Verify Mismatch (Double Check)
    // Get Location Details
    const { data: location, error: locError } = await supabase
        .from('master_location')
        .select('*')
        .eq('location_code', locationCode)
        .single();

    if (locError) {
        console.error('Error fetching location:', locError);
        return;
    }

    // Check Inventory Balances
    const { count, error: balError } = await supabase
        .from('wms_inventory_balances')
        .select('*', { count: 'exact', head: true })
        .eq('location_id', location.location_id);

    if (balError) {
        console.error('Error fetching balances:', balError);
        return;
    }

    console.log(`Current Master Data -> Qty: ${location.current_qty}, Weight: ${location.current_weight_kg}`);
    console.log(`Actual Inventory Count matches: ${count}`);

    if (count === 0 && (location.current_qty > 0 || location.current_weight_kg > 0)) {
        console.log('Mismatch confirmed. Resetting location master data...');

        const { data: updated, error: updateError } = await supabase
            .from('master_location')
            .update({
                current_qty: 0,
                current_weight_kg: 0,
                updated_at: new Date().toISOString()
            })
            .eq('location_id', location.location_id)
            .select()
            .single();

        if (updateError) {
            console.error('Failed to update location:', updateError);
        } else {
            console.log('Location updated successfully!');
            console.log(`New Master Data -> Qty: ${updated.current_qty}, Weight: ${updated.current_weight_kg}`);
        }
    } else {
        console.log('No mismatch detected or conditions not met for auto-fix.');
        if (count > 0) {
            console.log('Warning: There are actual inventory balances, so we cannot simply zero out the location without investigating specific items.');
        }
    }
}

fixLocationMismatch();
