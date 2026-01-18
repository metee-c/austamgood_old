/**
 * Script: Fix Stock for BUG-006 Affected Loadlists
 * 
 * วัตถุประสงค์: ย้ายสต็อคไปที่ Dispatch/MRTD/PQTD สำหรับ loadlists ที่ได้รับผลกระทบ
 * 
 * วิธีใช้:
 * node scripts/fix-stock-for-affected-loadlists.js [--dry-run] [--loadlist-id=XXX]
 * 
 * Options:
 * --dry-run         แสดงสิ่งที่จะทำแต่ไม่ทำจริง
 * --loadlist-id=XXX แก้เฉพาะ loadlist ที่ระบุ
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SPECIFIC_LOADLIST = args.find(a => a.startsWith('--loadlist-id='))?.split('=')[1];

const WAREHOUSE_ID = 'WH001';

// SKU type detection
function getSkuType(skuId) {
  if (skuId.startsWith('TT-') || skuId.startsWith('PRE-')) return 'tester';
  if (skuId.startsWith('02-STICKER')) return 'sticker';
  return 'bulk';
}

// Destination location based on document type and SKU type
function getDestinationLocation(documentType, skuType) {
  if (documentType === 'bfs') {
    return 'MRTD'; // Bonus Face Sheet → MRTD
  }
  return 'Dispatch'; // Face Sheet, Picklist → Dispatch
}

async function findStockSource(skuId, qtyNeeded, excludeLocations = []) {
  const { data: balances, error } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, location_id, pallet_id, lot_no, production_date, total_piece_qty, reserved_piece_qty')
    .eq('warehouse_id', WAREHOUSE_ID)
    .eq('sku_id', skuId)
    .gt('total_piece_qty', 0)
    .order('total_piece_qty', { ascending: false });
  
  if (error || !balances) {
    console.log(`    ❌ Error finding stock for ${skuId}:`, error?.message);
    return [];
  }
  
  // Filter out excluded locations and find available stock
  const sources = [];
  let remaining = qtyNeeded;
  
  for (const balance of balances) {
    if (remaining <= 0) break;
    if (excludeLocations.includes(balance.location_id)) continue;
    
    const available = Number(balance.total_piece_qty) - Number(balance.reserved_piece_qty || 0);
    if (available <= 0) continue;
    
    const takeQty = Math.min(available, remaining);
    sources.push({
      balance_id: balance.balance_id,
      location_id: balance.location_id,
      pallet_id: balance.pallet_id,
      lot_no: balance.lot_no,
      production_date: balance.production_date,
      qty: takeQty
    });
    remaining -= takeQty;
  }
  
  return sources;
}

async function moveStock(skuId, sources, destinationLocation, reason) {
  const results = [];
  
  for (const source of sources) {
    console.log(`    📦 Moving ${source.qty} pieces from ${source.location_id} to ${destinationLocation}`);
    
    if (DRY_RUN) {
      results.push({ success: true, dry_run: true, qty: source.qty });
      continue;
    }
    
    try {
      // 1. ดึงข้อมูล balance ปัจจุบัน
      const { data: currentBalance, error: fetchError } = await supabase
        .from('wms_inventory_balances')
        .select('total_piece_qty')
        .eq('balance_id', source.balance_id)
        .single();
      
      if (fetchError || !currentBalance) {
        console.log(`      ❌ Error fetching balance:`, fetchError?.message);
        results.push({ success: false, error: fetchError?.message });
        continue;
      }
      
      const newQty = Number(currentBalance.total_piece_qty) - source.qty;
      
      // 2. ลดจาก source
      const { error: decreaseError } = await supabase
        .from('wms_inventory_balances')
        .update({ 
          total_piece_qty: newQty,
          updated_at: new Date().toISOString()
        })
        .eq('balance_id', source.balance_id);
      
      if (decreaseError) {
        console.log(`      ❌ Error decreasing source:`, decreaseError.message);
        results.push({ success: false, error: decreaseError.message });
        continue;
      }
      
      // 2. เพิ่มที่ destination (upsert)
      let existingBalanceQuery = supabase
        .from('wms_inventory_balances')
        .select('balance_id, total_piece_qty')
        .eq('warehouse_id', WAREHOUSE_ID)
        .eq('location_id', destinationLocation)
        .eq('sku_id', skuId);
      
      // Handle NULL values for pallet_id and lot_no
      if (source.pallet_id) {
        existingBalanceQuery = existingBalanceQuery.eq('pallet_id', source.pallet_id);
      } else {
        existingBalanceQuery = existingBalanceQuery.is('pallet_id', null);
      }
      
      if (source.lot_no) {
        existingBalanceQuery = existingBalanceQuery.eq('lot_no', source.lot_no);
      } else {
        existingBalanceQuery = existingBalanceQuery.is('lot_no', null);
      }
      
      const { data: existingBalance } = await existingBalanceQuery.maybeSingle();
      
      if (existingBalance) {
        // Update existing balance
        const { error: updateError } = await supabase
          .from('wms_inventory_balances')
          .update({ 
            total_piece_qty: Number(existingBalance.total_piece_qty) + source.qty,
            updated_at: new Date().toISOString()
          })
          .eq('balance_id', existingBalance.balance_id);
        
        if (updateError) {
          console.log(`      ❌ Error updating destination:`, updateError.message);
          results.push({ success: false, error: updateError.message });
          continue;
        }
      } else {
        // Insert new balance
        const { error: insertError } = await supabase
          .from('wms_inventory_balances')
          .insert({
            warehouse_id: WAREHOUSE_ID,
            location_id: destinationLocation,
            sku_id: skuId,
            pallet_id: source.pallet_id || null,
            lot_no: source.lot_no || null,
            production_date: source.production_date,
            total_piece_qty: source.qty,
            reserved_piece_qty: 0,
            total_pack_qty: 0,
            reserved_pack_qty: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (insertError) {
          console.log(`      ❌ Error inserting destination:`, insertError.message);
          results.push({ success: false, error: insertError.message });
          continue;
        }
      }
      
      // 3. บันทึก ledger entry
      await supabase
        .from('wms_inventory_ledger')
        .insert({
          warehouse_id: WAREHOUSE_ID,
          sku_id: skuId,
          from_location_id: source.location_id,
          to_location_id: destinationLocation,
          piece_qty_change: source.qty,
          reference_doc_type: 'BUG_FIX',
          reference_doc_no: `BUG006-FIX-${Date.now()}`,
          notes: reason,
          created_at: new Date().toISOString()
        });
      
      console.log(`      ✅ Moved successfully`);
      results.push({ success: true, qty: source.qty });
      
    } catch (err) {
      console.log(`      ❌ Error:`, err.message);
      results.push({ success: false, error: err.message });
    }
  }
  
  return results;
}

async function fixLoadlist(loadlistId, loadlistCode) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`📋 Processing: ${loadlistCode} (ID: ${loadlistId})`);
  console.log(`${'═'.repeat(70)}`);
  
  const shortages = [];
  
  // 1. หา Face Sheet items
  const { data: fsLinks } = await supabase
    .from('loadlist_face_sheets')
    .select('face_sheet_id')
    .eq('loadlist_id', loadlistId);
  
  const faceSheetIds = fsLinks?.map(l => l.face_sheet_id) || [];
  
  if (faceSheetIds.length > 0) {
    const { data: fsItems } = await supabase
      .from('face_sheet_items')
      .select('sku_id, quantity_picked')
      .in('face_sheet_id', faceSheetIds)
      .eq('status', 'picked');
    
    // Group by SKU
    const fsBysku = {};
    (fsItems || []).forEach(item => {
      if (!fsBysku[item.sku_id]) fsBysku[item.sku_id] = 0;
      fsBysku[item.sku_id] += Number(item.quantity_picked || 0);
    });
    
    for (const [skuId, needed] of Object.entries(fsBysku)) {
      const { data: dispatchBalance } = await supabase
        .from('wms_inventory_balances')
        .select('total_piece_qty, reserved_piece_qty')
        .eq('location_id', 'Dispatch')
        .eq('sku_id', skuId);
      
      const available = (dispatchBalance || []).reduce(
        (sum, b) => sum + (Number(b.total_piece_qty || 0) - Number(b.reserved_piece_qty || 0)), 0
      );
      
      if (available < needed) {
        shortages.push({
          sku_id: skuId,
          needed,
          available,
          shortage: needed - available,
          doc_type: 'fs',
          destination: 'Dispatch'
        });
      }
    }
  }
  
  // 2. หา Bonus Face Sheet items
  const { data: bfsLinks } = await supabase
    .from('loadlist_bonus_face_sheets')
    .select('bonus_face_sheet_id')
    .eq('loadlist_id', loadlistId);
  
  const bfsIds = bfsLinks?.map(l => l.bonus_face_sheet_id) || [];
  
  if (bfsIds.length > 0) {
    const { data: bfsItems } = await supabase
      .from('bonus_face_sheet_items')
      .select('sku_id, quantity_picked')
      .in('face_sheet_id', bfsIds)
      .eq('status', 'picked');
    
    // Group by SKU
    const bfsBysku = {};
    (bfsItems || []).forEach(item => {
      if (!bfsBysku[item.sku_id]) bfsBysku[item.sku_id] = 0;
      bfsBysku[item.sku_id] += Number(item.quantity_picked || 0);
    });
    
    for (const [skuId, needed] of Object.entries(bfsBysku)) {
      const { data: mrtdBalance } = await supabase
        .from('wms_inventory_balances')
        .select('total_piece_qty, reserved_piece_qty')
        .in('location_id', ['MRTD', 'PQTD'])
        .eq('sku_id', skuId);
      
      const available = (mrtdBalance || []).reduce(
        (sum, b) => sum + (Number(b.total_piece_qty || 0) - Number(b.reserved_piece_qty || 0)), 0
      );
      
      if (available < needed) {
        shortages.push({
          sku_id: skuId,
          needed,
          available,
          shortage: needed - available,
          doc_type: 'bfs',
          destination: 'MRTD'
        });
      }
    }
  }
  
  // 3. หา Picklist items
  const { data: plLinks } = await supabase
    .from('loadlist_picklists')
    .select('picklist_id')
    .eq('loadlist_id', loadlistId);
  
  const picklistIds = plLinks?.map(l => l.picklist_id) || [];
  
  if (picklistIds.length > 0) {
    const { data: plItems } = await supabase
      .from('picklist_items')
      .select('sku_id, picked_quantity')
      .in('picklist_id', picklistIds)
      .eq('status', 'picked');
    
    // Group by SKU
    const plBysku = {};
    (plItems || []).forEach(item => {
      if (!plBysku[item.sku_id]) plBysku[item.sku_id] = 0;
      plBysku[item.sku_id] += Number(item.picked_quantity || 0);
    });
    
    for (const [skuId, needed] of Object.entries(plBysku)) {
      const { data: dispatchBalance } = await supabase
        .from('wms_inventory_balances')
        .select('total_piece_qty, reserved_piece_qty')
        .eq('location_id', 'Dispatch')
        .eq('sku_id', skuId);
      
      const available = (dispatchBalance || []).reduce(
        (sum, b) => sum + (Number(b.total_piece_qty || 0) - Number(b.reserved_piece_qty || 0)), 0
      );
      
      if (available < needed) {
        shortages.push({
          sku_id: skuId,
          needed,
          available,
          shortage: needed - available,
          doc_type: 'pl',
          destination: 'Dispatch'
        });
      }
    }
  }
  
  // 4. แก้ไข shortages
  if (shortages.length === 0) {
    console.log(`\n✅ No shortages - loadlist is ready for loading!`);
    return { success: true, fixed: 0, failed: 0 };
  }
  
  console.log(`\n📊 Found ${shortages.length} SKUs with shortage:`);
  
  let fixed = 0;
  let failed = 0;
  
  for (const shortage of shortages) {
    console.log(`\n  🔍 ${shortage.sku_id} (${shortage.doc_type.toUpperCase()})`);
    console.log(`     Need: ${shortage.needed}, Available at ${shortage.destination}: ${shortage.available}`);
    console.log(`     Shortage: ${shortage.shortage} pieces`);
    
    // หาแหล่งสต็อค
    const sources = await findStockSource(
      shortage.sku_id, 
      shortage.shortage, 
      [shortage.destination, 'MRTD', 'PQTD', 'Dispatch'] // exclude destinations
    );
    
    if (sources.length === 0) {
      console.log(`     ⚠️ No stock available in warehouse!`);
      failed++;
      continue;
    }
    
    const totalFound = sources.reduce((sum, s) => sum + s.qty, 0);
    console.log(`     Found ${totalFound} pieces from ${sources.length} locations`);
    
    if (totalFound < shortage.shortage) {
      console.log(`     ⚠️ Only partial stock available (${totalFound}/${shortage.shortage})`);
    }
    
    // ย้ายสต็อค
    const results = await moveStock(
      shortage.sku_id,
      sources,
      shortage.destination,
      `BUG-006 fix for ${loadlistCode}`
    );
    
    const successCount = results.filter(r => r.success).length;
    if (successCount > 0) {
      fixed++;
    } else {
      failed++;
    }
  }
  
  console.log(`\n📊 Result: Fixed ${fixed}/${shortages.length}, Failed: ${failed}`);
  
  return { success: failed === 0, fixed, failed };
}

async function main() {
  console.log('🔧 Fix Stock for BUG-006 Affected Loadlists\n');
  console.log('='.repeat(70));
  
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No actual changes will be made\n');
  }
  
  // หา pending loadlists
  let query = supabase
    .from('loadlists')
    .select('id, loadlist_code, status, created_at')
    .eq('status', 'pending')
    .order('created_at');
  
  if (SPECIFIC_LOADLIST) {
    query = query.eq('id', SPECIFIC_LOADLIST);
  }
  
  const { data: loadlists, error } = await query;
  
  if (error) {
    console.error('Error fetching loadlists:', error);
    return;
  }
  
  console.log(`Found ${loadlists.length} pending loadlists\n`);
  
  const results = {
    success: [],
    partial: [],
    failed: []
  };
  
  for (const loadlist of loadlists) {
    const result = await fixLoadlist(loadlist.id, loadlist.loadlist_code);
    
    if (result.success && result.fixed > 0) {
      results.success.push(loadlist.loadlist_code);
    } else if (result.fixed > 0) {
      results.partial.push(loadlist.loadlist_code);
    } else if (result.failed > 0) {
      results.failed.push(loadlist.loadlist_code);
    } else {
      results.success.push(loadlist.loadlist_code); // No shortage
    }
  }
  
  // สรุป
  console.log('\n\n' + '═'.repeat(70));
  console.log('📊 FINAL SUMMARY');
  console.log('═'.repeat(70));
  
  console.log(`\n✅ Ready for loading (${results.success.length}):`);
  results.success.forEach(l => console.log(`   - ${l}`));
  
  if (results.partial.length > 0) {
    console.log(`\n⚠️ Partially fixed (${results.partial.length}):`);
    results.partial.forEach(l => console.log(`   - ${l}`));
  }
  
  if (results.failed.length > 0) {
    console.log(`\n❌ Could not fix (${results.failed.length}):`);
    results.failed.forEach(l => console.log(`   - ${l}`));
  }
  
  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN - run without --dry-run to apply changes');
  }
}

main().catch(console.error);
