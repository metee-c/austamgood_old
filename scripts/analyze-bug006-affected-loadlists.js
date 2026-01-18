/**
 * Script: Analyze Loadlists Affected by BUG-006
 * 
 * วัตถุประสงค์: หา loadlists ที่รอโหลดแต่สต็อคไม่พอที่ Dispatch
 * เนื่องจากยืนยันหยิบก่อนแก้ไข BUG-006 (Migration 229/230)
 * 
 * วิธีใช้:
 * node scripts/analyze-bug006-affected-loadlists.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// วันที่แก้ไข BUG-006 (Migration 229/230)
const BUG_FIX_DATE = '2026-01-18';

async function analyzeAffectedLoadlists() {
  console.log('🔍 Analyzing Loadlists Affected by BUG-006\n');
  console.log('='.repeat(70));
  console.log(`Bug fix date: ${BUG_FIX_DATE}`);
  console.log('Documents picked before this date may have stock issues.\n');
  
  // 1. หา pending loadlists ทั้งหมด
  const { data: loadlists, error } = await supabase
    .from('loadlists')
    .select(`
      id,
      loadlist_code,
      status,
      created_at
    `)
    .eq('status', 'pending')
    .order('created_at');
  
  if (error) {
    console.error('Error fetching loadlists:', error);
    return;
  }
  
  console.log(`📦 Found ${loadlists.length} pending loadlists\n`);
  
  const affectedLoadlists = [];
  const okLoadlists = [];
  
  for (const loadlist of loadlists) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📋 ${loadlist.loadlist_code} (ID: ${loadlist.id})`);
    console.log(`   Created: ${loadlist.created_at}`);
    
    const issues = [];
    const skuShortages = {};
    
    // 2. ตรวจสอบ Face Sheets
    const { data: faceSheetLinks } = await supabase
      .from('loadlist_face_sheets')
      .select('face_sheet_id')
      .eq('loadlist_id', loadlist.id);
    
    const faceSheetIds = faceSheetLinks?.map(fs => fs.face_sheet_id) || [];
    
    if (faceSheetIds.length > 0) {
      console.log(`   📄 Face Sheets: ${faceSheetIds.length}`);
      
      const { data: faceSheets } = await supabase
        .from('face_sheets')
        .select('id, face_sheet_no, picking_completed_at')
        .in('id', faceSheetIds);
      
      for (const fs of faceSheets || []) {
        const pickedAt = fs.picking_completed_at;
        const pickedBeforeFix = pickedAt && pickedAt < BUG_FIX_DATE;
        
        if (pickedBeforeFix) {
          console.log(`      ${fs.face_sheet_no}: picked at ${pickedAt} (BEFORE FIX)`);
          
          // หา items
          const { data: fsItems } = await supabase
            .from('face_sheet_items')
            .select('sku_id, quantity_picked, status')
            .eq('face_sheet_id', fs.id)
            .eq('status', 'picked');
          
          for (const item of fsItems || []) {
            // เช็คสต็อคที่ Dispatch
            const { data: dispatchStock } = await supabase
              .from('wms_inventory_balances')
              .select('total_piece_qty, reserved_piece_qty')
              .eq('location_id', 'Dispatch')
              .eq('sku_id', item.sku_id);
            
            const available = (dispatchStock || []).reduce(
              (sum, b) => sum + (Number(b.total_piece_qty || 0) - Number(b.reserved_piece_qty || 0)), 0
            );
            
            if (!skuShortages[item.sku_id]) {
              skuShortages[item.sku_id] = { needed: 0, available, source: 'FS' };
            }
            skuShortages[item.sku_id].needed += Number(item.quantity_picked || 0);
          }
        }
      }
    }
    
    // 3. ตรวจสอบ Bonus Face Sheets
    const { data: bfsLinks } = await supabase
      .from('wms_loadlist_bonus_face_sheets')
      .select('bonus_face_sheet_id')
      .eq('loadlist_id', loadlist.id);
    
    const bfsIds = bfsLinks?.map(bfs => bfs.bonus_face_sheet_id) || [];
    
    if (bfsIds.length > 0) {
      console.log(`   🎁 Bonus Face Sheets: ${bfsIds.length}`);
      
      const { data: bonusFaceSheets } = await supabase
        .from('bonus_face_sheets')
        .select('id, face_sheet_no, picking_completed_at')
        .in('id', bfsIds);
      
      for (const bfs of bonusFaceSheets || []) {
        const pickedAt = bfs.picking_completed_at;
        const pickedBeforeFix = pickedAt && pickedAt < BUG_FIX_DATE;
        
        if (pickedBeforeFix) {
          console.log(`      ${bfs.face_sheet_no}: picked at ${pickedAt} (BEFORE FIX)`);
          
          // หา items
          const { data: bfsItems } = await supabase
            .from('bonus_face_sheet_items')
            .select('sku_id, quantity_picked, status')
            .eq('face_sheet_id', bfs.id)
            .eq('status', 'picked');
          
          for (const item of bfsItems || []) {
            // เช็คสต็อคที่ MRTD และ PQTD
            const { data: transitStock } = await supabase
              .from('wms_inventory_balances')
              .select('total_piece_qty, reserved_piece_qty')
              .in('location_id', ['MRTD', 'PQTD'])
              .eq('sku_id', item.sku_id);
            
            const available = (transitStock || []).reduce(
              (sum, b) => sum + (Number(b.total_piece_qty || 0) - Number(b.reserved_piece_qty || 0)), 0
            );
            
            if (!skuShortages[item.sku_id]) {
              skuShortages[item.sku_id] = { needed: 0, available, source: 'BFS' };
            }
            skuShortages[item.sku_id].needed += Number(item.quantity_picked || 0);
          }
        }
      }
    }
    
    // 4. ตรวจสอบ Picklists
    const { data: plLinks } = await supabase
      .from('wms_loadlist_picklists')
      .select('picklist_id')
      .eq('loadlist_id', loadlist.id);
    
    const plIds = plLinks?.map(pl => pl.picklist_id) || [];
    
    if (plIds.length > 0) {
      console.log(`   📝 Picklists: ${plIds.length}`);
      
      const { data: picklists } = await supabase
        .from('picklists')
        .select('id, picklist_code, picking_completed_at')
        .in('id', plIds);
      
      for (const pl of picklists || []) {
        const pickedAt = pl.picking_completed_at;
        const pickedBeforeFix = pickedAt && pickedAt < BUG_FIX_DATE;
        
        if (pickedBeforeFix) {
          console.log(`      ${pl.picklist_code}: picked at ${pickedAt} (BEFORE FIX)`);
          
          // หา items
          const { data: plItems } = await supabase
            .from('picklist_items')
            .select('sku_id, quantity_picked, status')
            .eq('picklist_id', pl.id)
            .eq('status', 'picked');
          
          for (const item of plItems || []) {
            const { data: dispatchStock } = await supabase
              .from('wms_inventory_balances')
              .select('total_piece_qty, reserved_piece_qty')
              .eq('location_id', 'Dispatch')
              .eq('sku_id', item.sku_id);
            
            const available = (dispatchStock || []).reduce(
              (sum, b) => sum + (Number(b.total_piece_qty || 0) - Number(b.reserved_piece_qty || 0)), 0
            );
            
            if (!skuShortages[item.sku_id]) {
              skuShortages[item.sku_id] = { needed: 0, available, source: 'PL' };
            }
            skuShortages[item.sku_id].needed += Number(item.quantity_picked || 0);
          }
        }
      }
    }
    
    // 5. สรุปว่ามี shortage หรือไม่
    let hasShortage = false;
    for (const [sku, data] of Object.entries(skuShortages)) {
      const shortage = data.needed - data.available;
      if (shortage > 0) {
        hasShortage = true;
        console.log(`   ⚠️  ${sku}: need ${data.needed}, available ${data.available} (shortage: ${shortage})`);
        issues.push({ sku, needed: data.needed, available: data.available, shortage, source: data.source });
      }
    }
    
    if (hasShortage) {
      console.log(`   ❌ STATUS: HAS SHORTAGE`);
      affectedLoadlists.push({ loadlist, issues });
    } else if (Object.keys(skuShortages).length > 0) {
      console.log(`   ✅ STATUS: STOCK OK`);
      okLoadlists.push(loadlist);
    } else {
      console.log(`   ℹ️  STATUS: No pre-bug-fix items (OK)`);
      okLoadlists.push(loadlist);
    }
  }
  
  // 6. สรุป
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n✅ Loadlists OK (can complete loading): ${okLoadlists.length}`);
  okLoadlists.forEach(l => console.log(`   - ${l.loadlist_code}`));
  
  console.log(`\n❌ Loadlists with shortage (need stock fix): ${affectedLoadlists.length}`);
  affectedLoadlists.forEach(({ loadlist, issues }) => {
    console.log(`   - ${loadlist.loadlist_code}:`);
    issues.forEach(i => console.log(`     • ${i.sku}: shortage ${i.shortage} (from ${i.source})`));
  });
  
  // 7. สรุป SKU ที่ต้องย้าย
  const allShortages = {};
  affectedLoadlists.forEach(({ issues }) => {
    issues.forEach(i => {
      if (!allShortages[i.sku]) allShortages[i.sku] = 0;
      allShortages[i.sku] += i.shortage;
    });
  });
  
  if (Object.keys(allShortages).length > 0) {
    console.log('\n📦 Total stock to move to Dispatch:');
    for (const [sku, qty] of Object.entries(allShortages)) {
      console.log(`   ${sku}: ${qty} pieces`);
    }
    
    console.log('\n💡 Next step: Check where stock is located');
    console.log('   Then manually move stock to Dispatch or use stock movement function');
  } else {
    console.log('\n✅ All loadlists are OK - no stock shortage detected!');
  }
}

analyzeAffectedLoadlists()
  .then(() => {
    console.log('\n✅ Analysis complete');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
