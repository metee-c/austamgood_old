
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

async function debugPreparationAreaMapping() {
    console.log('=== DEBUG: SKU Preparation Area Mapping ===\n');

    // 1. Check how many records exist in sku_preparation_area_mapping
    const { count: mappingCount, error: countError } = await supabase
        .from('sku_preparation_area_mapping')
        .select('*', { count: 'exact', head: true });

    console.log(`Total sku_preparation_area_mapping records: ${mappingCount}`);

    if (countError) {
        console.error('Error counting:', countError);
    }

    // 2. Get sample of sku_preparation_area_mapping with preparation_area join
    const { data: sampleMappings, error: sampleError } = await supabase
        .from('sku_preparation_area_mapping')
        .select(`
            mapping_id,
            sku_id,
            warehouse_id,
            preparation_area_id,
            priority,
            is_primary,
            preparation_area:preparation_area (
                area_id,
                area_code,
                area_name,
                zone
            )
        `)
        .limit(10);

    if (sampleError) {
        console.error('Error fetching sample:', sampleError);
    } else {
        console.log('\nSample mappings (first 10):');
        sampleMappings.forEach((m, i) => {
            const prep = m.preparation_area;
            console.log(`${i + 1}. SKU: ${m.sku_id} -> Area Code: ${prep?.area_code || 'N/A'} (${prep?.area_name || 'N/A'})`);
        });
    }

    // 3. Check preparation_area table
    const { count: prepAreaCount } = await supabase
        .from('preparation_area')
        .select('*', { count: 'exact', head: true });

    console.log(`\nTotal preparation_area records: ${prepAreaCount}`);

    // 4. Sample preparation_area records
    const { data: prepAreas } = await supabase
        .from('preparation_area')
        .select('area_id, area_code, area_name, zone')
        .limit(10);

    console.log('\nSample preparation areas (first 10):');
    prepAreas?.forEach((p, i) => {
        console.log(`${i + 1}. Code: ${p.area_code}, Name: ${p.area_name}`);
    });

    // 5. Test query with specific location
    const testLocationCode = 'A01-01-002'; // Change this to test different locations
    console.log(`\n=== Testing location_code: ${testLocationCode} ===`);

    // First check if preparation_area exists with that code
    const { data: prepArea } = await supabase
        .from('preparation_area')
        .select('*')
        .eq('area_code', testLocationCode)
        .maybeSingle();

    if (prepArea) {
        console.log(`Found preparation_area:`, prepArea);

        // Now check mapping
        const { data: mappings } = await supabase
            .from('sku_preparation_area_mapping')
            .select('*')
            .eq('preparation_area_id', prepArea.area_id);

        console.log(`Found ${mappings?.length || 0} SKU mappings for this area`);
        mappings?.forEach(m => {
            console.log(`  - SKU: ${m.sku_id}, Primary: ${m.is_primary}`);
        });
    } else {
        console.log(`No preparation_area found with area_code = ${testLocationCode}`);
    }
}

debugPreparationAreaMapping();
