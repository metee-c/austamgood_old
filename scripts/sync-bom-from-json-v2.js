/**
 * Script to sync BOM data from bom-data-v2.json to database
 * อ่านจากไฟล์ที่สร้างโดย import-bom-from-excel-v2.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('=== BOM Sync from JSON (v2) ===\n');

  // Read bom-data-v2.json
  const bomData = JSON.parse(fs.readFileSync('bom-data-v2.json', 'utf8'));
  console.log(`Total records in bom-data-v2.json: ${bomData.length}`);

  // Get all SKUs from database
  const { data: skus, error: skuError } = await supabase
    .from('master_sku')
    .select('sku_id, sku_name');

  if (skuError) {
    console.error('Error fetching SKUs:', skuError);
    process.exit(1);
  }

  console.log(`Total SKUs in database: ${skus.length}`);

  // Create lookup map by sku_name
  const skuByName = new Map();
  skus.forEach(sku => {
    skuByName.set(sku.sku_name, sku.sku_id);
  });

  // Get existing BOM records
  const { data: existingBom, error: bomError } = await supabase
    .from('bom_sku')
    .select('finished_sku_id, material_sku_id');

  if (bomError) {
    console.error('Error fetching existing BOM:', bomError);
    process.exit(1);
  }

  console.log(`Existing BOM records: ${existingBom.length}`);

  // Create set of existing BOM combinations
  const existingSet = new Set();
  existingBom.forEach(bom => {
    existingSet.add(`${bom.finished_sku_id}|${bom.material_sku_id}`);
  });

  // Process bom-data-v2.json
  const missingBom = [];
  const missingSkus = { finished: new Set(), material: new Set() };
  const stats = { food: 0, bag: 0, sticker: 0 };

  bomData.forEach(record => {
    const finishedSkuId = skuByName.get(record.finished_product);
    const materialSkuId = skuByName.get(record.material);

    if (!finishedSkuId) {
      missingSkus.finished.add(record.finished_product);
      return;
    }

    if (!materialSkuId) {
      missingSkus.material.add(record.material);
      return;
    }

    const key = `${finishedSkuId}|${materialSkuId}`;
    if (!existingSet.has(key)) {
      stats[record.material_type]++;
      missingBom.push({
        finished_product: record.finished_product,
        finished_sku_id: finishedSkuId,
        material: record.material,
        material_sku_id: materialSkuId,
        material_type: record.material_type
      });
    }
  });

  console.log('\n=== Missing BOM Records ===');
  console.log(`Food: ${stats.food}`);
  console.log(`Bag: ${stats.bag}`);
  console.log(`Sticker: ${stats.sticker}`);
  console.log(`Total missing: ${missingBom.length}`);

  console.log('\n=== Missing SKUs (Finished Products) ===');
  console.log(`Count: ${missingSkus.finished.size}`);
  if (missingSkus.finished.size > 0) {
    Array.from(missingSkus.finished).slice(0, 20).forEach(name => console.log(`  - ${name}`));
    if (missingSkus.finished.size > 20) {
      console.log(`  ... and ${missingSkus.finished.size - 20} more`);
    }
  }

  console.log('\n=== Missing SKUs (Materials) ===');
  console.log(`Count: ${missingSkus.material.size}`);
  if (missingSkus.material.size > 0) {
    Array.from(missingSkus.material).slice(0, 30).forEach(name => console.log(`  - ${name}`));
    if (missingSkus.material.size > 30) {
      console.log(`  ... and ${missingSkus.material.size - 30} more`);
    }
  }

  // Insert missing BOM records
  if (missingBom.length > 0) {
    console.log('\n=== Inserting Missing BOM Records ===');
    
    const bomRecords = missingBom.map((record, index) => {
      let stepName = 'วัตถุดิบ';
      let stepOrder = 1;
      if (record.material_type === 'food') { stepName = 'อาหาร'; stepOrder = 1; }
      else if (record.material_type === 'bag') { stepName = 'ถุง'; stepOrder = 2; }
      else if (record.material_type === 'sticker') { stepName = 'สติ๊กเกอร์'; stepOrder = 3; }

      return {
        bom_id: `BOM-${record.finished_sku_id}-${record.material_type.toUpperCase()}-${Date.now()}-${index}`,
        finished_sku_id: record.finished_sku_id,
        material_sku_id: record.material_sku_id,
        material_qty: 1,
        material_uom: 'ชิ้น',
        step_order: stepOrder,
        step_name: stepName,
        status: 'active',
        created_by: 'system'
      };
    });

    // Insert in batches
    const batchSize = 50;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < bomRecords.length; i += batchSize) {
      const batch = bomRecords.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('bom_sku')
        .insert(batch)
        .select();

      if (error) {
        console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        errors += batch.length;
      } else {
        inserted += data.length;
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}: ${data.length} records`);
      }
    }

    console.log(`\nTotal inserted: ${inserted}`);
    console.log(`Total errors: ${errors}`);
  }

  // Final count
  const { count } = await supabase
    .from('bom_sku')
    .select('*', { count: 'exact', head: true });

  console.log('\n=== Final Status ===');
  console.log(`Total BOM records in database: ${count}`);
}

main().catch(console.error);
