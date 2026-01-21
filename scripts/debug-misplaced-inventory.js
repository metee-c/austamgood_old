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

async function debugMisplacedInventory() {
    console.log('=== DEBUG: Misplaced Inventory Report ===\n');

    // 1. Get all preparation areas
    const { data: prepAreas } = await supabase
        .from('preparation_area')
        .select('area_id, area_code, area_name')
        .eq('status', 'active');

    const prepAreaCodes = prepAreas?.map(p => p.area_code) || [];
    const prepAreaIdToCodeMap = new Map(prepAreas?.map(p => [p.area_id, p.area_code]) || []);

    console.log(`Total active preparation areas: ${prepAreas?.length || 0}`);

    // 2. Get SKU to designated home mapping from sku_preparation_area_mapping
    const { data: skuMappings } = await supabase
        .from('sku_preparation_area_mapping')
        .select('sku_id, preparation_area_id, priority, is_primary')
        .order('priority', { ascending: true });

    console.log(`Total sku_preparation_area_mapping records: ${skuMappings?.length || 0}`);

    // Build SKU -> designated home (area_code) map
    const skuDesignatedHomeMap = new Map();
    for (const mapping of (skuMappings || [])) {
        const skuId = mapping.sku_id;
        const areaCode = prepAreaIdToCodeMap.get(mapping.preparation_area_id);
        if (areaCode && !skuDesignatedHomeMap.has(skuId)) {
            skuDesignatedHomeMap.set(skuId, areaCode);
        }
    }

    console.log(`SKUs with designated homes: ${skuDesignatedHomeMap.size}`);

    // 3. Get inventory in preparation areas
    const { data: inventoryData } = await supabase
        .from('wms_inventory_balances')
        .select(`
            balance_id,
            sku_id,
            location_id,
            total_piece_qty
        `)
        .in('location_id', prepAreaCodes)
        .gt('total_piece_qty', 0)
        .limit(50);

    console.log(`\nInventory in preparation areas (sample of 50):`);

    let misplacedCount = 0;
    let correctCount = 0;
    let noMappingCount = 0;

    inventoryData?.forEach((item, i) => {
        const currentLocation = item.location_id;
        const designatedHome = skuDesignatedHomeMap.get(item.sku_id);

        let status = '';
        if (!designatedHome) {
            status = 'NO_MAPPING';
            noMappingCount++;
        } else if (currentLocation !== designatedHome) {
            status = 'MISPLACED';
            misplacedCount++;
        } else {
            status = 'CORRECT';
            correctCount++;
        }

        console.log(`${i + 1}. SKU: ${item.sku_id}`);
        console.log(`   Current: ${currentLocation}`);
        console.log(`   Designated: ${designatedHome || 'N/A'}`);
        console.log(`   Status: ${status}`);
        console.log('');
    });

    console.log(`\n=== Summary ===`);
    console.log(`Correct location: ${correctCount}`);
    console.log(`Misplaced: ${misplacedCount}`);
    console.log(`No mapping: ${noMappingCount}`);

    // 4. Check a specific SKU that might be showing wrong
    console.log(`\n=== Detailed check for sample SKUs ===`);

    // Get some SKUs from the misplaced report
    const sampleSkus = [
        'TT-BEY-C|MCK|0005',
        'B-BEY-D|SAL|NS|012',
        'TT-BEY-D|CNL|0005'
    ];

    for (const skuId of sampleSkus) {
        console.log(`\n--- SKU: ${skuId} ---`);

        // Check sku_preparation_area_mapping
        const { data: mappings } = await supabase
            .from('sku_preparation_area_mapping')
            .select(`
                preparation_area_id,
                priority,
                is_primary,
                preparation_area:preparation_area (area_code, area_name)
            `)
            .eq('sku_id', skuId)
            .order('priority', { ascending: true });

        if (mappings?.length > 0) {
            console.log('Mappings in sku_preparation_area_mapping:');
            mappings.forEach(m => {
                const prep = m.preparation_area;
                console.log(`  - Area: ${prep?.area_code} (${prep?.area_name}), Priority: ${m.priority}, Primary: ${m.is_primary}`);
            });
        } else {
            console.log('No mapping in sku_preparation_area_mapping');
        }

        // Check master_sku.default_location
        const { data: sku } = await supabase
            .from('master_sku')
            .select('default_location')
            .eq('sku_id', skuId)
            .single();

        console.log(`master_sku.default_location: ${sku?.default_location || 'N/A'}`);

        // Check current inventory locations
        const { data: balances } = await supabase
            .from('wms_inventory_balances')
            .select('location_id, total_piece_qty')
            .eq('sku_id', skuId)
            .gt('total_piece_qty', 0);

        console.log('Current inventory locations:');
        balances?.forEach(b => {
            console.log(`  - ${b.location_id}: ${b.total_piece_qty} pieces`);
        });
    }
}

debugMisplacedInventory();
