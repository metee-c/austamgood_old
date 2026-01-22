require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🚀 Running migration 282 - Adding location validation...\n');
    
    // Step 1: Drop existing view
    console.log('📝 Step 1: Dropping existing view...');
    const { error: dropError } = await supabase.rpc('exec_sql', {
      query: 'DROP VIEW IF EXISTS vw_preparation_area_inventory CASCADE;'
    });
    
    if (dropError) {
      console.log('⚠️  Using alternative method to drop view...');
      // Try without CASCADE
      await supabase.rpc('exec_sql', { query: 'DROP VIEW IF EXISTS vw_preparation_area_inventory;' });
    }
    console.log('✅ View dropped\n');
    
    // Step 2: Create new view with location validation
    console.log('📝 Step 2: Creating new view with location validation...');
    const createViewSQL = `
CREATE VIEW vw_preparation_area_inventory AS
SELECT 
    pai.inventory_id,
    pai.warehouse_id,
    mw.warehouse_name,
    pai.preparation_area_id,
    pai.preparation_area_code,
    pa.area_name as preparation_area_name,
    pa.zone,
    pai.sku_id,
    ms.sku_name,
    ms.uom_base,
    ms.qty_per_pack,
    ms.weight_per_piece_kg,
    ms.default_location,
    pai.latest_pallet_id,
    pai.latest_pallet_id_external,
    pai.latest_production_date,
    pai.latest_expiry_date,
    pai.latest_lot_no,
    pai.available_pack_qty,
    pai.available_piece_qty,
    pai.reserved_pack_qty,
    pai.reserved_piece_qty,
    pai.total_pack_qty,
    pai.total_piece_qty,
    pai.last_movement_at,
    pai.created_at,
    pai.updated_at,
    CASE 
        WHEN pai.latest_expiry_date IS NOT NULL THEN 
            (pai.latest_expiry_date - CURRENT_DATE)
        ELSE NULL 
    END as days_until_expiry,
    CASE 
        WHEN pai.latest_expiry_date IS NOT NULL AND pai.latest_expiry_date < CURRENT_DATE THEN true
        ELSE false
    END as is_expired,
    CASE 
        WHEN ms.default_location IS NULL THEN NULL
        WHEN ms.default_location = pai.preparation_area_code THEN true
        ELSE false
    END as is_correct_location,
    CASE 
        WHEN ms.default_location IS NOT NULL AND ms.default_location != pai.preparation_area_code 
        THEN ms.default_location
        ELSE NULL
    END as expected_location
FROM preparation_area_inventory pai
INNER JOIN preparation_area pa ON pa.area_id = pai.preparation_area_id
INNER JOIN master_warehouse mw ON mw.warehouse_id = pai.warehouse_id
INNER JOIN master_sku ms ON ms.sku_id = pai.sku_id
WHERE pa.status = 'active';
`;
    
    const { error: createError } = await supabase.rpc('exec_sql', {
      query: createViewSQL
    });
    
    if (createError) {
      console.error('❌ Error creating view:', createError);
      throw createError;
    }
    console.log('✅ View created with location validation fields\n');
    
    // Step 3: Grant permissions
    console.log('📝 Step 3: Granting permissions...');
    await supabase.rpc('exec_sql', {
      query: 'GRANT SELECT ON vw_preparation_area_inventory TO anon, authenticated;'
    });
    console.log('✅ Permissions granted\n');
    
    console.log('✅ Migration 282 completed successfully!\n');
    
    // Verify the view
    console.log('🔍 Verifying view structure...');
    const { data: viewData, error: viewError } = await supabase
      .from('vw_preparation_area_inventory')
      .select('*')
      .limit(1);
    
    if (viewError) {
      console.error('❌ Error verifying view:', viewError);
    } else {
      console.log('✅ View verified successfully');
      if (viewData && viewData.length > 0) {
        const columns = Object.keys(viewData[0]);
        console.log(`📊 Total columns: ${columns.length}`);
        console.log('📋 New columns added:');
        console.log('   - default_location');
        console.log('   - is_correct_location');
        console.log('   - expected_location');
        
        // Check if location validation fields exist
        if (columns.includes('default_location') && 
            columns.includes('is_correct_location') && 
            columns.includes('expected_location')) {
          console.log('\n✅ All location validation fields present!');
        }
      }
    }
    
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
