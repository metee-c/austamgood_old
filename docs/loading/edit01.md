# 🔧 Prompt: Fix BUG-007 - Loading Complete Stock Check ผิดพลาด

## 📋 Bug Overview

**Bug ID:** BUG-007  
**Priority:** P0 - CRITICAL  
**Impact:** ไม่สามารถยืนยันโหลดได้ แม้ว่าสต็อกจะเพียงพอ  
**Location:** `app/api/mobile/loading/complete/route.ts`

---

## 🐛 Problem Description

### Symptom
เมื่อกดยืนยันโหลด (Loading Complete) ระบบแจ้งว่า **"Insufficient stock"** แม้ว่าสต็อกจริงจะมีเพียงพอ

### Evidence จาก Log
```
📊 SKU B-BEY-C|MCK|NS|010: need 24, available 12 at Dispatch  ← API บอกว่ามี 12
📊 SKU B-BEY-D|MNB|NS|010: need 36, available 12 at Dispatch  ← API บอกว่ามี 12

❌ Insufficient stock for 2 items
POST /api/mobile/loading/complete 400 in 8.9s
```

### Evidence จาก Database Query ตรง
```sql
-- Query ตรงจาก database
SELECT sku_id, SUM(total_piece_qty) 
FROM wms_inventory_balances 
WHERE location_id = 'Dispatch' 
AND sku_id IN ('B-BEY-C|MCK|NS|010', 'B-BEY-D|MNB|NS|010')
GROUP BY sku_id;

-- Result:
-- B-BEY-C|MCK|NS|010: 29,283 ชิ้น  ← จริงๆ มี 29,283!
-- B-BEY-D|MNB|NS|010: 2,511 ชิ้น   ← จริงๆ มี 2,511!
```

### Root Cause (สมมติฐาน)
API กำลัง query สต็อกผิด - ไม่ได้ SUM ทุก balance หรือ filter ผิด

---

## 🎯 Instructions for AI

### Step 1: อ่าน API Code

```bash
# อ่านไฟล์ loading complete API
cat app/api/mobile/loading/complete/route.ts
```

**สิ่งที่ต้องหา:**
1. ส่วนที่ query `wms_inventory_balances` เพื่อตรวจสอบสต็อก
2. Filter conditions ที่ใช้ (location_id, warehouse_id, etc.)
3. การ SUM หรือ aggregate สต็อก

### Step 2: หา Bug Location

จากข้อมูลเบื้องต้น code อยู่ประมาณบรรทัด 450-550:

```typescript
// บรรทัด ~480-490
const { data: dispatchBalances } = await supabase
  .from('wms_inventory_balances')
  .select('balance_id, total_piece_qty, ...')
  .eq('warehouse_id', warehouseId)
  .eq('location_id', 'Dispatch')  // ← อาจจะ filter ผิด?
  .eq('sku_id', skuId)
  .gt('total_piece_qty', 0);      // ← หรือ condition นี้ทำให้พลาด?

// บรรทัด ~491
const availableQty = (dispatchBalances || []).reduce(
  (sum, b) => sum + Number(b.total_piece_qty || 0), 0
);
```

**สิ่งที่ต้องตรวจสอบ:**
1. `location_id = 'Dispatch'` - ถูกต้องไหม? หรือควรเป็น location อื่น?
2. มี filter อื่นที่ทำให้ไม่เจอ balance บางแถวไหม? (เช่น pallet_id, lot_no)
3. Query return หลาย rows หรือ row เดียว?

### Step 3: Debug Query

สร้าง script เพื่อ debug:

```typescript
// scripts/debug-loading-stock-check.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugStockCheck() {
  const skuIds = ['B-BEY-C|MCK|NS|010', 'B-BEY-D|MNB|NS|010'];
  const warehouseId = 'WH001'; // ปรับตาม warehouse จริง
  
  for (const skuId of skuIds) {
    console.log(`\n🔍 Checking SKU: ${skuId}`);
    
    // Query 1: เหมือน API (อาจจะผิด)
    const { data: apiQuery, error: e1 } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, location_id, total_piece_qty, pallet_id, lot_no')
      .eq('warehouse_id', warehouseId)
      .eq('location_id', 'Dispatch')
      .eq('sku_id', skuId)
      .gt('total_piece_qty', 0);
    
    console.log('API Query result:', apiQuery?.length, 'rows');
    console.log('API Total:', apiQuery?.reduce((s, b) => s + Number(b.total_piece_qty), 0));
    
    // Query 2: ดูทุก balance ของ SKU นี้
    const { data: allBalances, error: e2 } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, location_id, total_piece_qty, pallet_id, lot_no')
      .eq('warehouse_id', warehouseId)
      .eq('sku_id', skuId);
    
    console.log('All balances:', allBalances?.length, 'rows');
    console.log('By location:');
    const byLocation = {};
    allBalances?.forEach(b => {
      byLocation[b.location_id] = (byLocation[b.location_id] || 0) + Number(b.total_piece_qty);
    });
    console.log(byLocation);
  }
}

debugStockCheck();
```

### Step 4: หาสาเหตุที่เป็นไปได้

#### สมมติฐาน 1: location_id ไม่ตรง
```typescript
// อาจจะมีหลาย location ที่เป็น Dispatch
// เช่น 'Dispatch', 'DISPATCH', 'dispatch', 'Dispatch-1'
.eq('location_id', 'Dispatch')  // case-sensitive!
```

**Fix:**
```typescript
// ใช้ ilike หรือ in
.ilike('location_id', 'dispatch%')
// หรือ
.in('location_id', ['Dispatch', 'DISPATCH', 'Dispatch-1'])
```

#### สมมติฐาน 2: warehouse_id ผิด
```typescript
// อาจจะ query warehouse ผิด
.eq('warehouse_id', warehouseId)  // warehouseId มาจากไหน?
```

**Fix:**
ตรวจสอบว่า warehouseId ถูกต้อง

#### สมมติฐาน 3: มี filter ที่ไม่ควรมี
```typescript
// อาจจะมี filter เพิ่มที่ทำให้พลาด
.eq('pallet_id', palletId)  // ถ้า pallet_id ไม่ตรง จะไม่เจอ
.eq('lot_no', lotNo)        // ถ้า lot_no ไม่ตรง จะไม่เจอ
```

**Fix:**
ลบ filter ที่ไม่จำเป็นออก

#### สมมติฐาน 4: ไม่ได้ SUM ทุก balance
```typescript
// อาจจะ query แค่ row เดียว
.single()  // ❌ ถ้าใช้ .single() จะได้แค่ row เดียว
```

**Fix:**
```typescript
// ลบ .single() ออก และ SUM ทุก rows
const { data: balances } = await supabase
  .from('wms_inventory_balances')
  .select('total_piece_qty')
  .eq('location_id', 'Dispatch')
  .eq('sku_id', skuId);

const total = balances?.reduce((sum, b) => sum + Number(b.total_piece_qty || 0), 0) || 0;
```

### Step 5: Implement Fix

เมื่อหาสาเหตุเจอแล้ว ให้แก้ไข:

```typescript
// app/api/mobile/loading/complete/route.ts

// BEFORE (BUG)
const { data: dispatchBalances } = await supabase
  .from('wms_inventory_balances')
  .select('balance_id, total_piece_qty')
  .eq('warehouse_id', warehouseId)
  .eq('location_id', 'Dispatch')
  .eq('sku_id', skuId)
  .eq('some_other_filter', value)  // ← filter ที่ทำให้ผิด
  .gt('total_piece_qty', 0);

// AFTER (FIX)
const { data: dispatchBalances } = await supabase
  .from('wms_inventory_balances')
  .select('balance_id, total_piece_qty')
  .eq('warehouse_id', warehouseId)
  .ilike('location_id', 'dispatch%')  // ← รองรับ case-insensitive
  .eq('sku_id', skuId)
  // ลบ filter ที่ไม่จำเป็นออก
  .gt('total_piece_qty', 0);
```

### Step 6: Test

```bash
# 1. Run debug script
node scripts/debug-loading-stock-check.js

# 2. ลองยืนยันโหลดใหม่
# ไปที่ http://localhost:3000/mobile/loading
# เลือกใบโหลดและกดยืนยัน

# 3. ตรวจสอบ log
# ควรจะ: ✅ Stock check complete. Insufficient items: 0
```

---

## 📝 Checklist

### Analysis
- [ ] อ่าน `app/api/mobile/loading/complete/route.ts`
- [ ] หา query ที่ตรวจสอบสต็อก
- [ ] เปรียบเทียบ query กับ database ตรง
- [ ] ระบุ filter ที่ทำให้ผิด

### Implementation
- [ ] แก้ไข query ให้ถูกต้อง
- [ ] ลบ filter ที่ไม่จำเป็น
- [ ] เพิ่ม logging เพื่อ debug

### Testing
- [ ] Run debug script
- [ ] ทดสอบยืนยันโหลด
- [ ] ตรวจสอบสต็อกหลังโหลด

---

## 🔗 Related Information

### Tables Involved
- `loadlists` - ใบโหลด
- `wms_inventory_balances` - ยอดคงเหลือ
- `face_sheets` / `bonus_face_sheets` / `picklists` - เอกสารที่จะโหลด

### API Endpoint
- `POST /api/mobile/loading/complete`
- File: `app/api/mobile/loading/complete/route.ts`

### Context
- มี 28 ใบโหลดที่รอยืนยัน
- ใบโหลดเหล่านี้สร้างก่อนแก้ไข BUG-006
- หลังแก้ไข BUG-006 สต็อกถูก release กลับไป Dispatch แล้ว

---

## ⚠️ Important Notes

1. **อย่าแก้ไข logic การย้ายสต็อก** - แก้แค่ส่วนตรวจสอบสต็อก
2. **เพิ่ม logging** - เพื่อให้ debug ง่ายในอนาคต
3. **Test กับหลายใบโหลด** - ไม่ใช่แค่ใบเดียว
4. **ตรวจสอบ case-sensitivity** - Dispatch vs dispatch vs DISPATCH

---

## 🎯 Expected Outcome

หลังแก้ไข:
```
📊 SKU B-BEY-C|MCK|NS|010: need 24, available 29283 at Dispatch  ← ถูกต้อง
📊 SKU B-BEY-D|MNB|NS|010: need 36, available 2511 at Dispatch   ← ถูกต้อง

✅ Stock check complete. Insufficient items: 0
POST /api/mobile/loading/complete 200 OK
```



/**
 * Debug Script: Loading Complete Stock Check
 * 
 * วัตถุประสงค์: หาสาเหตุว่าทำไม API บอกว่าสต็อกไม่พอ แต่จริงๆ มีพอ
 * 
 * วิธีใช้:
 * node scripts/debug-loading-stock-check.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// SKUs ที่มีปัญหา (จาก log)
const PROBLEM_SKUS = [
  'B-BEY-C|MCK|NS|010',  // API: 12, จริง: 29,283
  'B-BEY-D|MNB|NS|010'   // API: 12, จริง: 2,511
];

const WAREHOUSE_ID = 'WH001'; // ปรับตาม warehouse จริง

async function debugStockCheck() {
  console.log('🔍 Debug Loading Complete Stock Check\n');
  console.log('='.repeat(60));
  
  for (const skuId of PROBLEM_SKUS) {
    console.log(`\n📦 SKU: ${skuId}`);
    console.log('-'.repeat(60));
    
    // 1. Query แบบ API ปัจจุบัน (ที่อาจจะผิด)
    console.log('\n1️⃣ Query แบบ API (location_id = "Dispatch"):');
    const { data: apiQuery, error: e1 } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, location_id, total_piece_qty, reserved_piece_qty, pallet_id, lot_no')
      .eq('warehouse_id', WAREHOUSE_ID)
      .eq('location_id', 'Dispatch')
      .eq('sku_id', skuId)
      .gt('total_piece_qty', 0);
    
    if (e1) console.log('   Error:', e1.message);
    console.log(`   Rows found: ${apiQuery?.length || 0}`);
    const apiTotal = apiQuery?.reduce((s, b) => s + Number(b.total_piece_qty || 0), 0) || 0;
    console.log(`   Total qty: ${apiTotal}`);
    if (apiQuery?.length > 0) {
      console.log('   Sample rows:');
      apiQuery.slice(0, 3).forEach(b => {
        console.log(`     - balance_id: ${b.balance_id}, location: ${b.location_id}, qty: ${b.total_piece_qty}, pallet: ${b.pallet_id}`);
      });
    }
    
    // 2. Query ดูทุก location
    console.log('\n2️⃣ Query ดูทุก location (ไม่ filter location_id):');
    const { data: allLocations, error: e2 } = await supabase
      .from('wms_inventory_balances')
      .select('location_id, total_piece_qty')
      .eq('warehouse_id', WAREHOUSE_ID)
      .eq('sku_id', skuId)
      .gt('total_piece_qty', 0);
    
    if (e2) console.log('   Error:', e2.message);
    
    // Group by location
    const byLocation = {};
    allLocations?.forEach(b => {
      const loc = b.location_id || 'NULL';
      byLocation[loc] = (byLocation[loc] || 0) + Number(b.total_piece_qty || 0);
    });
    console.log('   Stock by location:');
    Object.entries(byLocation).forEach(([loc, qty]) => {
      const marker = loc.toLowerCase().includes('dispatch') ? ' ← Dispatch!' : '';
      console.log(`     - ${loc}: ${qty}${marker}`);
    });
    
    // 3. Query แบบ case-insensitive
    console.log('\n3️⃣ Query แบบ case-insensitive (ilike "dispatch%"):');
    const { data: ilikeQuery, error: e3 } = await supabase
      .from('wms_inventory_balances')
      .select('balance_id, location_id, total_piece_qty')
      .eq('warehouse_id', WAREHOUSE_ID)
      .ilike('location_id', 'dispatch%')
      .eq('sku_id', skuId)
      .gt('total_piece_qty', 0);
    
    if (e3) console.log('   Error:', e3.message);
    const ilikeTotal = ilikeQuery?.reduce((s, b) => s + Number(b.total_piece_qty || 0), 0) || 0;
    console.log(`   Rows found: ${ilikeQuery?.length || 0}`);
    console.log(`   Total qty: ${ilikeTotal}`);
    
    // 4. Query ไม่ filter warehouse
    console.log('\n4️⃣ Query ไม่ filter warehouse (ดูทุก warehouse):');
    const { data: allWh, error: e4 } = await supabase
      .from('wms_inventory_balances')
      .select('warehouse_id, location_id, total_piece_qty')
      .eq('sku_id', skuId)
      .gt('total_piece_qty', 0);
    
    if (e4) console.log('   Error:', e4.message);
    
    // Group by warehouse + location
    const byWhLoc = {};
    allWh?.forEach(b => {
      const key = `${b.warehouse_id || 'NULL'} / ${b.location_id || 'NULL'}`;
      byWhLoc[key] = (byWhLoc[key] || 0) + Number(b.total_piece_qty || 0);
    });
    console.log('   Stock by warehouse/location:');
    Object.entries(byWhLoc).forEach(([key, qty]) => {
      console.log(`     - ${key}: ${qty}`);
    });
    
    // 5. หา distinct location_id ที่มีคำว่า dispatch
    console.log('\n5️⃣ Distinct location_id ที่มีคำว่า "dispatch":');
    const { data: dispatchLocs, error: e5 } = await supabase
      .from('wms_inventory_balances')
      .select('location_id')
      .ilike('location_id', '%dispatch%');
    
    if (e5) console.log('   Error:', e5.message);
    const uniqueLocs = [...new Set(dispatchLocs?.map(b => b.location_id))];
    console.log(`   Found: ${uniqueLocs.join(', ') || 'None'}`);
  }
  
  // 6. สรุป
  console.log('\n' + '='.repeat(60));
  console.log('📊 สรุป');
  console.log('='.repeat(60));
  console.log(`
ถ้า Query 1 (API) ได้ค่าน้อยกว่า Query 2-4:
→ ปัญหาคือ filter ผิด (location_id, warehouse_id, หรืออื่นๆ)

ถ้า Query 3 (ilike) ได้ค่ามากกว่า Query 1:
→ ปัญหาคือ case-sensitivity ของ location_id

ถ้า Query 4 ได้ค่ามากกว่า Query 1-3:
→ ปัญหาคือ warehouse_id filter

ดู log ด้านบนเพื่อหาสาเหตุที่แท้จริง!
  `);
}

debugStockCheck().catch(console.error);