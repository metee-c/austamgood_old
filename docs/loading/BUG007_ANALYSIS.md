# 🐛 BUG-007: Loading Complete Stock Check Analysis

## 📋 Bug Summary

**Bug ID:** BUG-007  
**Priority:** P0 - CRITICAL  
**Status:** Under Investigation  
**Location:** `app/api/mobile/loading/complete/route.ts`

## 🔍 Problem Description

เมื่อกดยืนยันโหลด (Loading Complete) ระบบแจ้งว่า **"Insufficient stock"** แม้ว่าสต็อกจริงจะมีเพียงพอ

### Evidence จาก User Log
```
📊 SKU B-BEY-C|MCK|NS|010: need 24, available 12 at Dispatch
📊 SKU B-BEY-D|MNB|NS|010: need 36, available 12 at Dispatch
❌ Insufficient stock for 2 items
```

## 🔬 Investigation Results

### 1. Database Reality Check

```sql
-- สต็อกจริงในระบบ
SELECT location_id, sku_id, SUM(total_piece_qty) as total_qty
FROM wms_inventory_balances
WHERE sku_id IN ('B-BEY-C|MCK|NS|010', 'B-BEY-D|MNB|NS|010')
GROUP BY location_id, sku_id;
```

**Results:**
| Location | SKU | Quantity |
|----------|-----|----------|
| Dispatch | B-BEY-C\|MCK\|NS\|010 | 12 |
| Dispatch | B-BEY-D\|MNB\|NS\|010 | 12 |
| **MRTD** | **B-BEY-C\|MCK\|NS\|010** | **310** ✅ |
| **MRTD** | **B-BEY-D\|MNB\|NS\|010** | **11** ✅ |
| MR01 | B-BEY-C\|MCK\|NS\|010 | 0 |
| MR01 | B-BEY-D\|MNB\|NS\|010 | 0 |

### 2. Loadlist Composition

**Loadlist:** LD-20260119-0009 (ID: 253)
- Face Sheet: 1 ใบ (FS-20260116-000)
- Bonus Face Sheet: 1 ใบ (BFS-20260116-001)
- Picklist: 0 ใบ

### 3. BFS Items Requirements

```sql
SELECT bfsi.sku_id, bfsi.quantity_picked, bfsp.storage_location
FROM bonus_face_sheet_items bfsi
JOIN bonus_face_sheet_packages bfsp ON bfsi.package_id = bfsp.id
WHERE bfsi.face_sheet_id = (SELECT id FROM bonus_face_sheets WHERE face_sheet_no = 'BFS-20260116-001');
```

**Results:**
| SKU | Quantity Needed | Package Storage Location |
|-----|-----------------|--------------------------|
| B-BEY-C\|MCK\|NS\|010 | 310 | MR01 |
| B-BEY-D\|MNB\|NS\|010 | 11 | MR01 |

### 4. Stock Flow Logic (ตามที่ออกแบบไว้)

```
Picklist/Face Sheet:
  ยืนยันหยิบ → Dispatch → รอยืนยันโหลด

Bonus Face Sheet:
  ยืนยันหยิบ → MR01-10/PQ01-10 (prep areas)
              → MRTD/PQTD (staging)
              → รอยืนยันโหลด
```

### 5. API Logic Analysis

**Current API Logic (lines 640-750):**
```typescript
// 1. Check prep area (MR01) if package has storage_location
if (packageStorageLocation && prepAreaLocationMap.has(packageStorageLocation)) {
  // Query MR01 → Found 0 pieces
  if (availableQty >= qty) {
    sourceBalance = ...;  // Not executed (0 < 310)
  }
}

// 2. Check PQTD
if (!sourceBalance && pqtdLocation?.location_id) {
  // Query PQTD → Found 0 pieces
}

// 3. Check MRTD
if (!sourceBalance && mrtdLocation?.location_id) {
  // Query MRTD → Should find 310 and 11 pieces!
  // ✅ This SHOULD work according to debug script
}

// 4. Check Dispatch
if (!sourceBalance) {
  // Query Dispatch → Found 12 pieces
}
```

### 6. Debug Script Results

**Script:** `scripts/debug-bfs-stock-check-detailed.js`

```
✅ SKU B-BEY-C|MCK|NS|010: FOUND at MRTD (310 pieces)
✅ SKU B-BEY-D|MNB|NS|010: FOUND at MRTD (11 pieces)
```

**Conclusion:** Logic ของ API ถูกต้อง - debug script เจอสต็อกที่ MRTD ได้

## 🎯 Root Cause Hypothesis

มี 2 สมมติฐาน:

### Hypothesis 1: API ไม่ได้รัน logic สำหรับ BFS items
- User log แสดง "need 24, available 12" ซึ่งไม่ตรงกับ BFS items (ต้องการ 310 และ 11)
- อาจจะเป็น log จาก Face Sheet items หรือ Picklist items แทน
- **ต้องตรวจสอบ:** API กำลังเช็คสต็อกสำหรับ document ไหน?

### Hypothesis 2: มี condition ที่ทำให้ข้าม BFS items
- อาจจะมี filter หรือ condition ที่ทำให้ BFS items ไม่ถูก process
- เช่น: `matchedPackageIds` ว่างเปล่า, `filteredItems` ว่างเปล่า, etc.

## 🔧 Next Steps

### Step 1: เพิ่ม Logging
เพิ่ม console.log ใน API เพื่อ track:
```typescript
console.log('📦 Processing BFS items:', {
  bonusFaceSheetIds,
  matchedPackageIds: [...matchedPackageIds],
  filteredItemsCount: filteredItems.length
});

console.log('🔍 Checking stock for BFS item:', {
  sku_id: item.sku_id,
  qty_needed: qty,
  package_id: item.package_id,
  packageStorageLocation
});
```

### Step 2: ทดสอบยืนยันโหลดจริง
- ลองยืนยันโหลด loadlist LD-20260119-0009
- ดู log ที่ console
- ตรวจสอบว่า API เข้า BFS items loop หรือไม่

### Step 3: ตรวจสอบ matchedPackageIds
```sql
SELECT 
  lbfs.matched_package_ids,
  lbfs.mapping_type
FROM wms_loadlist_bonus_face_sheets lbfs
WHERE lbfs.loadlist_id = 253;
```

## 📝 Files Involved

- `app/api/mobile/loading/complete/route.ts` - Main API
- `scripts/debug-loading-stock-check.js` - Debug script #1
- `scripts/debug-bfs-stock-check-detailed.js` - Debug script #2
- `docs/loading/edit01.md` - Bug fix instructions

## 🚨 Impact

- **28 pending loadlists** รอยืนยันโหลด
- ไม่สามารถยืนยันโหลดได้ แม้ว่าสต็อกจะเพียงพอ
- Blocking การส่งสินค้า

## ✅ Expected Behavior After Fix

```
📊 SKU B-BEY-C|MCK|NS|010: need 310, available 310 at MRTD
📊 SKU B-BEY-D|MNB|NS|010: need 11, available 11 at MRTD
✅ Stock check complete. Insufficient items: 0
POST /api/mobile/loading/complete 200 OK
```
