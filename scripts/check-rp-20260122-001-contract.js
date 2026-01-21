
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkTransportContract() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const planCode = 'RP-20260122-001';

    // 1. Find plan_id
    const { data: plan, error: planError } = await supabase
        .from('receiving_route_plans')
        .select('plan_id, plan_code, plan_date')
        .eq('plan_code', planCode)
        .single();

    if (planError) {
        console.error('Error finding plan:', planError);
        return;
    }

    console.log('Found plan:', plan);

    // 2. Find transport contracts for this plan
    const { data: contracts, error: contractError } = await supabase
        .from('transport_contracts')
        .select('*')
        .eq('plan_id', plan.plan_id);

    if (contractError) {
        console.error('Error finding contracts:', contractError);
        return;
    }

    console.log('Transport contracts for this plan:', contracts);

    // 3. Find trips and their suppliers for this plan
    const { data: trips, error: tripError } = await supabase
        .from('receiving_route_trips')
        .select('trip_id, supplier_id, supplier_name')
        .eq('plan_id', plan.plan_id);

    if (tripError) {
        console.error('Error finding trips:', tripError);
        return;
    }

    const suppliers = [...new Set(trips.map(t => t.supplier_id))];
    console.log('Suppliers in this plan:', suppliers);

    for (const s of trips) {
        console.log(`Trip ${s.trip_id}: Supplier ${s.supplier_id} (${s.supplier_name})`);
    }
}

checkTransportContract();
