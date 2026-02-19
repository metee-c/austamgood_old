# Split Balance on Reservation - Implementation Guide

## สถานะ: Migration 302 Applied ✅

Migration 302 ได้ถูก apply สำเร็จแล้ว ระบบพร้อมใช้งาน

## ภาพรวม

ระบบ Split Balance on Reservation เป็นการปรับปรุงวิธีการจองสต็อกให้มีความแม่นยำและ audit trail ที่ชัดเจนขึ้น โดย:

1. **Split Balance**: แยกยอดที่จองออกเป็นแถวใหม่ใน `wms_inventory_balances`
2. **Ledger Tracking**: บันทึกทุกการเคลื่อนไหวใน `wms_inventory_ledger` (OUT/IN)
3. **Status Tracking**: ติดตามสถานะตั้งแต่ reserved → picked → staged → loaded → released
4. **Document Locking**: ล็อคยอดที่จองด้วยข้อมูลเอกสาร (document_type, document_id, document_code)

## Database Schema Changes (Migration 302)

### คอลัมน์ใหม่ใน `wms_inventory_balances`

```sql
-- ข้อมูลการจอง
reserved_by_user_id INTEGER              -- ผู้จอง
reserved_for_document_type VARCHAR(50)   -- ประเภทเอกสาร: 'picklist', 'face_sheet', 'bonus_face_sheet'
reserved_for_document_id INTEGER         -- ID ของเอกสาร
reserved_for_document_code VARCHAR(100)  -- รหัสเอกสาร (PL-YYYYMMDD-XXX)
reserved_at TIMESTAMPTZ                  -- เวลาที่จอง
reservation_status reservation_status_enum -- สถานะการจอง
is_reserved_split BOOLEAN                -- แถวนี้ถูก split มาจากการจอง
```

### ENUM Type: `reservation_status_enum`

```sql
CREATE TYPE reservation_status_enum AS ENUM (
  'available',   -- พร้อมใช้งาน (ยังไม่ถูกจอง)
  'reserved',    -- จองแล้ว (สร้าง picklist/face sheet แล้ว)
  'picked',      -- หยิบแล้ว (ยืนยันการหยิบแล้ว)
  'staged',      -- ย้ายไปพื้นที่รอขึ้นรถแล้ว
  'loaded',      -- ขึ้นรถแล้ว
  'released'     -- ปลดล็อคแล้ว (ยกเลิกเอกสาร)
);
```

## Functions

### 1. `split_balance_on_reservation()`

**จุดประสงค์**: Split balance และจองสต็อกพร้อมบันทึก ledger

**Parameters**:
```sql
p_source_balance_id INTEGER,           -- Balance ID ต้นทาง
p_piece_qty_to_reserve INTEGER,        -- จำนวนชิ้นที่จะจอง
p_pack_qty_to_reserve NUMERIC,         -- จำนวนแพ็คที่จะจอง
p_reserved_by_user_id INTEGER,         -- ผู้จอง
p_document_type VARCHAR(50),           -- ประเภทเอกสาร
p_document_id INTEGER,                 -- ID เอกสาร
p_document_code VARCHAR(100),          -- รหัสเอกสาร
p_picklist_item_id INTEGER DEFAULT NULL -- Picklist item ID (optional)
```

**Returns**:
```sql
TABLE(
  new_balance_id INTEGER,    -- Balance ID ใหม่ที่ถูก split
  ledger_out_id INTEGER,     -- Ledger ID (OUT)
  ledger_in_id INTEGER       -- Ledger ID (IN)
)
```

**ขั้นตอนการทำงาน**:
1. Lock balance ต้นทาง (FOR UPDATE)
2. ตรวจสอบยอดพอจอง
3. สร้าง balance ใหม่สำหรับยอดที่จอง (is_reserved_split = TRUE)
4. ลดยอดจาก balance เดิม
5. บันทึก ledger OUT (จาก balance เดิม)
6. บันทึก ledger IN (ไปยัง balance ใหม่)
7. สร้าง reservation record (ถ้ามี picklist_item_id)

### 2. `release_reservation_split_balance()`

**จุดประสงค์**: ปลดล็อคการจอง คืนยอดกลับไปยัง balance เดิม

**Parameters**:
```sql
p_reserved_balance_id INTEGER,    -- Balance ID ที่จอง
p_released_by_user_id INTEGER,    -- ผู้ปลดล็อค
p_reason TEXT DEFAULT NULL        -- เหตุผล
```

**Returns**:
```sql
TABLE(
  merged_to_balance_id INTEGER,  -- Balance ID ที่ merge กลับ
  ledger_out_id INTEGER,         -- Ledger ID (OUT)
  ledger_in_id INTEGER           -- Ledger ID (IN)
)
```

**ขั้นตอนการทำงาน**:
1. Lock reserved balance (FOR UPDATE)
2. หา balance เดิมที่มี pallet_id, location, sku เดียวกัน
3. บันทึก ledger OUT (จาก reserved balance)
4. ถ้าเจอ balance เดิม:
   - Merge ยอดกลับ
   - บันทึก ledger IN
   - ลบ reserved balance
5. ถ้าไม่เจอ balance เดิม:
   - แปลง reserved balance เป็น available

### 3. View: `v_reserved_balances`

**จุดประสงค์**: ดูยอดจองทั้งหมดที่ถูก split ออกมา

```sql
SELECT * FROM v_reserved_balances
WHERE reserved_for_document_code = 'PL-20260219-001';
```

## API Implementation Guide

### 1. `app/api/picklists/create-from-trip/route.ts`

**ตำแหน่งที่ต้องแก้**: บริเวณ Step 11 (Stock Reservation) ประมาณบรรทัด 700-800

**เปลี่ยนจาก**:
```typescript
// ❌ OLD: อัพเดต reserved_piece_qty โดยตรง
await supabase
  .from('wms_inventory_balances')
  .update({
    reserved_pack_qty: (balance.reserved_pack_qty || 0) + packToReserve,
    reserved_piece_qty: (balance.reserved_piece_qty || 0) + qtyToReserve,
    updated_at: new Date().toISOString()
  })
  .eq('balance_id', balance.balance_id);
```

**เป็น**:
```typescript
// ✅ NEW: เรียกใช้ split_balance_on_reservation()
const { data: splitResult, error: splitError } = await supabase
  .rpc('split_balance_on_reservation', {
    p_source_balance_id: balance.balance_id,
    p_piece_qty_to_reserve: qtyToReserve,
    p_pack_qty_to_reserve: packToReserve,
    p_reserved_by_user_id: user?.id,
    p_document_type: 'picklist',
    p_document_id: picklist.id,
    p_document_code: picklistCode,
    p_picklist_item_id: picklistItem.id
  });

if (splitError) {
  console.error('❌ Error splitting balance:', splitError);
  throw new Error(`Failed to reserve stock: ${splitError.message}`);
}

console.log(`✅ Split balance ${balance.balance_id} → ${splitResult[0].new_balance_id}`);
```

**หมายเหตุ**:
- ลบโค้ดที่อัพเดต `reserved_piece_qty` และ `reserved_pack_qty` ออก
- ลบโค้ดที่ INSERT ลงตาราง `picklist_item_reservations` ออก (function จัดการให้แล้ว)
- เก็บ Virtual Pallet logic ไว้ แต่ integrate กับ function ใหม่

### 2. `app/api/picklists/[id]/items/confirm/route.ts`

**ตำแหน่งที่ต้องแก้**: หลังจากยืนยันการหยิบ (confirm pick)

**เพิ่มโค้ด**:
```typescript
// ✅ อัพเดต reservation_status เป็น 'picked'
const { data: reservedBalances } = await supabase
  .from('wms_inventory_balances')
  .select('balance_id')
  .eq('is_reserved_split', true)
  .eq('reserved_for_document_type', 'picklist')
  .eq('reserved_for_document_id', id);

if (reservedBalances && reservedBalances.length > 0) {
  const balanceIds = reservedBalances.map(b => b.balance_id);
  
  const { error: updateError } = await supabase
    .from('wms_inventory_balances')
    .update({ reservation_status: 'picked' })
    .in('balance_id', balanceIds);

  if (updateError) {
    console.error('❌ Error updating reservation status:', updateError);
  } else {
    console.log(`✅ Updated ${balanceIds.length} balances to 'picked' status`);
  }
}
```

### 3. `app/api/picklists/[id]/delete/route.ts`

**ตำแหน่งที่ต้องแก้**: บริเวณการปลดล็อคยอดจอง ประมาณบรรทัด 40-70

**เปลี่ยนจาก**:
```typescript
// ❌ OLD: ลด reserved_piece_qty โดยตรง
const { error: updateError } = await supabase
  .from('wms_inventory_balances')
  .update({
    reserved_piece_qty: Math.max(0, (currentBalance.reserved_piece_qty || 0) - qty),
    reserved_pack_qty: Math.max(0, (currentBalance.reserved_pack_qty || 0) - pack),
    updated_at: new Date().toISOString()
  })
  .eq('balance_id', reservation.balance_id);
```

**เป็น**:
```typescript
// ✅ NEW: เรียกใช้ release_reservation_split_balance()
const { data: reservedBalances } = await supabase
  .from('wms_inventory_balances')
  .select('balance_id')
  .eq('is_reserved_split', true)
  .eq('reserved_for_document_type', 'picklist')
  .eq('reserved_for_document_id', id);

if (reservedBalances && reservedBalances.length > 0) {
  for (const balance of reservedBalances) {
    const { data: releaseResult, error: releaseError } = await supabase
      .rpc('release_reservation_split_balance', {
        p_reserved_balance_id: balance.balance_id,
        p_released_by_user_id: userEmail === 'metee.c@buzzpetsfood.com' ? user?.id : null,
        p_reason: 'ลบ Picklist'
      });

    if (releaseError) {
      console.error(`❌ Error releasing balance ${balance.balance_id}:`, releaseError);
    } else {
      console.log(`✅ Released balance ${balance.balance_id} → ${releaseResult[0].merged_to_balance_id}`);
    }
  }
}
```

**หมายเหตุ**:
- ลบโค้ดที่อัพเดต `reserved_piece_qty` และ `reserved_pack_qty` ออก
- ลบโค้ดที่ DELETE จากตาราง `picklist_item_reservations` ออก (function จัดการให้แล้ว)

### 4. `app/api/mobile/loading/complete/route.ts`

**ตำแหน่งที่ต้องแก้**: หลังจากโหลดสินค้าเสร็จ

**เพิ่มโค้ด**:
```typescript
// ✅ อัพเดต reservation_status เป็น 'loaded'
const { data: reservedBalances } = await supabase
  .from('wms_inventory_balances')
  .select('balance_id')
  .eq('is_reserved_split', true)
  .in('reserved_for_document_id', picklistIds)
  .eq('reserved_for_document_type', 'picklist');

if (reservedBalances && reservedBalances.length > 0) {
  const balanceIds = reservedBalances.map(b => b.balance_id);
  
  const { error: updateError } = await supabase
    .from('wms_inventory_balances')
    .update({ reservation_status: 'loaded' })
    .in('balance_id', balanceIds);

  if (updateError) {
    console.error('❌ Error updating reservation status to loaded:', updateError);
  } else {
    console.log(`✅ Updated ${balanceIds.length} balances to 'loaded' status`);
  }
}
```

## Status Flow

```
available → reserved → picked → staged → loaded → released
   ↑                                                  ↓
   └──────────────────────────────────────────────────┘
              (ยกเลิกเอกสาร / ปลดล็อค)
```

## Testing Checklist

### 1. สร้าง Picklist
- [ ] ตรวจสอบว่า balance ถูก split ออกมา (is_reserved_split = TRUE)
- [ ] ตรวจสอบ ledger entries (OUT + IN)
- [ ] ตรวจสอบ reservation_status = 'reserved'
- [ ] ตรวจสอบ reserved_for_document_code ถูกต้อง

### 2. ยืนยันการหยิบ (Confirm Pick)
- [ ] ตรวจสอบ reservation_status เปลี่ยนเป็น 'picked'

### 3. โหลดสินค้า (Loading Complete)
- [ ] ตรวจสอบ reservation_status เปลี่ยนเป็น 'loaded'

### 4. ลบ Picklist
- [ ] ตรวจสอบ balance ถูก merge กลับ
- [ ] ตรวจสอบ ledger entries (OUT + IN)
- [ ] ตรวจสอบ reserved balance ถูกลบ

### 5. Query Performance
- [ ] ทดสอบ query v_reserved_balances
- [ ] ทดสอบ index performance

## SQL Queries สำหรับ Debug

### ดูยอดจองทั้งหมด
```sql
SELECT * FROM v_reserved_balances
ORDER BY reserved_at DESC;
```

### ดูยอดจองของ Picklist
```sql
SELECT * FROM wms_inventory_balances
WHERE is_reserved_split = TRUE
  AND reserved_for_document_code = 'PL-20260219-001';
```

### ดู Ledger Entries
```sql
SELECT * FROM wms_inventory_ledger
WHERE transaction_type IN ('reserve', 'release_reserve')
  AND reference_no = 'PL-20260219-001'
ORDER BY movement_at DESC;
```

### ตรวจสอบ Balance Integrity
```sql
-- ตรวจสอบว่ายอดรวมถูกต้อง
SELECT 
  sku_id,
  location_id,
  SUM(total_piece_qty) as total_qty,
  SUM(CASE WHEN is_reserved_split THEN total_piece_qty ELSE 0 END) as reserved_qty
FROM wms_inventory_balances
WHERE sku_id = 'YOUR_SKU_ID'
  AND location_id = 'YOUR_LOCATION_ID'
GROUP BY sku_id, location_id;
```

## ข้อควรระวัง

1. **Transaction Safety**: ทุก API ควรใช้ transaction เพื่อป้องกัน partial update
2. **Concurrent Access**: Function ใช้ FOR UPDATE เพื่อ lock row ป้องกัน race condition
3. **Virtual Pallet**: ต้องจัดการ Virtual Pallet แยกต่างหาก (ไม่ split)
4. **Performance**: ใช้ index ที่สร้างไว้ใน migration 302

## สรุป

ระบบ Split Balance on Reservation พร้อมใช้งานแล้ว โดยมี:
- ✅ Database schema และ functions พร้อม (Migration 302 applied)
- ⏳ API routes ต้องอัพเดต (3 ไฟล์หลัก)
- ✅ Ledger tracking ครบถ้วน
- ✅ Status flow ชัดเจน
- ✅ View สำหรับ monitoring

ทีมพัฒนาสามารถเริ่มอัพเดต API ตามแนวทางที่ระบุไว้ข้างต้นได้เลย
