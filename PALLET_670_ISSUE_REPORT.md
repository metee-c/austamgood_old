# Pallet ATG202601150000000670 - Issue Report & Solution

## ปัญหา
ที่หน้า http://localhost:3000/mobile/transfer > หาพาเลท ATG202601150000000670 ไม่เจอ

## การวิเคราะห์

### 1. สถานะปัจจุบัน
- ❌ **ไม่พบใน `wms_inventory_balances`** (ตารางที่ API ใช้ค้นหา)
- ✅ **พบใน `wms_inventory_ledger`** (3 transactions)
- ⚠️ **Data Corruption**: ข้อมูลใน ledger มี `piece_qty_change` และ `balance_after_piece_qty` เป็น `null`
- ❌ **ไม่พบ source documents** (ไม่มีใน receive_items, move_items)

### 2. Transaction History

```
Entry 1: receive (2026-01-15 09:53:35)
  - SKU: B-NET-C|SAL|010
  - Location: Receiving
  - Piece Qty Change: null ❌
  - Balance After: null ❌
  - Source Document: null ❌

Entry 2: transfer (2026-01-16 06:17:50)
  - SKU: B-NET-C|SAL|010
  - Location: Receiving (ต้นทาง)
  - Piece Qty Change: null ❌
  - Balance After: null ❌
  - Source Document: null ❌

Entry 3: transfer (2026-01-16 06:17:50)
  - SKU: B-NET-C|SAL|010
  - Location: AA-BLK-29 (ปลายทาง)
  - Piece Qty Change: null ❌
  - Balance After: null ❌
  - Source Document: null ❌
```

### 3. สาเหตุ

**Orphan Record with Data Corruption:**
- พาเลทนี้เป็น orphan record ที่ไม่มี source document ใดๆ
- ไม่พบใน `wms_receive_items` (ไม่มีการรับเข้า)
- ไม่พบใน `wms_move_items` (ไม่มีการย้าย)
- มีเฉพาะ ledger entries ที่ corrupted (piece_qty_change = null)
- เมื่อ sync จาก ledger ไป balance จึงได้ balance = 0
- พาเลทจึงไม่ปรากฏใน `wms_inventory_balances` (filter `total_piece_qty > 0`)

**ผลกระทบ:**
- Mobile app ค้นหาพาเลทไม่เจอ (API query จาก `wms_inventory_balances`)
- ไม่สามารถย้ายพาเลทนี้ได้
- ข้อมูลสต็อกไม่ถูกต้อง

## วิธีแก้ไข

### ✅ Recommended Solution: ลบ Orphan Records

เนื่องจากพาเลทนี้:
1. ไม่มี source document (ไม่มีการรับเข้าจริง)
2. ข้อมูล corrupted (piece_qty_change = null)
3. ไม่มีสต็อกจริง (balance = 0)

**แนะนำให้ลบ ledger entries ที่เสียหายออก:**

```bash
# Run cleanup script
node fix-pallet-670-cleanup.js
```

หรือ manual SQL:

```sql
-- ลบ ledger entries ที่เสีย
DELETE FROM wms_inventory_ledger
WHERE pallet_id = 'ATG202601150000000670';
```

### การตรวจสอบหลังแก้ไข

```bash
# ตรวจสอบว่าลบสำเร็จ
node check-pallet-670-detail.js
```

ควรได้ผลลัพธ์:
```
Found 0 ledger entries
Balance Records: 0
```

## Prevention - ป้องกันปัญหาในอนาคต

### 1. เพิ่ม Database Constraints

```sql
-- ห้าม piece_qty_change เป็น null
ALTER TABLE wms_inventory_ledger
ADD CONSTRAINT check_piece_qty_not_null
CHECK (piece_qty_change IS NOT NULL);

-- ห้าม balance_after เป็น null
ALTER TABLE wms_inventory_ledger
ADD CONSTRAINT check_balance_after_not_null
CHECK (balance_after_piece_qty IS NOT NULL);

-- ต้องมี source_document
ALTER TABLE wms_inventory_ledger
ADD CONSTRAINT check_source_document_not_null
CHECK (source_document IS NOT NULL AND source_document != '');
```

### 2. เพิ่ม Validation ใน API/Triggers

ตรวจสอบก่อนสร้าง ledger entry:
- `piece_qty_change` ต้องไม่เป็น null
- `balance_after_piece_qty` ต้องไม่เป็น null
- `source_document` ต้องมีค่า
- ต้องมี source record (receive_item หรือ move_item) ที่อ้างอิง

### 3. เพิ่ม Monitoring

สร้าง query ตรวจสอบ orphan/corrupted records:

```sql
-- หา ledger entries ที่ corrupted
SELECT 
  pallet_id,
  COUNT(*) as corrupted_count
FROM wms_inventory_ledger
WHERE piece_qty_change IS NULL
   OR balance_after_piece_qty IS NULL
   OR source_document IS NULL
GROUP BY pallet_id;

-- หา orphan pallets (มีใน ledger แต่ไม่มีใน receive/move)
SELECT DISTINCT l.pallet_id
FROM wms_inventory_ledger l
WHERE l.pallet_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM wms_receive_items ri 
    WHERE ri.pallet_id = l.pallet_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM wms_move_items mi 
    WHERE mi.pallet_id = l.pallet_id
  );
```

## สรุป

พาเลท ATG202601150000000670 เป็น orphan record ที่มี data corruption ใน ledger ไม่มี source document และไม่มีสต็อกจริง แนะนำให้ลบ ledger entries ที่เสียหายออก และเพิ่ม constraints/validation เพื่อป้องกันปัญหาในอนาคต

**ขั้นตอนแก้ไข:**
1. รัน `node fix-pallet-670-cleanup.js` เพื่อลบ orphan records
2. ตรวจสอบด้วย `node check-pallet-670-detail.js`
3. เพิ่ม database constraints ตามที่แนะนำ
4. เพิ่ม validation ใน triggers/APIs
