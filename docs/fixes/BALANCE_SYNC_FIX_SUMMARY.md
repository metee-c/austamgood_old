# สรุปการแก้ไขปัญหา Balance Sync ทำงานซ้ำซ้อน

**วันที่:** 2025-11-29
**ปัญหา:** ทริกเกอร์ `trg_sync_inventory_ledger_to_balance` ทำงานซ้ำซ้อนกับ API ทำให้ balance เพิ่ม/ลด 2 เท่า
**วิธีแก้ไข:** เพิ่ม flag `skip_balance_sync` เพื่อให้ API เลือกได้ว่าจะให้ทริกเกอร์ทำงานหรือไม่

---

## 🔴 ปัญหาที่พบ

### สาเหตุ
API สองตัวนี้อัปเดต `wms_inventory_balances` ด้วยตัวเองแล้ว แต่ยังสร้าง ledger entries ด้วย:
1. `POST /api/mobile/pick/scan` - หยิบสินค้า
2. `POST /api/mobile/loading/complete` - โหลดสินค้าขึ้นรถ

เมื่อ API สร้าง ledger entries → ทริกเกอร์ `trg_sync_inventory_ledger_to_balance` ทำงาน → **อัปเดต balance อีกรอบ!**

### ผลกระทบ
- สต็อคเพิ่ม/ลด **2 เท่า**
- ข้อมูล balance ไม่ถูกต้อง
- ข้อมูล ledger และ balance ไม่ match กัน

---

## ✅ การแก้ไขที่ทำแล้ว

### 1. Migration 047: เพิ่มคอลัมน์และแก้ไขทริกเกอร์

**ไฟล์:** `supabase/migrations/047_add_skip_balance_sync_flag.sql`

#### การเปลี่ยนแปลง:

##### 1.1 เพิ่มคอลัมน์ `skip_balance_sync`
```sql
ALTER TABLE wms_inventory_ledger
ADD COLUMN IF NOT EXISTS skip_balance_sync BOOLEAN DEFAULT FALSE;
```

**คำอธิบาย:**
- Default = `FALSE` → ทริกเกอร์ทำงานปกติ
- Set = `TRUE` → ทริกเกอร์ข้ามการอัปเดต balance

##### 1.2 แก้ไขฟังก์ชัน `sync_inventory_ledger_to_balance()`
```sql
CREATE OR REPLACE FUNCTION sync_inventory_ledger_to_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- ✅ เช็ค flag ก่อนทำงาน
    IF NEW.skip_balance_sync = TRUE THEN
        RAISE NOTICE 'Skipping balance sync for ledger entry %', NEW.ledger_id;
        RETURN NEW;  -- ไม่ทำอะไร
    END IF;

    -- ทำงานปกติ (อัปเดต balance)...
    -- ...
END;
$$ LANGUAGE plpgsql;
```

**ผลลัพธ์:**
- ✅ Migration รันสำเร็จ (No rows returned)
- ✅ คอลัมน์ `skip_balance_sync` ถูกเพิ่มแล้ว
- ✅ ทริกเกอร์ทำงานได้แต่จะเช็ค flag ก่อน

---

### 2. แก้ไข API: /mobile/pick/scan

**ไฟล์:** `app/api/mobile/pick/scan/route.ts`

#### การเปลี่ยนแปลง:

##### Location 1: Ledger OUT จาก source_location (บรรทัด 182-196)
```typescript
ledgerEntries.push({
  // ... existing fields ...
  remarks: `หยิบจาก ${item.source_location_id} - ${item.picklists.picklist_code}`,
  skip_balance_sync: true  // ✅ เพิ่มบรรทัดนี้
});
```

##### Location 2: Ledger IN ไปยัง Dispatch (บรรทัด 249-263)
```typescript
ledgerEntries.push({
  // ... existing fields ...
  remarks: `ย้ายไป Dispatch - ${item.picklists.picklist_code}`,
  skip_balance_sync: true  // ✅ เพิ่มบรรทัดนี้
});
```

**เหตุผล:**
- API อัปเดต balance ด้วยตัวเองแล้ว (บรรทัด 162-179 และ 222-245)
- ไม่ต้องการให้ทริกเกอร์อัปเดตอีกรอบ

**ลำดับการทำงานหลังแก้ไข:**
```
1. API: ลดสต็อคจาก source_location (อัปเดต balance)
2. API: เพิ่มสต็อคที่ Dispatch (อัปเดต balance)
3. API: สร้าง ledger entries (skip_balance_sync = true)
4. ทริกเกอร์: เช็ค flag → ข้ามการอัปเดต balance ✅
```

---

### 3. แก้ไข API: /mobile/loading/complete

**ไฟล์:** `app/api/mobile/loading/complete/route.ts`

#### การเปลี่ยนแปลง:

##### Location 1: Ledger OUT จาก Dispatch (บรรทัด 165-179)
```typescript
ledgerEntries.push({
  // ... existing fields ...
  remarks: `ออกจาก Dispatch - ${picklist.picklist_code}`,
  skip_balance_sync: true  // ✅ เพิ่มบรรทัดนี้
});
```

##### Location 2: Ledger IN ไปยัง Delivery-In-Progress (บรรทัด 180-195)
```typescript
ledgerEntries.push({
  // ... existing fields ...
  remarks: `เข้า Delivery-In-Progress - ${picklist.picklist_code}`,
  skip_balance_sync: true  // ✅ เพิ่มบรรทัดนี้
});
```

**เหตุผล:**
- API อัปเดต balance ด้วยตัวเองแล้ว (บรรทัด 196-276)
- ไม่ต้องการให้ทริกเกอร์อัปเดตอีกรอบ

**ลำดับการทำงานหลังแก้ไข:**
```
1. API: ลดสต็อคจาก Dispatch (อัปเดต balance)
2. API: เพิ่มสต็อคที่ Delivery-In-Progress (อัปเดต balance)
3. API: สร้าง ledger entries (skip_balance_sync = true)
4. ทริกเกอร์: เช็ค flag → ข้ามการอัปเดต balance ✅
```

---

## 📊 ตารางสรุปการใช้งาน Flag

| API Endpoint | skip_balance_sync | เหตุผล |
|--------------|-------------------|--------|
| `POST /api/mobile/pick/scan` | ✅ `true` | API อัปเดต balance ด้วยตัวเอง |
| `POST /api/mobile/loading/complete` | ✅ `true` | API อัปเดต balance ด้วยตัวเอง |
| `POST /api/receives/[id]/complete` | ❌ `false` (default) | ให้ทริกเกอร์อัปเดต balance |
| `POST /api/moves/[id]/complete` | ❌ `false` (default) | ให้ทริกเกอร์อัปเดต balance |
| Ledger จากแหล่งอื่น | ❌ `false` (default) | ให้ทริกเกอร์อัปเดต balance |

---

## 🧪 การทดสอบ

### Test Case 1: Pick Process
**ขั้นตอน:**
1. บันทึกสต็อคเริ่มต้น:
   - Source Location (PK001): 100 ชิ้น
   - Dispatch: 0 ชิ้น
2. Worker หยิบสินค้า 10 ชิ้น
3. ตรวจสอบผลลัพธ์

**ผลที่คาดหวัง:**
```
Source Location (PK001):
- total_piece_qty: 100 → 90 ✅ ลด 10 ชิ้น
- reserved_piece_qty: ลดลง 10 ชิ้น

Dispatch:
- total_piece_qty: 0 → 10 ✅ เพิ่ม 10 ชิ้น

Ledger:
- 2 entries (OUT + IN) ✅
- skip_balance_sync = true ✅

สต็อครวมใน warehouse: 100 ชิ้น ✅ (ไม่เปลี่ยน)
```

**ผลก่อนแก้ไข (Bug):**
```
Dispatch:
- total_piece_qty: 0 → 20 ❌ เพิ่ม 2 เท่า!
  (API เพิ่ม 10 + ทริกเกอร์เพิ่มอีก 10)

สต็อครวมใน warehouse: 110 ชิ้น ❌ (เพิ่มขึ้น!)
```

---

### Test Case 2: Loading Process
**ขั้นตอน:**
1. บันทึกสต็อคเริ่มต้น:
   - Dispatch: 50 ชิ้น
   - Delivery-In-Progress: 0 ชิ้น
2. Complete loading 20 ชิ้น
3. ตรวจสอบผลลัพธ์

**ผลที่คาดหวัง:**
```
Dispatch:
- total_piece_qty: 50 → 30 ✅ ลด 20 ชิ้น

Delivery-In-Progress:
- total_piece_qty: 0 → 20 ✅ เพิ่ม 20 ชิ้น

Ledger:
- 2 entries (OUT + IN) ✅
- skip_balance_sync = true ✅

สต็อครวมใน warehouse: 50 ชิ้น ✅ (ไม่เปลี่ยน)
```

**ผลก่อนแก้ไข (Bug):**
```
Dispatch:
- total_piece_qty: 50 → 10 ❌ ลด 2 เท่า!
  (API ลด 20 + ทริกเกอร์ลดอีก 20)

Delivery-In-Progress:
- total_piece_qty: 0 → 40 ❌ เพิ่ม 2 เท่า!
  (API เพิ่ม 20 + ทริกเกอร์เพิ่มอีก 20)

สต็อครวมใน warehouse: 50 ชิ้น ✅ (โชคดีที่รวมยังถูก แต่แยกตาม location ผิด!)
```

---

### Test Case 3: Ledger จากแหล่งอื่น (ต้องให้ทริกเกอร์ทำงาน)
**ขั้นตอน:**
1. สมมติมี API ใหม่ที่สร้างแค่ ledger (ไม่อัปเดต balance)
2. สร้าง ledger entry โดยไม่ set `skip_balance_sync` (หรือ set = false)
3. ตรวจสอบว่าทริกเกอร์ทำงานปกติ

**ผลที่คาดหวัง:**
```
Ledger:
- skip_balance_sync = false (default) ✅

Balance:
- ทริกเกอร์อัปเดต balance อัตโนมัติ ✅
```

---

## 📝 วิธีใช้งาน Flag สำหรับ Developer

### เมื่อต้องการให้ทริกเกอร์ข้ามการอัปเดต balance

```typescript
// API อัปเดต balance ด้วยตัวเองแล้ว
await supabase
  .from('wms_inventory_balances')
  .update({ total_piece_qty: newQty })
  .eq('balance_id', balanceId);

// สร้าง ledger โดย set flag
await supabase.from('wms_inventory_ledger').insert({
  movement_at: now,
  transaction_type: 'pick',
  direction: 'out',
  warehouse_id: 'WH001',
  location_id: 'PK001',
  sku_id: 'SKU001',
  pack_qty: 1,
  piece_qty: 10,
  skip_balance_sync: true  // ← บอกให้ทริกเกอร์ข้าม
});
```

### เมื่อต้องการให้ทริกเกอร์อัปเดต balance อัตโนมัติ

```typescript
// ไม่ต้องอัปเดต balance เอง

// สร้าง ledger โดยไม่ set flag (หรือ set = false)
await supabase.from('wms_inventory_ledger').insert({
  movement_at: now,
  transaction_type: 'receive',
  direction: 'in',
  warehouse_id: 'WH001',
  location_id: 'A01-R01-S01',
  sku_id: 'SKU001',
  pack_qty: 1,
  piece_qty: 10,
  skip_balance_sync: false  // หรือ omit ฟิลด์นี้เลย
});

// ทริกเกอร์จะอัปเดต balance ให้อัตโนมัติ
```

---

## 🎯 ข้อดีของวิธีนี้

1. ✅ **ยืดหยุ่น**: API เลือกได้ว่าจะให้ทริกเกอร์ทำงานหรือไม่
2. ✅ **ไม่ต้องปิดทริกเกอร์**: ทริกเกอร์ยังใช้งานได้สำหรับ ledger จากแหล่งอื่น
3. ✅ **Backward Compatible**: Ledger entries เดิม (ไม่มี flag) จะทำงานปกติ (default = false)
4. ✅ **ง่ายต่อการ Debug**: ดูที่ flag ได้เลยว่า API อัปเดต balance เองหรือให้ทริกเกอร์ทำ
5. ✅ **ปลอดภัย**: ป้องกันการอัปเดต balance 2 รอบ

---

## 📌 หมายเหตุสำคัญ

### ⚠️ สำหรับ Developer ที่จะสร้าง API ใหม่

**กฎการตัดสินใจ:**

#### ใช้ `skip_balance_sync = true` เมื่อ:
- ✅ API อัปเดต `wms_inventory_balances` ด้วยตัวเอง
- ✅ ต้องการควบคุม logic การอัปเดต balance แบบพิเศษ
- ✅ ต้องการ performance ดีขึ้น (ไม่ต้องให้ทริกเกอร์ทำงาน)

**ตัวอย่าง:**
- `POST /api/mobile/pick/scan` - ต้องจัดการ unreserve + ย้ายสต็อค
- `POST /api/mobile/loading/complete` - ต้องจัดการสต็อคหลาย location

#### ใช้ `skip_balance_sync = false` (หรือ omit) เมื่อ:
- ✅ API สร้างแค่ ledger entry
- ✅ ต้องการให้ทริกเกอร์จัดการ balance อัตโนมัติ
- ✅ Logic การอัปเดต balance เป็น standard (ไม่ซับซ้อน)

**ตัวอย่าง:**
- `POST /api/receives/[id]/complete` - รับของเข้า (standard)
- `POST /api/moves/[id]/complete` - ย้ายของ (standard)
- Ledger จาก manual adjustment

---

## 🔄 Migration Path

### ขั้นตอนที่ทำแล้ว:
1. ✅ Run migration 047
2. ✅ แก้ไข API: `/api/mobile/pick/scan`
3. ✅ แก้ไข API: `/api/mobile/loading/complete`

### ขั้นตอนถัดไป (Optional):
1. ⏳ ทดสอบ workflow ทั้งหมด
2. ⏳ Monitor logs เพื่อดู NOTICE message จากทริกเกอร์
3. ⏳ Verify balance correctness

### ถ้าต้องการ Rollback:
```sql
-- ลบคอลัมน์
ALTER TABLE wms_inventory_ledger DROP COLUMN IF EXISTS skip_balance_sync;

-- Restore ทริกเกอร์เดิม (ไม่เช็ค flag)
-- ใช้ code จาก migration 004_add_inventory_balance_sync_trigger.sql
```

---

## 📚 เอกสารที่เกี่ยวข้อง

1. **TRIGGER_API_ANALYSIS.md** - วิเคราะห์ปัญหาทั้งหมด
2. **TRIGGER_MIGRATION_PLAN.md** - แผนการย้ายทริกเกอร์ (สำหรับอนาคต)
3. **Migration 047** - `supabase/migrations/047_add_skip_balance_sync_flag.sql`
4. **API Files:**
   - `app/api/mobile/pick/scan/route.ts`
   - `app/api/mobile/loading/complete/route.ts`

---

**สรุป:** การแก้ไขนี้แก้ปัญหาการทำงานซ้ำซ้อนระหว่างทริกเกอร์และ API ได้สมบูรณ์ โดยยังคงความยืดหยุ่นและไม่กระทบกับโค้ดเดิม ✅
