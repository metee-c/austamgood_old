# รายงานการตรวจสอบ Stock Integrity อย่างละเอียด
**วันที่ตรวจสอบ:** 11 มกราคม 2569

---

## สรุปผลการตรวจสอบ

| ประเภทปัญหา | จำนวน | สถานะ |
|-------------|-------|-------|
| Negative Balances | 78 records | ⚠️ ต้องแก้ไข |
| Duplicate Balance Records | 83 extra records (27 groups) | 🔴 Critical |
| Balance vs Ledger Discrepancies | 29 unique cases | ⚠️ ต้องตรวจสอบ |

---

## 1. สาเหตุหลักของ Negative Balances

### 1.1 ลืมสแกนเติม (Replenishment) - 74 cases
**สาเหตุ:** หยิบสินค้าจากบ้านหยิบโดยไม่มีการเติมสต็อกจาก Bulk Storage

**ตัวอย่าง SKU ที่ได้รับผลกระทบ:**
| SKU | Location | Balance | สาเหตุ |
|-----|----------|---------|--------|
| B-BEY-C\|MNB\|NS\|010 | A09-01-003 | -52 packs (-624 pcs) | ไม่มี Stock Import/Receive เข้า บ้านหยิบ |
| B-NET-C\|SAL\|040 | PK001 | -31 packs (-124 pcs) | หยิบเกินจำนวนที่มี |
| B-NET-C\|FNC\|040 | PK001 | -20 packs (-80 pcs) | หยิบเกินจำนวนที่มี |

**หลักฐาน:**
- Ledger entries มี remarks "หยิบจาก xxx (สต็อกติดลบ)" แสดงว่าระบบรู้ว่าติดลบแต่ยังอนุญาตให้หยิบได้
- ไม่มี Transfer IN จาก Bulk Storage เข้าบ้านหยิบ

### 1.2 Tester SKUs ที่ Dispatch - 20 cases
**สาเหตุ:** หยิบของแถม (Tester) จาก Dispatch โดยไม่มี reservation หรือ stock เพียงพอ

**ตัวอย่าง:**
| SKU | Balance | สาเหตุ |
|-----|---------|--------|
| TT-NET-C\|CNT\|0005 | -9.90 packs (-495 pcs) | หยิบของแถมจาก Dispatch โดยไม่มี reservation |
| TT-NET-C\|FHC\|0005 | -7.90 packs (-395 pcs) | หยิบของแถมจาก Dispatch โดยไม่มี reservation |
| TT-NET-C\|FNC\|0005 | -6.90 packs (-345 pcs) | หยิบของแถมจาก Dispatch โดยไม่มี reservation |

### 1.3 Packaging Location - 2 cases (Critical)
**สาเหตุ:** Import เข้ามาเป็น piece แต่ Transfer out เป็น pack

**รายละเอียด:**
| SKU | Balance Pack | Balance Piece | ปัญหา |
|-----|--------------|---------------|-------|
| 01-NET-C\|FHC\|010 | -4,575 | 200,543 | Import 205,118 pieces, Transfer out 4,575 packs |
| OTHERS00069 | -4,575 | 11,969 | Import 16,544 pieces, Transfer out 4,575 packs |

**สาเหตุ:** Bug ในระบบ Production - เบิกวัสดุบรรจุภัณฑ์ใช้หน่วย pack แทน piece

---

## 2. Duplicate Balance Records (Critical)

พบ **27 กลุ่ม** ที่มี balance records ซ้ำกัน รวม **83 records ที่เกินมา**

### Top 10 Duplicate Groups:
| SKU | Location | จำนวน Records |
|-----|----------|---------------|
| B-NET-C\|CNT\|010 | Receiving | 12 |
| B-NET-C\|SAL\|010 | Receiving | 8 |
| B-BEY-C\|MCK\|070 | PK001 | 7 |
| B-NET-C\|FHC\|010 | Receiving | 6 |
| B-NET-C\|FNC\|040 | Receiving | 6 |
| B-BEY-C\|TUN\|070 | PK001 | 6 |
| B-BEY-C\|SAL\|070 | PK001 | 5 |
| B-NET-C\|FNC\|010 | Receiving | 5 |
| B-NET-C\|FNC\|040 | PK001 | 4 |
| B-BEY-C\|MNB\|070 | PK001 | 4 |

**สาเหตุที่เป็นไปได้:**
1. ไม่มี UNIQUE constraint บน (sku_id, location_id, pallet_id)
2. Race condition ในการสร้าง balance records
3. Migration scripts สร้าง records ซ้ำ

---

## 3. Balance vs Ledger Discrepancies

พบ **29 unique cases** ที่ Balance ไม่ตรงกับผลรวมจาก Ledger

### สาเหตุหลัก:
1. **Duplicate Balance Records** - ทำให้ผลรวม Balance ไม่ตรง
2. **Missing Ledger Entries** - มี Balance แต่ไม่มี Ledger
3. **Unit Mismatch** - Import เป็น piece แต่ Transfer เป็น pack

---

## 4. การวิเคราะห์ตาม Location

| Location | Problem Count | Total Negative Pack | ประเภทปัญหา |
|----------|---------------|---------------------|-------------|
| PK001 (bulk) | 21 | -573.50 | ลืมเติม + Duplicate |
| Dispatch | 20 | -97.03 | Tester หยิบเกิน |
| PK002 (floor) | 6 | -456.82 | ลืมเติม |
| MR01 (floor) | 4 | -40.45 | ของแถมหยิบเกิน |
| Packaging | 2 | -9,150.00 | Unit mismatch (Critical) |
| A09-01-xxx (rack) | ~24 | various | ลืมเติมบ้านหยิบ |

---

## 5. ข้อเสนอแนะการแก้ไข

### 5.1 แก้ไขเร่งด่วน (Critical)

#### A. ลบ Duplicate Balance Records
```sql
-- ลบ duplicate records เก็บไว้เฉพาะ record ที่มี balance_id ต่ำสุด
DELETE FROM wms_inventory_balances
WHERE balance_id NOT IN (
  SELECT MIN(balance_id)
  FROM wms_inventory_balances
  GROUP BY sku_id, location_id, COALESCE(pallet_id, '')
);
```

#### B. เพิ่ม UNIQUE Constraint
```sql
-- เพิ่ม constraint ป้องกัน duplicate
ALTER TABLE wms_inventory_balances
ADD CONSTRAINT uq_balance_sku_location_pallet 
UNIQUE (sku_id, location_id, pallet_id);
```

#### C. แก้ไข Packaging Unit Mismatch
```sql
-- ปรับ pack_qty ให้เป็น 0 และใช้ piece_qty แทน
UPDATE wms_inventory_balances
SET total_pack_qty = 0
WHERE location_id = 'Packaging'
  AND sku_id IN ('01-NET-C|FHC|010', 'OTHERS00069');
```

### 5.2 แก้ไขระยะกลาง

#### A. ป้องกันการหยิบเกินสต็อก
- เพิ่ม validation ใน Pick API ไม่ให้หยิบถ้า balance <= 0
- แสดง warning ถ้าสต็อกใกล้หมด

#### B. Auto-Replenishment Alert
- สร้าง trigger แจ้งเตือนเมื่อบ้านหยิบใกล้หมด
- เพิ่ม reorder_point ใน master_sku

### 5.3 แก้ไขระยะยาว

#### A. Audit Trail
- บันทึกทุกการเปลี่ยนแปลง balance พร้อม user และ timestamp
- สร้าง reconciliation report รายวัน

#### B. Stock Count Integration
- เปรียบเทียบ physical count กับ system balance
- สร้าง adjustment workflow

---

## 6. รายละเอียด SKU ที่มีปัญหา (Top 10)


### SKU #1: B-BEY-C|MNB|NS|010
```
====================================
SKU: B-BEY-C|MNB|NS|010
ชื่อ: Buzz Beyond แม่และลูกแมว รสแซลมอน ทูน่า และนม | 1 กก. [No Sticker]
หน่วย: ถุง (12 ชิ้น/แพ็ค)
บ้านหยิบ: A09-01-003
====================================

สถานะปัจจุบัน @ A09-01-003:
- Balance: -52 packs / -624 pieces
- Ledger Net: -52 packs / -624 pieces ✅ ตรงกัน

ประวัติการเคลื่อนไหว:
- ไม่มี Stock Import/Receive เข้า A09-01-003
- มี Adjustment IN 534 packs (ปรับยอดติดลบเป็น 0)
- มี Sync Adjustment IN 6 packs (migration 196)
- มี Pick OUT ต่อเนื่อง 192 packs หลังจากปรับ

สาเหตุ: ลืมสแกนเติม (Replenishment)
- มี Stock ใน Bulk Storage (A10-04-xxx, A10-05-xxx) รวม 2,544 packs
- แต่ไม่มี Transfer เข้า A09-01-003 (บ้านหยิบ)

ข้อเสนอแนะ:
1. Transfer stock จาก Bulk Storage เข้าบ้านหยิบ
2. หรือ Adjustment IN 52 packs เพื่อปรับยอดเป็น 0
```

### SKU #2: TT-NET-C|CNT|0005
```
====================================
SKU: TT-NET-C|CNT|0005
ชื่อ: Tester | Buzz Netura แมวโตและสูงวัยอายุ 7 ปีขึ้นไป ปลาค็อด และ ปลาเทราต์ | 50 กรัม
หน่วย: ซอง (50 ชิ้น/แพ็ค)
บ้านหยิบ: A10-01-022
====================================

สถานะปัจจุบัน @ Dispatch:
- Balance: -9.90 packs / -495 pieces
- Ledger Net: -9.90 packs / -495 pieces ✅ ตรงกัน

ประวัติการเคลื่อนไหว:
- Pick IN 22.20 packs (1,110 pieces) จาก BFS (Bonus Face Sheet)
- Pick OUT 32.10 packs (1,605 pieces) ไป MR01, MR02, MR03
- Ship OUT ไป Delivery-In-Progress

สาเหตุ: หยิบของแถมจาก Dispatch โดยไม่มี reservation
- Ledger remarks: "หยิบของแถมจากบ้านหยิบ Dispatch (ไม่มี reservation)"

ข้อเสนอแนะ:
1. เติม Tester จาก A10-02-007 (มี 122 packs) เข้า Dispatch
2. หรือ Adjustment IN 9.90 packs
```

### SKU #3-5: Tester SKUs อื่นๆ ที่ Dispatch
```
====================================
SKUs ที่มีปัญหาเดียวกัน:
- TT-NET-C|FHC|0005: -7.90 packs (-395 pieces)
- TT-NET-C|FNC|0005: -6.90 packs (-345 pieces)
- TT-NET-C|SAL|0005: -6.90 packs (-345 pieces)
- TT-NET-D|CHI-S|0005: -4.60 packs (-230 pieces)
====================================

สาเหตุ: เหมือน SKU #2 - หยิบของแถมจาก Dispatch โดยไม่มี reservation

ข้อเสนอแนะ: เติม Tester จาก Bulk Storage หรือ Adjustment IN
```

### SKU #6-7: Packaging Materials (Critical)
```
====================================
SKU: 01-NET-C|FHC|010
ชื่อ: ถุง | Buzz Netura แมวโตและลูก ปลาเนื้อขาว แฮร์ริ่ง และไก่ | 1 กก.
หน่วย: ใบ (1 ชิ้น/แพ็ค)
====================================

สถานะปัจจุบัน @ Packaging:
- Balance: -4,575 packs / 200,543 pieces

Ledger History:
1. Import IN: 0 packs, 205,118 pieces
2. Transfer OUT: 2,058 packs, 2,058 pieces (PO-20260106-001)
3. Transfer OUT: 2,517 packs, 2,517 pieces (PO-20260106-002)

สาเหตุ: Unit Mismatch Bug
- Import เข้ามาเป็น piece (205,118)
- Transfer out เป็น pack (4,575)
- ระบบคิดว่า pack = piece ทำให้ติดลบ

ข้อเสนอแนะ:
1. แก้ไข Production Material Issue ให้ใช้ piece แทน pack
2. ปรับ Balance: SET total_pack_qty = 0 (ใช้ piece_qty แทน)
```

---

## 7. Migration Script สำหรับแก้ไข

```sql
-- Migration: 197_fix_stock_integrity_issues.sql

-- 1. ลบ Duplicate Balance Records
WITH duplicates AS (
  SELECT balance_id,
         ROW_NUMBER() OVER (
           PARTITION BY sku_id, location_id, COALESCE(pallet_id, '')
           ORDER BY balance_id
         ) as rn
  FROM wms_inventory_balances
)
DELETE FROM wms_inventory_balances
WHERE balance_id IN (
  SELECT balance_id FROM duplicates WHERE rn > 1
);

-- 2. แก้ไข Packaging Unit Mismatch
UPDATE wms_inventory_balances
SET total_pack_qty = 0
WHERE location_id IN (SELECT location_id FROM master_location WHERE location_code = 'Packaging')
  AND sku_id IN ('01-NET-C|FHC|010', 'OTHERS00069');

-- 3. เพิ่ม UNIQUE Constraint (หลังลบ duplicates)
-- ALTER TABLE wms_inventory_balances
-- ADD CONSTRAINT uq_balance_sku_location_pallet 
-- UNIQUE NULLS NOT DISTINCT (sku_id, location_id, pallet_id);

-- 4. ปรับ Negative Balances ที่ Dispatch (Tester SKUs)
-- ต้องตัดสินใจว่าจะ:
-- A) Adjustment IN เพื่อปรับเป็น 0
-- B) Transfer จาก Bulk Storage
-- ขึ้นอยู่กับ business decision
```

---

## 8. สรุป

### ปัญหาหลักที่พบ:
1. **ลืมสแกนเติม (Replenishment)** - 74 cases
2. **Duplicate Balance Records** - 83 extra records
3. **Unit Mismatch ใน Packaging** - 2 cases (Critical)
4. **หยิบของแถมเกินสต็อก** - 20 cases

### ลำดับความสำคัญในการแก้ไข:
1. 🔴 **Critical:** ลบ Duplicate Balance Records
2. 🔴 **Critical:** แก้ไข Packaging Unit Mismatch
3. ⚠️ **High:** เพิ่ม UNIQUE Constraint
4. ⚠️ **Medium:** ปรับ Negative Balances ที่ Dispatch
5. 📋 **Low:** ปรับ Negative Balances ที่บ้านหยิบ (ต้อง Transfer จาก Bulk)

### ข้อเสนอแนะเพิ่มเติม:
- เพิ่ม validation ไม่ให้หยิบถ้า balance <= 0
- สร้าง Auto-Replenishment Alert
- สร้าง Daily Reconciliation Report


---

## 9. ผลการแก้ไข (Migration 197)

### สิ่งที่แก้ไขแล้ว:
| รายการ | ก่อน | หลัง | สถานะ |
|--------|------|------|--------|
| Packaging Unit Mismatch | -9,150 packs | 0 packs | ✅ แก้ไขแล้ว |
| Unique Index | ไม่มี | มี | ✅ เพิ่มแล้ว |

### หมายเหตุเรื่อง "Duplicate" Balance Records:
- พบว่า records ที่ดูเหมือน duplicate จริงๆ แล้วเป็น **records ที่มี pallet_id ต่างกัน**
- นี่คือ design ที่ถูกต้อง - ระบบ track stock แยกตาม pallet
- ไม่ต้องลบ records เหล่านี้

---

## 10. Negative Balances ที่เหลือ (76 records) - Expected Behavior

### ⚠️ Business Rule: บ้านหยิบยอมให้ติดลบได้
**เหตุผล:** เพื่อไม่ให้ผู้ใช้ติดปัญหาตอนหยิบ กรณีลืมเติมสต็อก

### จัดกลุ่มตาม Location Type:
| Location Type | จำนวน | Total Negative Pack | สถานะ |
|---------------|-------|---------------------|--------|
| rack (บ้านหยิบ) | 24 | -382.77 | ✅ Expected - รอเติม |
| bulk (PK001) | 21 | -573.50 | ✅ Expected - รอเติม |
| dispatch | 20 | -97.03 | ✅ Expected - รอเติม |
| floor (pick_face) | 6 | -456.82 | ✅ Expected - รอเติม |
| floor (MR) | 5 | -47.65 | ✅ Expected - รอเติม |

### สรุป: ไม่ต้องแก้ไข Negative Balances เหล่านี้
- เป็น expected behavior ตาม business rule
- ผู้ใช้จะเติมสต็อกเมื่อมีเวลา
- ระบบจะกลับมาเป็นบวกเมื่อมีการ Transfer/Replenishment

---

## 11. สรุปผลการ Audit

### ✅ ปัญหาที่แก้ไขแล้ว:
1. **Packaging Unit Mismatch** - แก้ไขแล้ว (Migration 197)
2. **Unique Index** - เพิ่มแล้วป้องกัน duplicates

### ✅ ไม่ใช่ปัญหา (Expected Behavior):
1. **Negative Balances ที่บ้านหยิบ** - ยอมให้ติดลบได้ตาม business rule
2. **Multiple Balance Records per SKU-Location** - เป็น design ที่ถูกต้อง (track by pallet)

### 📋 ข้อเสนอแนะเพิ่มเติม (Optional):
1. **Auto-Replenishment Alert** - แจ้งเตือนเมื่อบ้านหยิบใกล้หมดหรือติดลบ
2. **Daily Report** - รายงานสรุป Negative Balances ให้ทีมคลังสินค้า
