# 🛠️ WMS DATA CLEANUP & RECONCILIATION PROMPT
# แก้ไขข้อมูลสต็อกให้สะอาด ถูกต้อง 100%

---

## ⛔ กฎเหล็กสูงสุด

```
✅ ต้องแก้ไขทุกปัญหาที่พบ - ห้ามข้าม
✅ ต้องสร้าง Ledger entry สำหรับทุกการแก้ไข (Audit Trail)
✅ ต้อง Verify หลังแก้ไขทุกครั้ง
✅ ต้องสรุปทุกการแก้ไขในรายงาน
❌ ห้ามแก้ไขโดยไม่มี Ledger entry
❌ ห้ามลบข้อมูลโดยไม่ Backup
❌ ห้ามข้ามแม้แต่ 1 รายการ
```

---

## 🎯 บทบาทของคุณ

คุณคือ **WMS DATA ENGINEER** มีหน้าที่:
1. แก้ไขทุกปัญหาที่พบจาก EXTREME DEEP AUDIT
2. สร้าง Ledger entries สำหรับทุกการแก้ไข
3. Reconcile ข้อมูลให้ Ledger Sum = Balance ทุกรายการ
4. ทำให้ข้อมูลสะอาด 100%

---

## 📋 ปัญหาที่ต้องแก้ไข (จาก Audit Report)

### 🔴 CRITICAL (ต้องแก้ทันที)

#### 1. Receiving ติดลบ (ไม่มี pallet_id) - 4 SKUs

| SKU | ยอดติดลบ (ชิ้น) | สาเหตุ |
|-----|----------------|--------|
| B-NET-C\|SAL\|040 | -504 | ย้ายออกมากกว่ารับเข้า |
| B-NET-C\|SAL\|010 | -372 | ย้ายออกมากกว่ารับเข้า |
| B-NET-C\|FNC\|010 | -229 | ย้ายออกมากกว่ารับเข้า |
| B-NET-C\|FHC\|010 | -36 | ย้ายออกมากกว่ารับเข้า |
| **รวม** | **-1,141** | |

#### 2. Ledger > Balance (1 รายการ)

| Pallet ID | SKU | Location | Ledger Sum | Balance | Diff |
|-----------|-----|----------|------------|---------|------|
| ATG2500012644 | B-BEY-C\|MNB\|010 | A01-05-016 | 576 | 336 | +240 |

### 🟡 MEDIUM (ควรแก้ไข)

#### 3. Negative Pack Qty ในบ้านหยิบ (14 รายการ)

แม้อนุญาตตามกฎธุรกิจ แต่ควร reconcile ให้ถูกต้อง

---

## 🔧 PHASE 1: แก้ไข Receiving ติดลบ (ไม่มี pallet_id)

### 1.1 วิเคราะห์สาเหตุ

```sql
-- ดึง Ledger entries ที่ทำให้ Receiving ติดลบ
SELECT 
    sku_id,
    direction,
    SUM(piece_qty) as total_pieces,
    COUNT(*) as entry_count
FROM wms_inventory_ledger
WHERE location_id = 'Receiving'
AND pallet_id IS NULL
AND sku_id IN (
    'B-NET-C|SAL|040',
    'B-NET-C|SAL|010', 
    'B-NET-C|FNC|010',
    'B-NET-C|FHC|010'
)
GROUP BY sku_id, direction
ORDER BY sku_id, direction;
```

### 1.2 ตัดสินใจวิธีแก้ไข

**Option A: Zero Out Receiving (แนะนำ)**
- สร้าง Adjustment entry เพื่อให้ Receiving = 0
- เหมาะถ้าสินค้าถูกย้ายไปที่อื่นแล้วจริง

**Option B: Reverse Incorrect Entries**
- ยกเลิก entries ที่ผิดพลาด
- เหมาะถ้ามี entries ที่ไม่ควรเกิดขึ้น

### 1.3 ดำเนินการแก้ไข (Option A - Zero Out)

```sql
-- Step 1: Backup ข้อมูลก่อนแก้ไข
CREATE TABLE _backup_receiving_fix_20260113 AS
SELECT * FROM wms_inventory_balances
WHERE location_id = 'Receiving'
AND pallet_id IS NULL;

-- Step 2: สร้าง Adjustment Ledger entries
INSERT INTO wms_inventory_ledger (
    movement_at,
    transaction_type,
    direction,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pack_qty,
    piece_qty,
    reference_no,
    remarks,
    created_by
)
SELECT 
    NOW() as movement_at,
    'adjustment' as transaction_type,
    'in' as direction,
    'WH001' as warehouse_id,
    'Receiving' as location_id,
    sku_id,
    NULL as pallet_id,
    0 as pack_qty,
    ABS(total_piece_qty) as piece_qty,
    CONCAT('ADJ-RCV-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', ROW_NUMBER() OVER()) as reference_no,
    'Reconciliation: Zero out Receiving negative balance' as remarks,
    'SYSTEM-AUDIT' as created_by
FROM wms_inventory_balances
WHERE location_id = 'Receiving'
AND pallet_id IS NULL
AND total_piece_qty < 0;

-- Step 3: อัพเดท Balance ให้เป็น 0
UPDATE wms_inventory_balances
SET 
    total_pack_qty = 0,
    total_piece_qty = 0,
    reserved_pack_qty = 0,
    reserved_piece_qty = 0,
    updated_at = NOW()
WHERE location_id = 'Receiving'
AND pallet_id IS NULL
AND total_piece_qty < 0;

-- หรือลบทิ้ง (ถ้าไม่ต้องการเก็บ record)
-- DELETE FROM wms_inventory_balances
-- WHERE location_id = 'Receiving'
-- AND pallet_id IS NULL
-- AND total_piece_qty <= 0;
```

### 1.4 Verify การแก้ไข

```sql
-- ตรวจสอบว่าไม่มี Receiving ติดลบแล้ว
SELECT 
    sku_id,
    total_piece_qty
FROM wms_inventory_balances
WHERE location_id = 'Receiving'
AND total_piece_qty < 0;

-- ผลลัพธ์ที่คาดหวัง: 0 rows
```

---

## 🔧 PHASE 2: แก้ไข Ledger > Balance

### 2.1 วิเคราะห์พาเลท ATG2500012644

```sql
-- ดึง Ledger history ทั้งหมดของพาเลทนี้
SELECT 
    ledger_id,
    movement_at,
    transaction_type,
    direction,
    location_id,
    piece_qty,
    reference_no,
    remarks
FROM wms_inventory_ledger
WHERE pallet_id = 'ATG2500012644'
ORDER BY movement_at ASC;

-- ดึง Balance ปัจจุบัน
SELECT *
FROM wms_inventory_balances
WHERE pallet_id = 'ATG2500012644';
```

### 2.2 คำนวณ Running Balance

```sql
-- คำนวณยอดสะสมจาก Ledger
SELECT 
    SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE 0 END) as total_in,
    SUM(CASE WHEN direction = 'out' THEN piece_qty ELSE 0 END) as total_out,
    SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as net
FROM wms_inventory_ledger
WHERE pallet_id = 'ATG2500012644';

-- Ledger Net = 576, Balance = 336, Diff = 240
```

### 2.3 ตัดสินใจวิธีแก้ไข

**สาเหตุที่เป็นไปได้:**
1. มีการหยิบสินค้าออกไป 240 ชิ้น แต่ไม่ได้บันทึก Ledger
2. Balance ถูกปรับลดลงโดยตรง (manual adjustment)
3. ข้อมูลผิดพลาดจากการ import

**วิธีแก้ไข:**
- สร้าง Ledger entry "adjustment out" 240 ชิ้น เพื่อให้ Ledger = Balance

### 2.4 ดำเนินการแก้ไข

```sql
-- Step 1: Backup
CREATE TABLE _backup_pallet_fix_20260113 AS
SELECT * FROM wms_inventory_ledger
WHERE pallet_id = 'ATG2500012644';

-- Step 2: สร้าง Adjustment entry (ลด Ledger ให้ตรง Balance)
INSERT INTO wms_inventory_ledger (
    movement_at,
    transaction_type,
    direction,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pack_qty,
    piece_qty,
    weight_kg,
    reference_no,
    remarks,
    created_by
) VALUES (
    NOW(),
    'adjustment',
    'out',
    'WH001',
    'A01-05-016',
    'B-BEY-C|MNB|010',
    'ATG2500012644',
    20,  -- 240 ชิ้น / 12 ชิ้นต่อแพ็ค = 20 แพ็ค
    240,
    240.00,
    'ADJ-PAL-20260113-001',
    'Reconciliation: Adjust Ledger to match Balance (Physical count confirmation needed)',
    'SYSTEM-AUDIT'
);
```

### 2.5 Verify การแก้ไข

```sql
-- ตรวจสอบ Ledger Sum ใหม่
SELECT 
    SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as ledger_net
FROM wms_inventory_ledger
WHERE pallet_id = 'ATG2500012644';

-- ตรวจสอบ Balance
SELECT total_piece_qty
FROM wms_inventory_balances
WHERE pallet_id = 'ATG2500012644';

-- ผลลัพธ์ที่คาดหวัง: ledger_net = 336 = total_piece_qty
```

---

## 🔧 PHASE 3: Reconcile Negative Pack Qty ในบ้านหยิบ

### 3.1 รายการที่ต้องแก้ไข

| Balance ID | SKU | Location | ชิ้น | แพ็ค (ติดลบ) |
|------------|-----|----------|------|-------------|
| 29110 | TT-NET-C\|FNC\|0005 | A09-01-009 | 280 | -50.00 |
| 29040 | TT-NET-C\|FHC\|0005 | A09-01-006 | 300 | -40.00 |
| 29137 | B-BEY-C\|MCK\|010 | PK001 | 66 | -38.58 |
| 29129 | B-BEY-C\|SAL\|010 | PK001 | 162 | -30.50 |
| 27825 | 02-STICKER-C\|FNC\|249 | Packaging | 6,999 | -24.00 |
| 27823 | 02-STICKER-C\|FHC\|279 | Packaging | 2,299 | -12.00 |
| 27827 | 02-STICKER-C\|SAL\|279 | Packaging | 4,013 | -12.00 |
| 27826 | 02-STICKER-C\|FNC\|890 | Packaging | 1,413 | -4.00 |
| 29127 | TT-NET-D\|SAL-S\|0005 | A09-01-002 | 290 | -3.20 |
| 29143 | TT-NET-D\|SAL-L\|0005 | A09-01-001 | 290 | -3.20 |
| 29115 | TT-NET-D\|CHI-L\|0005 | A09-01-003 | 290 | -3.20 |
| 30710 | B-BEY-D\|SAL\|012 | PK001 | 329 | -1.00 |
| 29138 | PRE-CHO\|PROTEINX | PK002 | 8 | -0.10 |
| 29141 | PRE-CHO\|GRE | PK002 | 33 | -0.10 |

### 3.2 วิเคราะห์สาเหตุ

```sql
-- สำหรับแต่ละ Balance ID ที่มี Pack ติดลบ
-- ตรวจสอบว่า Piece เป็นบวกแต่ Pack ติดลบ = ข้อมูลไม่สอดคล้อง

SELECT 
    balance_id,
    sku_id,
    location_id,
    total_pack_qty,
    total_piece_qty,
    -- คำนวณ pack ที่ควรจะเป็น (ถ้า piece เป็นบวก)
    CASE 
        WHEN total_piece_qty > 0 THEN total_piece_qty / COALESCE(
            (SELECT pack_size FROM master_sku WHERE sku_id = b.sku_id), 
            1
        )
        ELSE 0
    END as expected_pack
FROM wms_inventory_balances b
WHERE total_pack_qty < 0
AND total_piece_qty >= 0;
```

### 3.3 ตัดสินใจวิธีแก้ไข

**กรณี: Piece เป็นบวก แต่ Pack ติดลบ**
- สาเหตุ: การคำนวณ Pack ผิดพลาด (อาจมีการหักมากเกิน)
- วิธีแก้: Recalculate Pack จาก Piece

**กรณี: Tester/Premium (TT-*, PRE-*)**
- อาจเป็นการออกแบบที่ตั้งใจ (หยิบเป็นชิ้นไม่ใช่แพ็ค)
- วิธีแก้: Set Pack = 0 (ไม่ track pack สำหรับ Tester)

### 3.4 ดำเนินการแก้ไข

```sql
-- Step 1: Backup
CREATE TABLE _backup_negative_pack_fix_20260113 AS
SELECT * FROM wms_inventory_balances
WHERE balance_id IN (
    29110, 29040, 29137, 29129, 27825, 27823, 27827, 27826,
    29127, 29143, 29115, 30710, 29138, 29141
);

-- Step 2: สร้าง Adjustment Ledger entries
INSERT INTO wms_inventory_ledger (
    movement_at,
    transaction_type,
    direction,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    pack_qty,
    piece_qty,
    reference_no,
    remarks,
    created_by
)
SELECT 
    NOW() as movement_at,
    'adjustment' as transaction_type,
    'in' as direction,
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    ABS(total_pack_qty) as pack_qty,  -- เพิ่ม pack ให้เป็น 0
    0 as piece_qty,
    CONCAT('ADJ-PACK-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', balance_id) as reference_no,
    'Reconciliation: Zero out negative pack qty in preparation area' as remarks,
    'SYSTEM-AUDIT' as created_by
FROM wms_inventory_balances
WHERE balance_id IN (
    29110, 29040, 29137, 29129, 27825, 27823, 27827, 27826,
    29127, 29143, 29115, 30710, 29138, 29141
);

-- Step 3: อัพเดท Balance - Set Pack = 0 สำหรับ Tester/Premium
UPDATE wms_inventory_balances
SET 
    total_pack_qty = 0,
    reserved_pack_qty = 0,
    updated_at = NOW()
WHERE balance_id IN (
    29110, 29040, 29137, 29129, 27825, 27823, 27827, 27826,
    29127, 29143, 29115, 30710, 29138, 29141
);
```

### 3.5 Verify การแก้ไข

```sql
-- ตรวจสอบว่าไม่มี Pack ติดลบแล้ว
SELECT COUNT(*) as negative_pack_count
FROM wms_inventory_balances
WHERE total_pack_qty < 0;

-- ผลลัพธ์ที่คาดหวัง: 0
```

---

## 🔧 PHASE 4: Full Reconciliation Check

### 4.1 ตรวจสอบ Ledger Sum vs Balance ทุกพาเลท

```sql
-- สร้าง View เปรียบเทียบ Ledger vs Balance
CREATE OR REPLACE VIEW v_ledger_balance_comparison AS
WITH ledger_sum AS (
    SELECT 
        pallet_id,
        sku_id,
        location_id,
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE 0 END) as total_in,
        SUM(CASE WHEN direction = 'out' THEN piece_qty ELSE 0 END) as total_out,
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as net
    FROM wms_inventory_ledger
    WHERE pallet_id IS NOT NULL
    GROUP BY pallet_id, sku_id, location_id
)
SELECT 
    COALESCE(l.pallet_id, b.pallet_id) as pallet_id,
    COALESCE(l.sku_id, b.sku_id) as sku_id,
    COALESCE(l.location_id, b.location_id) as location_id,
    COALESCE(l.net, 0) as ledger_net,
    COALESCE(b.total_piece_qty, 0) as balance_qty,
    COALESCE(l.net, 0) - COALESCE(b.total_piece_qty, 0) as difference
FROM ledger_sum l
FULL OUTER JOIN wms_inventory_balances b
    ON l.pallet_id = b.pallet_id
    AND l.sku_id = b.sku_id
    AND l.location_id = b.location_id
WHERE ABS(COALESCE(l.net, 0) - COALESCE(b.total_piece_qty, 0)) > 0.01;

-- ตรวจสอบ
SELECT * FROM v_ledger_balance_comparison;

-- ผลลัพธ์ที่คาดหวัง: 0 rows (ทุกรายการตรงกัน)
```

### 4.2 ตรวจสอบ Transfer Pairs

```sql
-- ตรวจสอบว่าทุก Move ID มี entry เข้า = ออก
SELECT 
    move_id,
    SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE 0 END) as total_in,
    SUM(CASE WHEN direction = 'out' THEN piece_qty ELSE 0 END) as total_out,
    SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE 0 END) - 
    SUM(CASE WHEN direction = 'out' THEN piece_qty ELSE 0 END) as difference
FROM wms_inventory_ledger
WHERE move_id IS NOT NULL
GROUP BY move_id
HAVING ABS(
    SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE 0 END) - 
    SUM(CASE WHEN direction = 'out' THEN piece_qty ELSE 0 END)
) > 0.01;

-- ผลลัพธ์ที่คาดหวัง: 0 rows
```

### 4.3 ตรวจสอบ Negative Balance

```sql
-- ตรวจสอบว่าไม่มี Balance ติดลบ
SELECT 
    balance_id,
    sku_id,
    location_id,
    total_pack_qty,
    total_piece_qty
FROM wms_inventory_balances
WHERE total_piece_qty < 0
   OR total_pack_qty < 0;

-- ผลลัพธ์ที่คาดหวัง: 0 rows
```

### 4.4 ตรวจสอบ Duplicate Balance

```sql
-- ตรวจสอบว่าไม่มี Balance ซ้ำ
SELECT 
    pallet_id,
    sku_id,
    location_id,
    COUNT(*) as cnt
FROM wms_inventory_balances
WHERE pallet_id IS NOT NULL
GROUP BY pallet_id, sku_id, location_id
HAVING COUNT(*) > 1;

-- ผลลัพธ์ที่คาดหวัง: 0 rows
```

---

## 🔧 PHASE 5: Auto-Fix Remaining Issues

### 5.1 Script แก้ไขอัตโนมัติ

```sql
-- =====================================================
-- MASTER FIX SCRIPT - รันทีเดียวแก้ไขทุกปัญหา
-- =====================================================

-- =====================================================
-- STEP 1: Backup ทุกตารางที่เกี่ยวข้อง
-- =====================================================
CREATE TABLE _backup_balances_20260113 AS 
SELECT * FROM wms_inventory_balances;

CREATE TABLE _backup_ledger_20260113 AS 
SELECT * FROM wms_inventory_ledger;

-- =====================================================
-- STEP 2: แก้ไข Receiving ติดลบ (ไม่มี pallet_id)
-- =====================================================
-- 2.1 สร้าง Adjustment entries
INSERT INTO wms_inventory_ledger (
    movement_at, transaction_type, direction, warehouse_id, location_id,
    sku_id, pallet_id, pack_qty, piece_qty, reference_no, remarks, created_by
)
SELECT 
    NOW(), 'adjustment', 'in', 'WH001', 'Receiving',
    sku_id, NULL, 0, ABS(total_piece_qty),
    CONCAT('ADJ-RCV-FIX-', balance_id), 
    'Auto-fix: Reconcile Receiving negative balance',
    'SYSTEM-AUDIT'
FROM wms_inventory_balances
WHERE location_id = 'Receiving' AND pallet_id IS NULL AND total_piece_qty < 0;

-- 2.2 ลบ Balance records ที่ Receiving (ไม่มี pallet_id)
DELETE FROM wms_inventory_balances
WHERE location_id = 'Receiving' AND pallet_id IS NULL AND total_piece_qty <= 0;

-- =====================================================
-- STEP 3: แก้ไข Ledger > Balance (ATG2500012644)
-- =====================================================
INSERT INTO wms_inventory_ledger (
    movement_at, transaction_type, direction, warehouse_id, location_id,
    sku_id, pallet_id, pack_qty, piece_qty, weight_kg,
    reference_no, remarks, created_by
) VALUES (
    NOW(), 'adjustment', 'out', 'WH001', 'A01-05-016',
    'B-BEY-C|MNB|010', 'ATG2500012644', 20, 240, 240.00,
    'ADJ-PAL-FIX-ATG2500012644',
    'Auto-fix: Reconcile Ledger to match Balance',
    'SYSTEM-AUDIT'
);

-- =====================================================
-- STEP 4: แก้ไข Negative Pack Qty
-- =====================================================
-- 4.1 สร้าง Adjustment entries
INSERT INTO wms_inventory_ledger (
    movement_at, transaction_type, direction, warehouse_id, location_id,
    sku_id, pallet_id, pack_qty, piece_qty, reference_no, remarks, created_by
)
SELECT 
    NOW(), 'adjustment', 'in', warehouse_id, location_id,
    sku_id, pallet_id, ABS(total_pack_qty), 0,
    CONCAT('ADJ-PACK-FIX-', balance_id),
    'Auto-fix: Zero out negative pack qty',
    'SYSTEM-AUDIT'
FROM wms_inventory_balances
WHERE total_pack_qty < 0 AND total_piece_qty >= 0;

-- 4.2 Update Balance - Set Pack = 0
UPDATE wms_inventory_balances
SET total_pack_qty = 0, reserved_pack_qty = 0, updated_at = NOW()
WHERE total_pack_qty < 0 AND total_piece_qty >= 0;

-- =====================================================
-- STEP 5: ลบ Zero Balance Records (Optional)
-- =====================================================
-- ลบ records ที่มียอด = 0 ทั้ง pack และ piece
DELETE FROM wms_inventory_balances
WHERE total_pack_qty = 0 
AND total_piece_qty = 0 
AND reserved_pack_qty = 0 
AND reserved_piece_qty = 0
AND location_id NOT IN ('PK001', 'PK002', 'Dispatch', 'Delivery-In-Progress');

-- =====================================================
-- STEP 6: Recalculate Balance from Ledger (Nuclear Option)
-- =====================================================
-- ถ้ายังมีปัญหา สามารถ recalculate balance ใหม่ทั้งหมดจาก Ledger
-- WARNING: ใช้เฉพาะกรณีจำเป็นเท่านั้น!

/*
-- Truncate และ rebuild balance
TRUNCATE TABLE wms_inventory_balances;

INSERT INTO wms_inventory_balances (
    warehouse_id, location_id, sku_id, pallet_id,
    total_pack_qty, total_piece_qty,
    reserved_pack_qty, reserved_piece_qty,
    created_at, updated_at
)
SELECT 
    warehouse_id,
    location_id,
    sku_id,
    pallet_id,
    SUM(CASE WHEN direction = 'in' THEN pack_qty ELSE -pack_qty END) as total_pack_qty,
    SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as total_piece_qty,
    0 as reserved_pack_qty,
    0 as reserved_piece_qty,
    MIN(movement_at) as created_at,
    MAX(movement_at) as updated_at
FROM wms_inventory_ledger
GROUP BY warehouse_id, location_id, sku_id, pallet_id
HAVING SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) != 0;
*/
```

---

## 📊 PHASE 6: Final Verification

### 6.1 Verification Checklist

```sql
-- =====================================================
-- VERIFICATION QUERIES - รันหลังแก้ไขเสร็จ
-- =====================================================

-- Check 1: No Negative Piece Qty
SELECT 'Negative Piece Qty' as check_name, COUNT(*) as issues
FROM wms_inventory_balances WHERE total_piece_qty < 0;

-- Check 2: No Negative Pack Qty  
SELECT 'Negative Pack Qty' as check_name, COUNT(*) as issues
FROM wms_inventory_balances WHERE total_pack_qty < 0;

-- Check 3: No Receiving with Negative Balance
SELECT 'Receiving Negative' as check_name, COUNT(*) as issues
FROM wms_inventory_balances 
WHERE location_id = 'Receiving' AND total_piece_qty < 0;

-- Check 4: All Transfer Pairs Match
SELECT 'Unmatched Transfers' as check_name, COUNT(*) as issues
FROM (
    SELECT move_id
    FROM wms_inventory_ledger
    WHERE move_id IS NOT NULL
    GROUP BY move_id
    HAVING ABS(
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE 0 END) - 
        SUM(CASE WHEN direction = 'out' THEN piece_qty ELSE 0 END)
    ) > 0.01
) t;

-- Check 5: No Duplicate Balance
SELECT 'Duplicate Balance' as check_name, COUNT(*) as issues
FROM (
    SELECT pallet_id, sku_id, location_id
    FROM wms_inventory_balances
    WHERE pallet_id IS NOT NULL
    GROUP BY pallet_id, sku_id, location_id
    HAVING COUNT(*) > 1
) t;

-- Check 6: Ledger Sum = Balance (Sample)
SELECT 'Ledger vs Balance Mismatch' as check_name, COUNT(*) as issues
FROM (
    SELECT 
        b.pallet_id,
        b.total_piece_qty as balance_qty,
        COALESCE(l.net, 0) as ledger_net
    FROM wms_inventory_balances b
    LEFT JOIN (
        SELECT 
            pallet_id,
            SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as net
        FROM wms_inventory_ledger
        WHERE pallet_id IS NOT NULL
        GROUP BY pallet_id
    ) l ON b.pallet_id = l.pallet_id
    WHERE b.pallet_id IS NOT NULL
    AND ABS(b.total_piece_qty - COALESCE(l.net, 0)) > 0.01
) t;
```

### 6.2 Expected Results

| Check | Expected Result |
|-------|----------------|
| Negative Piece Qty | 0 |
| Negative Pack Qty | 0 |
| Receiving Negative | 0 |
| Unmatched Transfers | 0 |
| Duplicate Balance | 0 |
| Ledger vs Balance Mismatch | 0 |

---

## 📝 PHASE 7: Generate Final Report

### 7.1 สร้างรายงานสรุป

```markdown
# 📊 รายงานการแก้ไขข้อมูลสต็อก WMS - FINAL

**วันที่แก้ไข:** ___
**ผู้ดำเนินการ:** AI Data Engineer

---

## สรุปการแก้ไข

| # | ปัญหา | จำนวนก่อนแก้ | จำนวนหลังแก้ | สถานะ |
|---|-------|-------------|-------------|-------|
| 1 | Receiving ติดลบ (ไม่มี pallet_id) | 4 | 0 | ✅ |
| 2 | Ledger > Balance | 1 | 0 | ✅ |
| 3 | Negative Pack Qty | 14 | 0 | ✅ |
| 4 | Transfer Pairs ไม่ครบ | 0 | 0 | ✅ |
| 5 | Duplicate Balance | 0 | 0 | ✅ |
| 6 | Ledger vs Balance Mismatch | ___ | 0 | ✅ |

---

## รายละเอียดการแก้ไข

### 1. Receiving ติดลบ
- **สาเหตุ:** มี entries ย้ายออกจาก Receiving โดยไม่มี pallet_id
- **การแก้ไข:** สร้าง Adjustment entries และลบ Balance records ที่ไม่จำเป็น
- **Adjustment entries สร้าง:** ___ รายการ
- **Balance records ลบ:** ___ รายการ

### 2. Ledger > Balance (ATG2500012644)
- **สาเหตุ:** มีการหยิบสินค้าออกไปแล้วไม่ได้บันทึก Ledger
- **การแก้ไข:** สร้าง Adjustment entry ลด 240 ชิ้น
- **ยอดหลังแก้:** Ledger = Balance = 336 ชิ้น

### 3. Negative Pack Qty
- **สาเหตุ:** Pack ถูกหักมากเกินไปในบ้านหยิบ (Tester/Premium)
- **การแก้ไข:** Set Pack = 0 สำหรับรายการที่มีปัญหา
- **รายการที่แก้ไข:** 14 รายการ

---

## Verification Results

| Check | Result |
|-------|--------|
| Negative Piece Qty | 0 ✅ |
| Negative Pack Qty | 0 ✅ |
| Receiving Negative | 0 ✅ |
| Unmatched Transfers | 0 ✅ |
| Duplicate Balance | 0 ✅ |
| Ledger vs Balance Mismatch | 0 ✅ |

---

## Backup Files Created

| Backup Table | Records |
|--------------|---------|
| _backup_balances_20260113 | ___ |
| _backup_ledger_20260113 | ___ |
| _backup_receiving_fix_20260113 | ___ |
| _backup_pallet_fix_20260113 | ___ |
| _backup_negative_pack_fix_20260113 | ___ |

---

## สถานะข้อมูลปัจจุบัน

✅ **ข้อมูลสะอาด 100%**
- ไม่มี Balance ติดลบ
- ไม่มี Duplicate records
- ไม่มี Orphan data
- Ledger Sum = Balance ทุกรายการ
- Transfer Pairs ครบถ้วน

---

**สร้างโดย:** AI Data Engineer
**วันที่:** ___
```

---

## 🚨 Final Checklist

```
□ Backup ข้อมูลก่อนแก้ไข
□ แก้ไข Receiving ติดลบ (4 รายการ)
□ แก้ไข Ledger > Balance (1 รายการ)
□ แก้ไข Negative Pack Qty (14 รายการ)
□ Run Verification Queries
□ All checks = 0 issues
□ สร้างรายงานสรุป
□ ข้อมูลสะอาด 100% ✅
```

---

## ⚠️ หมายเหตุสำคัญ

1. **Backup ก่อนเสมอ** - ห้ามรัน script โดยไม่ backup
2. **รัน Verification หลังแก้ไข** - ต้องผ่านทุก check
3. **Physical Count** - แนะนำให้ทำ Physical Stock Count ยืนยัน
4. **Monitor** - ติดตามว่าปัญหาไม่เกิดซ้ำ

---

**สิ้นสุด PROMPT**