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

async function debugMappingMismatch() {
    console.log('=== DEBUG: Preparation Area Names vs Mapped SKUs ===\n');

    // Get all preparation areas with their mapped SKUs
    const { data: prepAreas } = await supabase
        .from('preparation_area')
        .select(`
            area_id,
            area_code,
            area_name
        `)
        .eq('status', 'active')
        .like('area_code', 'A%')
        .order('area_code');

    console.log(`Found ${prepAreas?.length || 0} preparation areas starting with A\n`);

    for (const area of (prepAreas || [])) {
        // Get SKUs mapped to this area
        const { data: mappings } = await supabase
            .from('sku_preparation_area_mapping')
            .select('sku_id')
            .eq('preparation_area_id', area.area_id);

        const mappedSkus = mappings?.map(m => m.sku_id) || [];

        // Extract SKU from area_name (if it follows pattern "บ้านหยิบเฉพาะ XXX")
        const match = area.area_name?.match(/บ้านหยิบเฉพาะ (.+)/);
        const expectedSku = match ? match[1] : null;

        // Check if the area name's SKU is in the mapped SKUs
        const nameMatchesMappedSku = expectedSku && mappedSkus.includes(expectedSku);

        console.log(`${area.area_code}: ${area.area_name}`);
        console.log(`  Mapped SKUs: ${mappedSkus.join(', ') || 'None'}`);
        if (expectedSku) {
            console.log(`  Expected SKU from name: ${expectedSku}`);
            console.log(`  Name matches mapped?: ${nameMatchesMappedSku ? 'YES ✓' : 'NO ✗'}`);
        }
        console.log('');
    }
}

debugMappingMismatch();
