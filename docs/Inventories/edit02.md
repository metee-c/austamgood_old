# งาน: Reset Inventory ที่ Location "Dispatch" ให้ตรงกับ 3 Picklists เท่านั้น

## 🎯 เป้าหมาย
ลบข้อมูล Inventory ทั้งหมดที่ Location "Dispatch" แล้วสร้างใหม่ให้ตรงกับสินค้าใน 3 Picklists ที่ยืนยันหยิบแล้วแต่ยังไม่ได้โหลดเท่านั้น

## 📋 ข้อมูล 3 Picklists ที่ต้องคงไว้
- `PL-20260118-001` - 23 items, 1,070 pieces
- `PL-20260118-002` - 6 items, 278 pieces  
- `PL-20260118-003` - 11 items, 714 pieces
- **รวมที่ควรมี: 40 items, 2,062 pieces**

## ⚠️ ข้อควรระวัง
- ต้อง BACKUP ข้อมูลก่อนทำทุกครั้ง
- ต้องทำใน Transaction เพื่อ Rollback ได้ถ้ามีปัญหา
- ต้องตรวจสอบผลลัพธ์หลังทำเสร็จ

---

## 🔧 ขั้นตอนการทำงาน

### Step 1: สำรองข้อมูลก่อน (MANDATORY)
```sql
-- 1.1 Backup Balance Table
CREATE TABLE backup_dispatch_balance_20260119 AS
SELECT * FROM wms_inventory_balances
WHERE location_id = 'Dispatch';

-- 1.2 Backup Ledger
CREATE TABLE backup_dispatch_ledger_20260119 AS
SELECT * FROM wms_inventory_ledger
WHERE location_id = 'Dispatch';

-- 1.3 ยืนยันว่า backup สำเร็จ
SELECT 'Balance Backup' as table_name, COUNT(*) as rows FROM backup_dispatch_balance_20260119
UNION ALL
SELECT 'Ledger Backup' as table_name, COUNT(*) as rows FROM backup_dispatch_ledger_20260119;
```

### Step 2: ดึงข้อมูลสินค้าจาก 3 Picklists
```sql
-- ดูรายละเอียดสินค้าใน 3 Picklists
SELECT 
    pl.picklist_no,
    pli.sku_id,
    pli.sku_name,
    pli.lot_no,
    pli.production_date,
    pli.expiry_date,
    pli.pallet_id,
    SUM(pli.picked_qty) as piece_qty,
    SUM(pli.picked_weight) as weight_kg
FROM wms_picklists pl
JOIN wms_picklist_items pli ON pl.id = pli.picklist_id
WHERE pl.picklist_no IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003')
  AND pl.status = 'completed'  -- หรือ picked_at IS NOT NULL
  AND pl.loaded_at IS NULL     -- ยังไม่ได้โหลด
GROUP BY pl.picklist_no, pli.sku_id, pli.sku_name, pli.lot_no, 
         pli.production_date, pli.expiry_date, pli.pallet_id
ORDER BY pl.picklist_no, pli.sku_id;
```

### Step 3: ลบข้อมูลเก่าที่ Location "Dispatch"
```sql
BEGIN TRANSACTION;

-- 3.1 ลบ Balance ทั้งหมดที่ Dispatch
DELETE FROM wms_inventory_balances
WHERE location_id = 'Dispatch';

-- 3.2 (Optional) ลบ Ledger เก่าถ้าต้องการ reset ทั้งหมด
-- DELETE FROM wms_inventory_ledger
-- WHERE location_id = 'Dispatch';

-- ยังไม่ COMMIT รอทำ Step 4 ก่อน
```

### Step 4: สร้าง Balance ใหม่จาก 3 Picklists
```sql
-- 4.1 Insert Balance ใหม่จาก Picklist Items
INSERT INTO wms_inventory_balances (
    location_id,
    sku_id,
    sku_name,
    pallet_id,
    lot_no,
    production_date,
    expiry_date,
    total_piece_qty,
    total_pack_qty,
    total_weight,
    reserved_piece_qty,
    reserved_pack_qty,
    available_piece_qty,
    available_pack_qty,
    last_movement_at,
    created_at,
    updated_at
)
SELECT 
    'Dispatch' as location_id,
    pli.sku_id,
    pli.sku_name,
    COALESCE(pli.to_pallet_id, 'DISPATCH-PENDING') as pallet_id,
    pli.lot_no,
    pli.production_date,
    pli.expiry_date,
    SUM(pli.picked_qty) as total_piece_qty,
    SUM(pli.picked_pack_qty) as total_pack_qty,
    SUM(pli.picked_weight) as total_weight,
    SUM(pli.picked_qty) as reserved_piece_qty,  -- Reserved เพราะรอโหลด
    SUM(pli.picked_pack_qty) as reserved_pack_qty,
    0 as available_piece_qty,  -- ไม่มี available เพราะ reserved หมด
    0 as available_pack_qty,
    NOW() as last_movement_at,
    NOW() as created_at,
    NOW() as updated_at
FROM wms_picklists pl
JOIN wms_picklist_items pli ON pl.id = pli.picklist_id
WHERE pl.picklist_no IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003')
  AND pli.picked_qty > 0
GROUP BY 
    pli.sku_id,
    pli.sku_name,
    COALESCE(pli.to_pallet_id, 'DISPATCH-PENDING'),
    pli.lot_no,
    pli.production_date,
    pli.expiry_date;

-- 4.2 สร้าง Adjustment Ledger Entry เพื่อบันทึกการ Reset
INSERT INTO wms_inventory_ledger (
    transaction_type,
    reference_no,
    location_id,
    sku_id,
    pallet_id,
    lot_no,
    direction,
    piece_qty,
    pack_qty,
    weight,
    reason,
    created_at,
    created_by
)
SELECT 
    'reset_adjustment' as transaction_type,
    'RESET-DISPATCH-20260119' as reference_no,
    'Dispatch' as location_id,
    pli.sku_id,
    COALESCE(pli.to_pallet_id, 'DISPATCH-PENDING') as pallet_id,
    pli.lot_no,
    'in' as direction,
    SUM(pli.picked_qty) as piece_qty,
    SUM(pli.picked_pack_qty) as pack_qty,
    SUM(pli.picked_weight) as weight,
    'Reset Dispatch balance to match 3 pending picklists: PL-20260118-001, PL-20260118-002, PL-20260118-003' as reason,
    NOW() as created_at,
    'SYSTEM-RESET' as created_by
FROM wms_picklists pl
JOIN wms_picklist_items pli ON pl.id = pli.picklist_id
WHERE pl.picklist_no IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003')
  AND pli.picked_qty > 0
GROUP BY 
    pli.sku_id,
    COALESCE(pli.to_pallet_id, 'DISPATCH-PENDING'),
    pli.lot_no;
```

### Step 5: ตรวจสอบผลลัพธ์ก่อน Commit
```sql
-- 5.1 ตรวจสอบยอดรวม
SELECT 
    'New Balance' as source,
    COUNT(*) as total_items,
    SUM(total_piece_qty) as total_pieces,
    SUM(total_weight) as total_weight_kg
FROM wms_inventory_balances
WHERE location_id = 'Dispatch';

-- 5.2 ตรวจสอบว่าตรงกับ 3 Picklists
SELECT 
    'Expected from Picklists' as source,
    COUNT(DISTINCT pli.sku_id) as total_items,
    SUM(pli.picked_qty) as total_pieces,
    SUM(pli.picked_weight) as total_weight_kg
FROM wms_picklists pl
JOIN wms_picklist_items pli ON pl.id = pli.picklist_id
WHERE pl.picklist_no IN ('PL-20260118-001', 'PL-20260118-002', 'PL-20260118-003');

-- 5.3 ตรวจสอบว่าไม่มียอดติดลบ
SELECT COUNT(*) as negative_balance_count
FROM wms_inventory_balances
WHERE location_id = 'Dispatch' AND total_piece_qty < 0;
```

### Step 6: Commit หรือ Rollback
```sql
-- ถ้าผลลัพธ์ถูกต้อง (ประมาณ 2,062 pieces, ไม่มียอดติดลบ)
COMMIT;

-- ถ้ามีปัญหา
-- ROLLBACK;
```

### Step 7: อัพเดท Location Summary (ถ้ามี)
```sql
-- อัพเดทยอดสรุปที่ master_locations (ถ้ามี field นี้)
UPDATE wms_locations
SET 
    current_piece_qty = (
        SELECT COALESCE(SUM(total_piece_qty), 0) 
        FROM wms_inventory_balances 
        WHERE location_id = 'Dispatch'
    ),
    current_weight = (
        SELECT COALESCE(SUM(total_weight), 0) 
        FROM wms_inventory_balances 
        WHERE location_id = 'Dispatch'
    ),
    updated_at = NOW()
WHERE location_id = 'Dispatch' OR location_name = 'Dispatch';
```

---

## ✅ Verification Checklist

หลังทำเสร็จ ให้ตรวจสอบที่หน้าเว็บ:

| URL | ผลที่คาดหวัง |
|-----|-------------|
| `/warehouse/inventory-balances` | Dispatch แสดงยอด ≈ 2,062 ชิ้น (บวก) |
| `/master-data/locations` | Dispatch แสดงยอดตรงกัน |
| `/receiving/picklists` | 3 Picklists ยังแสดงสถานะ "รอโหลด" |

## 🔄 Rollback Plan (ถ้าต้องการย้อนกลับ)
```sql
-- ลบข้อมูลใหม่
DELETE FROM wms_inventory_balances WHERE location_id = 'Dispatch';
DELETE FROM wms_inventory_ledger 
WHERE location_id = 'Dispatch' AND reference_no = 'RESET-DISPATCH-20260119';

-- Restore จาก Backup
INSERT INTO wms_inventory_balances
SELECT * FROM backup_dispatch_balance_20260119;
```

---

## 📝 หมายเหตุสำคัญ

1. **ปรับ Column Names** ตามโครงสร้าง Database จริง (ชื่อ column อาจต่างกัน)
2. **ตรวจสอบ Foreign Keys** ก่อนลบข้อมูล
3. **ทำในช่วงที่ไม่มี User ใช้งาน** เพื่อป้องกัน Race Condition
4. **เก็บ Backup ไว้อย่างน้อย 7 วัน** ก่อนลบ

---

## 🎯 Expected Result

| Metric | Before | After |
|--------|--------|-------|
| Total Pieces | -5,972 | ~2,062 |
| Total Weight | -6,425.4 kg | ~(คำนวณจาก picklists) |
| Negative SKUs | หลายรายการ | 0 |
| Status | ❌ ติดลบ | ✅ ตรงกับ 3 Picklists |