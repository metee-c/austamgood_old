
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debugTripsAndContracts() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const planId = 267;

    console.log('--- Checking receiving_route_trips for plan_id:', planId);
    const { data: trips, error: tripsError } = await supabase
        .from('receiving_route_trips')
        .select('*')
        .eq('plan_id', planId);

    if (tripsError) {
        console.error('Error fetching trips:', tripsError);
    } else {
        console.log(`Found ${trips.length} trips:`);
        trips.forEach(t => {
            console.log(`- Trip ID: ${t.trip_id}, Supplier ID: ${t.supplier_id}, Vehicle: ${t.vehicle_label}`);
        });
    }

    console.log('\n--- Checking transport_contracts for plan_id:', planId);
    const { data: contracts, error: contractsError } = await supabase
        .from('transport_contracts')
        .select('*')
        .eq('plan_id', planId);

    if (contractsError) {
        console.error('Error fetching contracts:', contractsError);
    } else {
        console.log('Contracts in DB:', contracts);
    }
}

debugTripsAndContracts();
