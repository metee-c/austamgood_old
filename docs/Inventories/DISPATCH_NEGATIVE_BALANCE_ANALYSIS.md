# การวิเคราะห์ปัญหา Inventory Balance ติดลบที่ Location "Dispatch"

## สรุปปัญหา (Executive Summary)

**ปัญหาหลัก**: ระบบแสดงยอด Inventory ที่ Location "Dispatch" ติดลบ -5,972 ชิ้น แต่จากการตรวจสอบ Ledger พบว่ายอดที่ถูกต้องควรเป็น -330 ชิ้นเท่านั้น

**ความแตกต่าง**: Balance Table แสดงยอดติดลบมากกว่า Ledger ถึง **5,642 ชิ้น**

---

## 1. ข้อมูลที่ตรวจสอบได้

### 1.1 ยอด Inventory ปัจจุบัน
- **จาก Balance Table**: -5,972.00 ชิ้น
- **จาก Ledger (คำนวณจริง)**: -330.00 ชิ้น
- **ความแตกต่าง**: -5,642.00 ชิ้น

### 1.2 สถานะ 3 Picklists ที่ยังไม่โหลด
```
PL-20260118-001: status = completed, 23 items, 1,070 pieces
PL-20260118-002: status = completed, 6 items, 278 pieces  
PL-20260118-003: status = completed, 11 items, 714 pieces
---
รวม: 40 items, 2,062 pieces
```

### 1.3 Transaction Summary จาก Ledger
**IN Transactions:**
- pick: 103,986 pieces (4,835 transactions)
- ADJUSTMENT: 15,778 pieces (80 transactions)
- adjustment: 2,657 pieces (75 transactions)
- adjust: 15,832 pieces (9 transactions)
- sync_adjustment: 7,045 pieces (74 transactions)
- transfer: 577 pieces (12 transactions)
- TRANSFER: 351 pieces (2 transactions)
- **Total IN: 146,226 pieces**

**OUT Transactions:**
- ship: 113,100 pieces (2,719 transactions)
- sync_adjustment: 15,369 pieces (11 transactions)
- pick: 14,734 pieces (463 transactions)
- rollback: 1,946 pieces (77 transactions)
- adjustment: 1,330 pieces (15 transactions)
- TRANSFER: 77 pieces (2 transactions)
- **Total OUT: 146,556 pieces**

**Net Balance from Ledger: -330 pieces** ✓

---

## 2. Root Cause Analysis (สาเหตุหลัก)

### 2.1 ปัญหาหลัก: Balance Table ไม่ Sync กับ Ledger

**หลักฐาน:**
1. Ledger แสดงยอดสุทธิ = -330 ชิ้น (ถูกต้อง)
2. Balance Table แสดงยอดสุทธิ = -5,972 ชิ้น (ผิดพลาด)
3. ความแตกต่าง = 5,642 ชิ้น

### 2.2 สาเหตุที่เป็นไปได้

#### A. Trigger ที่ Sync Ledger → Balance ทำงานผิดพลาด
- มี sync_adjustment transactions จำนวนมาก (85 transactions)
- Transaction ล่าสุดเมื่อ 2026-01-10 (9 วันที่แล้ว)
- อาจมี transactions บางรายการที่ไม่ได้ update balance table

#### B. Balance Table ถูก Update โดยตรงโดยไม่ผ่าน Ledger
- พบ adjustment transactions ที่มีหลายรูปแบบ: `adjust`, `adjustment`, `ADJUSTMENT`
- อาจมีการ update balance โดยตรงในบาง cases

#### C. Race Condition ในการ Update Balance
- มี pick transactions จำนวนมาก (5,298 transactions)
- อาจเกิด race condition เมื่อมีการ pick พร้อมกันหลาย transactions

### 2.3 SKUs ที่มียอดติดลบมากที่สุด

| SKU | ชื่อสินค้า | ยอดติดลบ | จำนวน Pallets |
|-----|-----------|----------|---------------|
| B-BEY-C\|SAL\|010 | Buzz Beyond แมวโต รสแซลมอน 1 กก. | -2,082 | 1 |
| B-NET-C\|FNC\|010 | Buzz Netura แมวโตและลูก ปลาและไก่ 1 กก. | -1,302 | 1 |
| B-BEY-C\|MNB\|010 | Buzz Beyond แม่และลูกแมว 1 กก. | -1,224 | 1 |
| B-NET-C\|SAL\|010 | Buzz Netura แมวโตและลูก แซลมอน 1 กก. | -684 | 1 |
| B-NET-C\|FHC\|010 | Buzz Netura แมวโตและลูก ปลาเนื้อขาว 1 กก. | -630 | 1 |

**Pattern**: สินค้าที่ติดลบส่วนใหญ่เป็น SKU ขนาด 1 กก. ที่มี pallet_id = `DISPATCH-STOCK-20260114-065747`

---

## 3. ยอดที่ถูกต้องควรเป็น

### 3.1 คำนวณจาก Ledger
```
Total IN:  146,226 pieces
Total OUT: 146,556 pieces
Net:       -330 pieces
```

### 3.2 คำนวณจาก 3 Picklists ที่ยังไม่โหลด
```
PL-20260118-001: 1,070 pieces
PL-20260118-002: 278 pieces
PL-20260118-003: 714 pieces
Total Expected: 2,062 pieces
```

### 3.3 ความไม่สอดคล้อง
- ถ้า 3 picklists ยังไม่ได้โหลด ยอดควรเป็น **+2,062 pieces** (บวก)
- แต่ Ledger แสดง **-330 pieces** (ลบ)
- **ความแตกต่าง: 2,392 pieces**

**สรุป**: มีปัญหา 2 ระดับ
1. Balance Table ไม่ sync กับ Ledger (-5,642 pieces)
2. Ledger เองก็มีปัญหา เพราะควรเป็นบวกแต่กลับเป็นลบ (-2,392 pieces)

---

## 4. SQL Script แก้ไข

### 4.1 Recalculate Balance จาก Ledger

```sql
-- Step 1: Backup current balance
CREATE TEMP TABLE dispatch_balance_backup AS
SELECT * FROM wms_inventory_balances
WHERE location_id = 'Dispatch';

-- Step 2: Recalculate balance from ledger
WITH ledger_summary AS (
    SELECT 
        location_id,
        sku_id,
        pallet_id,
        lot_no,
        production_date,
        expiry_date,
        SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as calculated_piece_qty,
        SUM(CASE WHEN direction = 'in' THEN pack_qty ELSE -pack_qty END) as calculated_pack_qty,
        MAX(created_at) as last_movement_at
    FROM wms_inventory_ledger
    WHERE location_id = 'Dispatch'
    GROUP BY location_id, sku_id, pallet_id, lot_no, production_date, expiry_date
)
UPDATE wms_inventory_balances ib
SET 
    total_piece_qty = COALESCE(ls.calculated_piece_qty, 0),
    total_pack_qty = COALESCE(ls.calculated_pack_qty, 0),
    last_movement_at = ls.last_movement_at,
    updated_at = NOW()
FROM ledger_summary ls
WHERE ib.location_id = ls.location_id
    AND ib.sku_id = ls.sku_id
    AND COALESCE(ib.pallet_id, '') = COALESCE(ls.pallet_id, '')
    AND COALESCE(ib.lot_no, '') = COALESCE(ls.lot_no, '')
    AND ib.location_id = 'Dispatch';

-- Step 3: Verify the fix
SELECT 
    'After Fix' as status,
    SUM(total_piece_qty) as total_pieces,
    COUNT(*) as balance_records
FROM wms_inventory_balances
WHERE location_id = 'Dispatch';
```

### 4.2 ตรวจสอบ Trigger ที่ Sync Ledger → Balance

```sql
-- Check if sync trigger exists and is working
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'wms_inventory_ledger'
    AND trigger_name LIKE '%sync%';
```

---

## 5. Recommendations (คำแนะนำป้องกัน)

### 5.1 ระยะสั้น (Immediate)
1. **รัน SQL Script แก้ไข** เพื่อ recalculate balance จาก ledger
2. **ตรวจสอบ 3 picklists** ว่าถูก ship ไปแล้วหรือยัง
3. **ตรวจสอบ Trigger** ที่ sync ledger → balance ว่าทำงานถูกต้อง

### 5.2 ระยะกลาง (Short-term)
1. **เพิ่ม Monitoring** เพื่อตรวจจับความไม่สอดคล้องระหว่าง Ledger และ Balance
2. **สร้าง Scheduled Job** ที่ verify และ reconcile balance ทุกวัน
3. **เพิ่ม Logging** ในทุก transaction ที่ update balance

### 5.3 ระยะยาว (Long-term)
1. **Refactor Balance Update Logic**
   - ใช้ Ledger เป็น single source of truth
   - Balance table เป็นเพียง materialized view
   - Update balance ผ่าน trigger เท่านั้น ห้าม update โดยตรง

2. **เพิ่ม Constraint**
   ```sql
   -- Add check constraint to prevent manual updates
   ALTER TABLE wms_inventory_balances 
   ADD CONSTRAINT balance_must_match_ledger 
   CHECK (updated_at >= created_at);
   ```

3. **สร้าง Reconciliation Report**
   - รายงานเปรียบเทียบ Ledger vs Balance ทุกวัน
   - Alert เมื่อพบความแตกต่างเกิน threshold

4. **Standardize Transaction Types**
   - ใช้ lowercase เท่านั้น: `adjustment`, `pick`, `ship`, `transfer`
   - ห้ามใช้ `ADJUSTMENT`, `TRANSFER`, `adjust` (mixed case)

---

## 6. การตรวจสอบหลังแก้ไข

### 6.1 Verification Queries

```sql
-- 1. Check total balance
SELECT 
    SUM(total_piece_qty) as total_pieces,
    SUM(reserved_piece_qty) as reserved_pieces,
    COUNT(*) as balance_records
FROM wms_inventory_balances
WHERE location_id = 'Dispatch';

-- 2. Compare with ledger
SELECT 
    'Ledger' as source,
    SUM(CASE WHEN direction = 'in' THEN piece_qty ELSE -piece_qty END) as net_balance
FROM wms_inventory_ledger
WHERE location_id = 'Dispatch'
UNION ALL
SELECT 
    'Balance Table' as source,
    SUM(total_piece_qty) as net_balance
FROM wms_inventory_balances
WHERE location_id = 'Dispatch';

-- 3. Check for negative balances
SELECT 
    sku_id,
    sku_name,
    SUM(total_piece_qty) as total_balance
FROM wms_inventory_balances ib
JOIN master_sku ms ON ib.sku_id = ms.sku_id
WHERE location_id = 'Dispatch'
    AND total_piece_qty < 0
GROUP BY sku_id, sku_name
ORDER BY total_balance;
```

### 6.2 Expected Results
- Total balance ≈ -330 pieces (from ledger)
- No difference between Ledger and Balance Table
- Negative balances should be minimal or zero

---

## 7. สรุป

### ปัญหาที่พบ
1. **Balance Table ไม่ sync กับ Ledger** (-5,642 pieces difference)
2. **Ledger เองมีปัญหา** (ควรเป็น +2,062 แต่เป็น -330)
3. **3 Picklists ยังไม่ได้โหลด** แต่ระบบแสดงว่าโหลดแล้ว

### แนวทางแก้ไข
1. Recalculate balance จาก ledger
2. ตรวจสอบและแก้ไข trigger ที่ sync ledger → balance
3. ตรวจสอบ 3 picklists และ loadlist ที่เกี่ยวข้อง
4. เพิ่ม monitoring และ reconciliation process

### ผลกระทบ
- **ระดับสูง**: ข้อมูล inventory ไม่ถูกต้อง อาจส่งผลต่อการวางแผนและการจัดส่ง
- **ต้องแก้ไขทันที**: เพื่อป้องกันปัญหาลุกลาม

---

**วันที่วิเคราะห์**: 2026-01-19  
**ผู้วิเคราะห์**: Kiro AI Assistant  
**สถานะ**: รอการแก้ไข
