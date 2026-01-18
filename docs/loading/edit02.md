# 🔧 Prompt: Fix BUG-006 Leftover Data - Stock ไม่ได้ย้ายไป Dispatch

## 📋 Problem Summary

**Root Cause:** BUG-006 (Pick Confirmation ไม่ Release Reservation)  
**Impact:** Documents ที่ยืนยันหยิบก่อนแก้ไข Migration 229/230 → สต็อคไม่ได้ย้ายไป Dispatch  
**Result:** ไม่สามารถยืนยันโหลดได้ เพราะสต็อคไม่อยู่ที่ Dispatch

---

## 🔍 Evidence

### Loadlist ที่มีปัญหา
```
Loadlist: LD-20260115-0023 (ID: 220)
- Face Sheets: FS-20260115-000, FS-20260115-001
- ยืนยันหยิบ: ก่อน 18 ม.ค. 2026 (ก่อนแก้ BUG-006)
```

### Stock ที่ต้องการ vs มีจริง
| SKU | ต้องการ | มีที่ Dispatch | ขาด |
|-----|---------|---------------|-----|
| B-BEY-C\|MCK\|NS\|010 | 24 | 12 | **12** |
| B-BEY-D\|MNB\|NS\|010 | 36 | 12 | **24** |

### Timeline
```
1. สร้าง Face Sheet → จองสต็อค (Prep Area)
2. ยืนยันหยิบ (ก่อนแก้บัค) → สต็อคควรย้ายไป Dispatch แต่ไม่ได้ย้าย!
3. Migration 229/230 แก้บัค → แก้เฉพาะ documents ใหม่
4. พยายามยืนยันโหลด → สต็อคไม่พอที่ Dispatch
```

---

## 🎯 Solution Options

### Option 1: ย้ายสต็อคด้วยมือ (แนะนำ)

หาสต็อคที่ควรจะอยู่ที่ Dispatch แล้วย้ายไป:

```sql
-- 1. หาว่าสต็อคอยู่ที่ไหน
SELECT 
  location_id,
  sku_id,
  SUM(total_piece_qty) as total_qty,
  SUM(reserved_piece_qty) as reserved_qty,
  SUM(total_piece_qty - reserved_piece_qty) as available_qty
FROM wms_inventory_balances
WHERE warehouse_id = 'WH001'
AND sku_id IN ('B-BEY-C|MCK|NS|010', 'B-BEY-D|MNB|NS|010')
AND total_piece_qty > 0
GROUP BY location_id, sku_id
ORDER BY location_id;

-- 2. ย้ายสต็อคไป Dispatch (ใช้ stock movement function หรือ manual update)
```

### Option 2: สร้าง Script แก้ไขอัตโนมัติ

```javascript
// scripts/fix-stuck-stock-for-loading.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixStuckStock() {
  // 1. หา loadlists ที่รอยืนยันโหลด
  const { data: pendingLoadlists } = await supabase
    .from('wms_loadlists')
    .select(`
      id,
      loadlist_no,
      face_sheets:wms_loadlist_face_sheets(
        face_sheet_id,
        face_sheet:face_sheets(
          id,
          face_sheet_no,
          status,
          picking_completed_at
        )
      )
    `)
    .eq('status', 'pending')
    .lt('created_at', '2026-01-18');  // ก่อนแก้บัค
  
  console.log(`Found ${pendingLoadlists?.length || 0} pending loadlists created before bug fix`);
  
  for (const loadlist of pendingLoadlists || []) {
    console.log(`\n📦 Processing: ${loadlist.loadlist_no}`);
    
    for (const fsLink of loadlist.face_sheets || []) {
      const fs = fsLink.face_sheet;
      if (!fs || fs.status !== 'picking_completed') continue;
      
      console.log(`  📄 Face Sheet: ${fs.face_sheet_no}`);
      
      // 2. หา items ที่ต้องการ
      const { data: items } = await supabase
        .from('face_sheet_items')
        .select('sku_id, quantity_picked')
        .eq('face_sheet_id', fs.id)
        .eq('status', 'picked');
      
      for (const item of items || []) {
        // 3. เช็คว่าสต็อคอยู่ที่ Dispatch หรือยัง
        const { data: dispatchBalance } = await supabase
          .from('wms_inventory_balances')
          .select('total_piece_qty')
          .eq('location_id', 'Dispatch')
          .eq('sku_id', item.sku_id)
          .single();
        
        const atDispatch = dispatchBalance?.total_piece_qty || 0;
        const needed = item.quantity_picked;
        
        if (atDispatch < needed) {
          console.log(`    ⚠️ ${item.sku_id}: need ${needed}, at Dispatch: ${atDispatch}`);
          
          // 4. หาสต็อคจาก location อื่น
          const { data: otherBalances } = await supabase
            .from('wms_inventory_balances')
            .select('balance_id, location_id, total_piece_qty')
            .eq('sku_id', item.sku_id)
            .neq('location_id', 'Dispatch')
            .gt('total_piece_qty', 0);
          
          console.log(`       Available at other locations:`, 
            otherBalances?.map(b => `${b.location_id}: ${b.total_piece_qty}`).join(', '));
          
          // 5. TODO: ย้ายสต็อคไป Dispatch
          // await moveStockToDispatch(item.sku_id, needed - atDispatch);
        } else {
          console.log(`    ✅ ${item.sku_id}: OK (${atDispatch} at Dispatch)`);
        }
      }
    }
  }
}

fixStuckStock().catch(console.error);
```

### Option 3: Rollback และทำใหม่

ถ้าสต็อคยุ่งยากเกินไป สามารถ:
1. Rollback Face Sheets (cancel pick confirmation)
2. Reset สต็อคกลับไป Prep Area
3. ยืนยันหยิบใหม่ (หลังแก้บัค)

---

## 📊 Affected Documents Analysis

### Query หา Documents ที่ได้รับผลกระทบ

```sql
-- 1. Face Sheets ที่ยืนยันหยิบก่อนแก้บัค
SELECT 
  fs.face_sheet_no,
  fs.status,
  fs.picking_completed_at,
  COUNT(fsi.id) as item_count,
  SUM(fsi.quantity_picked) as total_qty
FROM face_sheets fs
JOIN face_sheet_items fsi ON fs.id = fsi.face_sheet_id
WHERE fs.status = 'picking_completed'
AND fs.picking_completed_at < '2026-01-18'  -- ก่อนแก้บัค
AND fsi.status = 'picked'
GROUP BY fs.id, fs.face_sheet_no, fs.status, fs.picking_completed_at
ORDER BY fs.picking_completed_at;

-- 2. หา loadlists ที่รอโหลดและมี Face Sheets จากข้างบน
SELECT 
  l.loadlist_no,
  l.status,
  l.created_at,
  array_agg(DISTINCT fs.face_sheet_no) as face_sheets
FROM wms_loadlists l
JOIN wms_loadlist_face_sheets lfs ON l.id = lfs.loadlist_id
JOIN face_sheets fs ON fs.id = lfs.face_sheet_id
WHERE l.status = 'pending'
AND fs.picking_completed_at < '2026-01-18'
GROUP BY l.id, l.loadlist_no, l.status, l.created_at
ORDER BY l.created_at;

-- 3. สรุปว่าต้องย้ายสต็อคเท่าไหร่
SELECT 
  fsi.sku_id,
  SUM(fsi.quantity_picked) as total_needed,
  (
    SELECT COALESCE(SUM(total_piece_qty), 0) 
    FROM wms_inventory_balances 
    WHERE location_id = 'Dispatch' 
    AND sku_id = fsi.sku_id
  ) as at_dispatch,
  SUM(fsi.quantity_picked) - (
    SELECT COALESCE(SUM(total_piece_qty), 0) 
    FROM wms_inventory_balances 
    WHERE location_id = 'Dispatch' 
    AND sku_id = fsi.sku_id
  ) as shortage
FROM face_sheet_items fsi
JOIN face_sheets fs ON fs.id = fsi.face_sheet_id
JOIN wms_loadlist_face_sheets lfs ON fs.id = lfs.face_sheet_id
JOIN wms_loadlists l ON l.id = lfs.loadlist_id
WHERE l.status = 'pending'
AND fs.picking_completed_at < '2026-01-18'
AND fsi.status = 'picked'
GROUP BY fsi.sku_id
HAVING SUM(fsi.quantity_picked) > (
  SELECT COALESCE(SUM(total_piece_qty), 0) 
  FROM wms_inventory_balances 
  WHERE location_id = 'Dispatch' 
  AND sku_id = fsi.sku_id
);
```

---

## 🛠️ Migration 231: Fix Stuck Stock (Optional)

ถ้าต้องการแก้ไขอัตโนมัติ:

```sql
-- Migration 231: Fix stock not moved to Dispatch for pre-bug-fix documents

-- สร้าง function แก้ไขสต็อค
CREATE OR REPLACE FUNCTION fix_stuck_stock_for_loading(
  p_loadlist_id BIGINT
)
RETURNS TABLE(
  sku_id VARCHAR,
  qty_moved NUMERIC,
  from_location VARCHAR,
  to_location VARCHAR
) LANGUAGE plpgsql AS $func$
DECLARE
  v_item RECORD;
  v_shortage NUMERIC;
  v_source_balance RECORD;
  v_moved NUMERIC := 0;
BEGIN
  -- หา items ที่ต้องการสำหรับ loadlist นี้
  FOR v_item IN
    SELECT 
      fsi.sku_id,
      SUM(fsi.quantity_picked) as needed
    FROM wms_loadlist_face_sheets lfs
    JOIN face_sheet_items fsi ON fsi.face_sheet_id = lfs.face_sheet_id
    WHERE lfs.loadlist_id = p_loadlist_id
    AND fsi.status = 'picked'
    GROUP BY fsi.sku_id
  LOOP
    -- เช็คว่า Dispatch มีพอไหม
    SELECT COALESCE(SUM(total_piece_qty), 0) INTO v_shortage
    FROM wms_inventory_balances
    WHERE location_id = 'Dispatch'
    AND sku_id = v_item.sku_id;
    
    v_shortage := v_item.needed - v_shortage;
    
    IF v_shortage > 0 THEN
      -- หาสต็อคจาก location อื่น
      FOR v_source_balance IN
        SELECT balance_id, location_id, total_piece_qty
        FROM wms_inventory_balances
        WHERE sku_id = v_item.sku_id
        AND location_id != 'Dispatch'
        AND total_piece_qty > 0
        ORDER BY total_piece_qty DESC
      LOOP
        EXIT WHEN v_shortage <= 0;
        
        v_moved := LEAST(v_shortage, v_source_balance.total_piece_qty);
        
        -- ลดจาก source
        UPDATE wms_inventory_balances
        SET total_piece_qty = total_piece_qty - v_moved
        WHERE balance_id = v_source_balance.balance_id;
        
        -- เพิ่มที่ Dispatch (upsert)
        INSERT INTO wms_inventory_balances (
          warehouse_id, location_id, sku_id, total_piece_qty
        )
        SELECT 'WH001', 'Dispatch', v_item.sku_id, v_moved
        ON CONFLICT (warehouse_id, location_id, sku_id, pallet_id, lot_no, production_date)
        DO UPDATE SET total_piece_qty = wms_inventory_balances.total_piece_qty + v_moved;
        
        v_shortage := v_shortage - v_moved;
        
        RETURN QUERY SELECT 
          v_item.sku_id::VARCHAR,
          v_moved,
          v_source_balance.location_id::VARCHAR,
          'Dispatch'::VARCHAR;
      END LOOP;
    END IF;
  END LOOP;
END;
$func$;
```

---

## 📝 Recommended Action

### สำหรับ 28 Loadlists ที่รอโหลด:

1. **รัน Query วิเคราะห์** - ดูว่ากี่ใบที่ได้รับผลกระทบ
2. **แยกประเภท:**
   - ใบที่สต็อคพอ → ยืนยันโหลดได้เลย
   - ใบที่สต็อคไม่พอ → ต้องย้ายสต็อค
3. **ย้ายสต็อค** - ใช้ script หรือทำด้วยมือ
4. **ยืนยันโหลด** - หลังจากสต็อคพร้อมแล้ว

---

## ⚠️ Important Notes

1. **ไม่ใช่บัคใหม่** - เป็นผลกระทบจาก BUG-006 ที่แก้ไปแล้ว
2. **Migration 229/230 แก้เฉพาะ documents ใหม่** - ไม่ได้แก้ documents เก่า
3. **ต้องแก้ไข data ด้วยมือ** - สำหรับ documents ที่ยืนยันหยิบก่อนแก้บัค
4. **ตรวจสอบทุก Loadlist** - ก่อนยืนยันโหลด ให้เช็คว่าสต็อคพร้อม

---

## 🎯 Expected Outcome

หลังแก้ไขสต็อค:
```
📊 SKU B-BEY-C|MCK|NS|010: need 24, available 24 at Dispatch ✅
📊 SKU B-BEY-D|MNB|NS|010: need 36, available 36 at Dispatch ✅

✅ Stock check complete. Insufficient items: 0
POST /api/mobile/loading/complete 200 OK
```


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
    .from('wms_loadlists')
    .select(`
      id,
      loadlist_no,
      status,
      created_at,
      face_sheets:wms_loadlist_face_sheets(
        face_sheet_id
      ),
      bonus_face_sheets:wms_loadlist_bonus_face_sheets(
        bonus_face_sheet_id
      ),
      picklists:wms_loadlist_picklists(
        picklist_id
      )
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
    console.log(`📋 ${loadlist.loadlist_no} (ID: ${loadlist.id})`);
    console.log(`   Created: ${loadlist.created_at}`);
    
    const issues = [];
    const skuShortages = {};
    
    // 2. ตรวจสอบ Face Sheets
    const faceSheetIds = loadlist.face_sheets?.map(fs => fs.face_sheet_id) || [];
    if (faceSheetIds.length > 0) {
      console.log(`   📄 Face Sheets: ${faceSheetIds.length}`);
      
      const { data: fsItems } = await supabase
        .from('face_sheet_items')
        .select(`
          sku_id,
          quantity_picked,
          status,
          face_sheet:face_sheets!inner(
            face_sheet_no,
            picking_completed_at
          )
        `)
        .in('face_sheet_id', faceSheetIds)
        .eq('status', 'picked');
      
      for (const item of fsItems || []) {
        const pickedAt = item.face_sheet?.picking_completed_at;
        const pickedBeforeFix = pickedAt && pickedAt < BUG_FIX_DATE;
        
        if (pickedBeforeFix) {
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
    
    // 3. ตรวจสอบ Bonus Face Sheets (เช็คที่ MRTD/PQTD)
    const bfsIds = loadlist.bonus_face_sheets?.map(bfs => bfs.bonus_face_sheet_id) || [];
    if (bfsIds.length > 0) {
      console.log(`   🎁 Bonus Face Sheets: ${bfsIds.length}`);
      
      const { data: bfsItems } = await supabase
        .from('bonus_face_sheet_items')
        .select(`
          sku_id,
          quantity_picked,
          status,
          face_sheet:bonus_face_sheets!inner(
            face_sheet_no,
            picking_completed_at
          )
        `)
        .in('face_sheet_id', bfsIds)
        .eq('status', 'picked');
      
      for (const item of bfsItems || []) {
        const pickedAt = item.face_sheet?.picking_completed_at;
        const pickedBeforeFix = pickedAt && pickedAt < BUG_FIX_DATE;
        
        if (pickedBeforeFix) {
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
    
    // 4. ตรวจสอบ Picklists
    const plIds = loadlist.picklists?.map(pl => pl.picklist_id) || [];
    if (plIds.length > 0) {
      console.log(`   📝 Picklists: ${plIds.length}`);
      
      const { data: plItems } = await supabase
        .from('picklist_items')
        .select(`
          sku_id,
          picked_quantity,
          status,
          picklist:picklists!inner(
            picklist_no,
            completed_at
          )
        `)
        .in('picklist_id', plIds)
        .eq('status', 'picked');
      
      for (const item of plItems || []) {
        const pickedAt = item.picklist?.completed_at;
        const pickedBeforeFix = pickedAt && pickedAt < BUG_FIX_DATE;
        
        if (pickedBeforeFix) {
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
          skuShortages[item.sku_id].needed += Number(item.picked_quantity || 0);
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
  okLoadlists.forEach(l => console.log(`   - ${l.loadlist_no}`));
  
  console.log(`\n❌ Loadlists with shortage (need stock fix): ${affectedLoadlists.length}`);
  affectedLoadlists.forEach(({ loadlist, issues }) => {
    console.log(`   - ${loadlist.loadlist_no}:`);
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
    
    console.log('\n💡 Next step: Run fix script to move stock to Dispatch');
    console.log('   node scripts/fix-stock-for-affected-loadlists.js');
  }
}

analyzeAffectedLoadlists().catch(console.error);

