# การวิเคราะห์ทริกเกอร์และ API - ระบบ WMS

**วันที่:** 2025-11-29
**สถานะ:** ทริกเกอร์และ API ทำงานควบคู่กัน - **ต้องระวังการทำงานซ้ำซ้อน**

---

## สรุปภาพรวม

ระบบปัจจุบันมีทั้ง **Database Triggers** และ **API Logic** ทำงานร่วมกันในหลายจุด ซึ่งอาจทำให้เกิด:
- ✅ **ข้อดี**: มี redundancy สำหรับการอัปเดตสถานะ
- ⚠️ **ข้อเสีย**: ทำงานซ้ำซ้อน, ยากต่อการ debug, ลำดับการทำงานไม่ชัดเจน

---

## Part 1: Workflow Status Management

### ทริกเกอร์ที่มีอยู่ (จาก migration 027 และ 044)

#### ทริกเกอร์ 1: Route Publish → Orders Confirmed
```sql
-- Trigger: trigger_route_publish_update_orders
-- Table: receiving_route_plans (AFTER UPDATE)
-- Function: update_orders_on_route_publish()

เมื่อ: receiving_route_plans.status → 'published'
ทำ: อัปเดต wms_orders.status จาก 'draft' → 'confirmed'
```

**API ที่เกี่ยวข้อง:**
- ❌ **ไม่มี** - ไม่มี API สำหรับ publish route plan
- การ publish ทำผ่าน UI โดยตรง → ทริกเกอร์ทำงาน

**ผลกระทบ:** ✅ ไม่มีการทำงานซ้ำซ้อน

---

#### ทริกเกอร์ 2: Picklist Created → Orders In_Picking
```sql
-- Trigger: trigger_picklist_create_update_orders
-- Table: picklists (AFTER INSERT)
-- Function: update_orders_on_picklist_create()

เมื่อ: INSERT ลงตาราง picklists
ทำ: อัปเดต wms_orders.status จาก 'confirmed' → 'in_picking'
```

**API ที่เกี่ยวข้อง:**
- `POST /api/picklists/create-from-trip` ✅ สร้าง picklist แต่ **ไม่อัปเดตสถานะ orders**

**ลำดับการทำงาน:**
```
1. API: INSERT picklist + picklist_items
2. ทริกเกอร์ (AFTER INSERT): UPDATE orders → 'in_picking'
```

**ผลกระทบ:** ✅ ไม่มีการทำงานซ้ำซ้อน (API ไม่ได้อัปเดตสถานะ orders)

---

#### ทริกเกอร์ 3: Picklist Completed → Orders Picked + Route Ready_to_Load
```sql
-- Trigger: trigger_picklist_complete_update_orders_and_route
-- Table: picklists (AFTER UPDATE)
-- Function: update_orders_and_route_on_picklist_complete()

เมื่อ: picklists.status → 'completed'
ทำ:
  1. อัปเดต wms_orders.status จาก 'in_picking' → 'picked'
  2. ถ้า picklists ทั้งหมดใน plan เสร็จ → route.status → 'ready_to_load'
```

**API ที่เกี่ยวข้อง:**
- `POST /api/mobile/pick/scan` ✅ หยิบสินค้า และเมื่อหยิบครบ → อัปเดต picklist.status = 'completed'

**ลำดับการทำงาน:**
```
1. API: อัปเดต picklist_items.status = 'picked'
2. API: เช็คว่าหยิบครบหรือยัง
3. API: ถ้าครบ → UPDATE picklists.status = 'completed'
4. ทริกเกอร์ (AFTER UPDATE): UPDATE orders + route plan
```

**ผลกระทบ:** ✅ ไม่มีการทำงานซ้ำซ้อน (แบ่งหน้าที่ชัดเจน)
- API: จัดการ picklist items และ picklist status
- ทริกเกอร์: จัดการ orders และ route status

---

#### ทริกเกอร์ 4: Loadlist Complete → Orders Loaded + Route In_Transit
```sql
-- Trigger: trigger_loadlist_complete_update_orders
-- Table: loadlists (AFTER UPDATE)
-- Function: update_orders_on_loadlist_complete()

เมื่อ: loadlists.status → 'loaded'
ทำ:
  1. อัปเดต wms_orders.status จาก 'picked' → 'loaded'
  2. อัปเดต route.status จาก 'ready_to_load' → 'in_transit'
```

**API ที่เกี่ยวข้อง:**
- `POST /api/mobile/loading/complete` ✅ ทำการ loading และ **อัปเดต loadlist.status = 'loaded'**

**ลำดับการทำงาน:**
```
1. API: ตรวจสอบสต็อค
2. API: ย้ายสต็อค Dispatch → Delivery-In-Progress
3. API: สร้าง ledger entries
4. API: UPDATE loadlists.status = 'loaded' (บรรทัด 68-75)
5. ทริกเกอร์ (AFTER UPDATE): UPDATE orders → 'loaded' + route → 'in_transit'
```

**ผลกระทบ:** ✅ ไม่มีการทำงานซ้ำซ้อน
- API: จัดการการย้ายสต็อค
- ทริกเกอร์: จัดการสถานะ orders และ route

---

#### ทริกเกอร์ 5: Order Delivered → Route Completed
```sql
-- Trigger: trigger_delivery_update_route
-- Table: wms_orders (AFTER UPDATE)
-- Function: update_route_on_delivery()

เมื่อ: wms_orders.status → 'delivered'
ทำ:
  - ถ้า orders ทั้งหมดใน route ส่งถึงแล้ว → route.status → 'completed'
```

**API ที่เกี่ยวข้อง:**
- ❌ **ไม่มี** - ไม่มี API สำหรับอัปเดต order เป็น delivered
- การอัปเดตสถานะทำผ่าน UI หรือระบบอื่น

**ผลกระทบ:** ✅ ไม่มีการทำงานซ้ำซ้อน

---

## Part 2: Inventory Ledger Creation

### ทริกเกอร์ที่มีอยู่ (จาก migration 007, 015)

#### ทริกเกอร์ 6-8: Receive Ledger Triggers
```sql
-- Trigger 1: trg_create_ledger_from_receive_insert
-- Table: wms_receive_items (AFTER INSERT)

-- Trigger 2: trg_update_ledger_from_receive
-- Table: wms_receive_items (AFTER UPDATE)

-- Trigger 3: trg_update_ledger_from_receive_status
-- Table: wms_receives (AFTER UPDATE)

เมื่อ: wms_receive_items INSERT/UPDATE หรือ wms_receives.status → 'รับเข้าแล้ว'
ทำ: สร้าง ledger entry (direction = 'in')
```

**API ที่เกี่ยวข้อง:**
- ❌ **ไม่มี** - ไม่มี API สำหรับ complete receive
- ทริกเกอร์ทำงานเมื่อมีการรับของ

**ผลกระทบ:** ✅ ไม่มีการทำงานซ้ำซ้อน

---

#### ทริกเกอร์ 9-10: Move Ledger Triggers
```sql
-- Trigger 1: trg_create_ledger_from_move_insert
-- Table: wms_move_items (AFTER INSERT)

-- Trigger 2: trg_update_ledger_from_move
-- Table: wms_move_items (AFTER UPDATE)

เมื่อ: wms_move_items.status → 'completed'
ทำ: สร้าง ledger entries 2 รายการ (OUT + IN)
```

**API ที่เกี่ยวข้อง:**
- ❌ **ไม่มี** - ไม่มี API สำหรับ complete transfer
- ทริกเกอร์ทำงานเมื่อมีการย้ายของ

**ผลกระทบ:** ✅ ไม่มีการทำงานซ้ำซ้อน

---

#### ทริกเกอร์ 11: Balance Sync Trigger
```sql
-- Trigger: trg_sync_inventory_ledger_to_balance
-- Table: wms_inventory_ledger (AFTER INSERT)
-- Function: sync_inventory_ledger_to_balance()

เมื่อ: INSERT ลง wms_inventory_ledger
ทำ: อัปเดต wms_inventory_balances อัตโนมัติ
```

**API ที่เกี่ยวข้อง:**
- `POST /api/mobile/pick/scan` ✅ สร้าง ledger entries แล้ว **อัปเดต balance ด้วยตัวเอง**
- `POST /api/mobile/loading/complete` ✅ สร้าง ledger entries แล้ว **อัปเดต balance ด้วยตัวเอง**

**⚠️ การทำงานซ้ำซ้อน:**

### API: /mobile/pick/scan
```typescript
// บรรทัด 162-179: อัปเดต balance ด้วยตัวเอง
await supabase
  .from('wms_inventory_balances')
  .update({
    reserved_piece_qty: ...,
    total_piece_qty: ...,  // ลดสต็อค
  })
  .eq('balance_id', balance.balance_id);

// บรรทัด 222-230: อัปเดต Dispatch balance
await supabase
  .from('wms_inventory_balances')
  .update({
    total_piece_qty: ...,  // เพิ่มสต็อค
  })
  .eq('balance_id', dispatchBalance.balance_id);

// บรรทัด 264-266: สร้าง ledger entries
await supabase
  .from('wms_inventory_ledger')
  .insert(ledgerEntries);  // ← ทริกเกอร์จะทำงานที่นี่!
```

**ปัญหา:**
1. API อัปเดต balance แล้ว (ลดจาก source + เพิ่มที่ Dispatch)
2. API สร้าง ledger entries
3. ทริกเกอร์ (AFTER INSERT ledger) → **อัปเดต balance อีกรอบ!**

**ผลกระทบ:** ⚠️ **มีการทำงานซ้ำซ้อน** - Balance อาจถูกอัปเดต 2 รอบ

---

### API: /mobile/loading/complete
```typescript
// บรรทัด 209-216: อัปเดต Dispatch balance (ลด)
await supabase
  .from('wms_inventory_balances')
  .update({
    total_pack_qty: newPack,
    total_piece_qty: newPiece  // ลดสต็อค
  })
  .eq('balance_id', dispatchBalance.balance_id);

// บรรทัด 255-262: อัปเดต Delivery balance (เพิ่ม)
await supabase
  .from('wms_inventory_balances')
  .update({
    total_pack_qty: newPack,
    total_piece_qty: newPiece  // เพิ่มสต็อค
  })
  .eq('balance_id', deliveryBalance.balance_id);

// บรรทัด 284-286: สร้าง ledger entries
await supabase
  .from('wms_inventory_ledger')
  .insert(ledgerEntries);  // ← ทริกเกอร์จะทำงานที่นี่!
```

**ปัญหาเดียวกัน:**
1. API อัปเดต balance แล้ว
2. API สร้าง ledger entries
3. ทริกเกอร์ → **อัปเดต balance อีกรอบ!**

**ผลกระทบ:** ⚠️ **มีการทำงานซ้ำซ้อน** - Balance อาจถูกอัปเดต 2 รอบ

---

## Part 3: Stock Reservation (จาก picklists/[id]/route.ts)

### การทำงานใน API
```typescript
// เมื่อ picklist.status → 'assigned'
if (body.status === 'assigned') {
  // จองสต็อคสำหรับทุก item
  for (const item of picklistItems) {
    // อัปเดต reserved_pack_qty และ reserved_piece_qty
    await supabase
      .from('wms_inventory_balances')
      .update({
        reserved_pack_qty: (balance.reserved_pack_qty || 0) + packToReserve,
        reserved_piece_qty: (balance.reserved_piece_qty || 0) + qtyToReserve,
      })
      .eq('balance_id', balance.balance_id);
  }
}
```

**ทริกเกอร์ที่เกี่ยวข้อง:**
- ❌ **ไม่มี** - ไม่มีทริกเกอร์สำหรับการจองสต็อค

**ผลกระทบ:** ✅ ไม่มีการทำงานซ้ำซ้อน

---

## สรุปปัญหาที่พบ

### 🔴 ปัญหาร้ายแรง: Balance Sync Trigger ทำงานซ้ำซ้อน

**ทริกเกอร์:** `trg_sync_inventory_ledger_to_balance`
**ตาราง:** `wms_inventory_ledger` (AFTER INSERT)

**ที่เกิดปัญหา:**
1. ✅ `POST /api/mobile/pick/scan` - API อัปเดต balance เอง + สร้าง ledger
2. ✅ `POST /api/mobile/loading/complete` - API อัปเดต balance เอง + สร้าง ledger

**สาเหตุ:**
- API ทำงานครบถ้วนแล้ว (อัปเดต balance + สร้าง ledger)
- แต่เมื่อสร้าง ledger → ทริกเกอร์ทำงาน → อัปเดต balance อีกรอบ

**ผลกระทบ:**
- สต็อคอาจเพิ่ม/ลด 2 เท่า
- ข้อมูล balance ไม่ถูกต้อง

---

## แนวทางแก้ไข

### วิธีที่ 1: ปิดทริกเกอร์ Balance Sync (แนะนำ)

เนื่องจาก API ทำงานครบถ้วนแล้ว (อัปเดต balance เอง) ควร:

```sql
-- ปิดทริกเกอร์ชั่วคราว
DROP TRIGGER IF EXISTS trg_sync_inventory_ledger_to_balance ON wms_inventory_ledger;
```

**ข้อดี:**
- ✅ ไม่มีการทำงานซ้ำซ้อน
- ✅ API ควบคุมทุกอย่าง ง่ายต่อการ debug

**ข้อเสีย:**
- ⚠️ ต้องให้ API ทุกตัวอัปเดต balance เอง
- ⚠️ ถ้ามีการสร้าง ledger จากที่อื่น จะไม่อัปเดต balance

---

### วิธีที่ 2: แก้ไข API ให้ไม่อัปเดต Balance

ให้ API สร้างแค่ ledger entries แล้วปล่อยให้ทริกเกอร์จัดการ balance:

```typescript
// ❌ ลบการอัปเดต balance ออก
// await supabase.from('wms_inventory_balances').update(...)

// ✅ สร้างแค่ ledger entries
await supabase.from('wms_inventory_ledger').insert(ledgerEntries);
// ← ทริกเกอร์จะอัปเดต balance ให้
```

**ข้อดี:**
- ✅ ทริกเกอร์ทำงานได้
- ✅ Centralized logic ที่ทริกเกอร์

**ข้อเสีย:**
- ⚠️ ต้องแก้ไข API 2 ตัว (pick/scan และ loading/complete)
- ⚠️ ไม่สามารถอัปเดต balance แบบพิเศษได้ (เช่น unreserve)

---

### วิธีที่ 3: เพิ่ม Flag เพื่อ Skip Trigger (แนะนำที่สุด)

แก้ไขทริกเกอร์ให้เช็ค flag ก่อนทำงาน:

```sql
-- แก้ไขทริกเกอร์
CREATE OR REPLACE FUNCTION sync_inventory_ledger_to_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- เช็คว่ามี flag skip_balance_sync หรือไม่
    IF NEW.skip_balance_sync = TRUE THEN
        RETURN NEW;  -- ไม่ทำอะไร
    END IF;

    -- ทำงานปกติ...
    -- ...

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

แล้วแก้ไข API:

```typescript
// เพิ่ม flag เมื่อสร้าง ledger
await supabase.from('wms_inventory_ledger').insert(
  ledgerEntries.map(entry => ({
    ...entry,
    skip_balance_sync: true  // ← บอกให้ทริกเกอร์ข้ามการอัปเดต balance
  }))
);
```

**ข้อดี:**
- ✅ ยืดหยุ่น - API เลือกได้ว่าจะให้ทริกเกอร์ทำหรือไม่
- ✅ ทริกเกอร์ยังทำงานได้สำหรับ ledger จากแหล่งอื่น
- ✅ ไม่ต้องปิดทริกเกอร์

**ข้อเสีย:**
- ⚠️ ต้องเพิ่มคอลัมน์ `skip_balance_sync` ใน `wms_inventory_ledger`
- ⚠️ ต้องแก้ไขทริกเกอร์และ API

---

## แนวทางที่แนะนำ

### ระยะสั้น (Quick Fix):
1. ✅ **ปิดทริกเกอร์ `trg_sync_inventory_ledger_to_balance` ชั่วคราว**
   ```sql
   DROP TRIGGER IF EXISTS trg_sync_inventory_ledger_to_balance ON wms_inventory_ledger;
   ```

2. ✅ **เพิ่ม comment ในโค้ด API** ให้ชัดเจนว่า API รับผิดชอบอัปเดต balance

3. ✅ **Monitor logs** เพื่อตรวจสอบว่า balance ถูกต้อง

### ระยะยาว (Long-term Solution):
1. ✅ **เพิ่มคอลัมน์ `skip_balance_sync`** ในตาราง `wms_inventory_ledger`
   ```sql
   ALTER TABLE wms_inventory_ledger
   ADD COLUMN skip_balance_sync BOOLEAN DEFAULT FALSE;
   ```

2. ✅ **แก้ไขทริกเกอร์** ให้เช็ค flag

3. ✅ **แก้ไข API** ให้ set flag = true

4. ✅ **สร้าง API สำหรับ reconcile balance** (กรณีข้อมูลผิดพลาด)
   ```typescript
   POST /api/inventory/reconcile-balance
   // Recalculate balance จาก ledger ใหม่ทั้งหมด
   ```

---

## การทดสอบที่ต้องทำ

### Test Case 1: Stock Reservation
```
1. สร้าง picklist จาก route plan
2. Assign picklist ให้กับ worker
3. ตรวจสอบ: reserved_pack_qty และ reserved_piece_qty ต้องเพิ่มขึ้น
4. ตรวจสอบ: total_pack_qty และ total_piece_qty ยังเหมือนเดิม
```

### Test Case 2: Pick Process
```
1. Worker สแกน picklist QR code
2. หยิบสินค้าจาก source_location
3. ตรวจสอบ:
   - reserved_piece_qty ลดลง (unreserve)
   - total_piece_qty ลดลง (ลดสต็อคจริง)
   - Dispatch balance เพิ่มขึ้น
   - Ledger มี 2 entries (OUT + IN)
4. ตรวจสอบ: สต็อครวมใน warehouse ยังเท่าเดิม
```

### Test Case 3: Loading Process
```
1. Worker สแกน loadlist QR code
2. Complete loading
3. ตรวจสอบ:
   - Dispatch balance ลดลง
   - Delivery-In-Progress balance เพิ่มขึ้น
   - Ledger มี 2 entries (OUT + IN)
   - loadlist.status = 'loaded'
4. ตรวจสอบ: ทริกเกอร์อัปเดต orders.status = 'loaded'
5. ตรวจสอบ: ทริกเกอร์อัปเดต route.status = 'in_transit'
```

### Test Case 4: Balance Sync (ตรวจสอบการทำงานซ้ำซ้อน)
```
1. บันทึกสต็อคเริ่มต้นที่ Dispatch
2. ทำ Pick process
3. ตรวจสอบ Dispatch balance:
   - Expected: เพิ่มตามจำนวนที่หยิบ
   - Bug: เพิ่ม 2 เท่า (ถ้าทริกเกอร์ทำงานซ้ำ)
4. ตรวจสอบ ledger entries:
   - ต้องมี 2 entries (OUT + IN) เท่านั้น
```

---

## สรุป

### ✅ ส่วนที่ทำงานถูกต้อง:
1. Workflow Status Triggers - แบ่งหน้าที่ชัดเจน ไม่ซ้ำซ้อนกับ API
2. Stock Reservation - API ทำงานได้ดี
3. Pick Process - API ทำงานครบถ้วน (แต่อาจมีปัญหา balance sync)
4. Loading Process - API ทำงานครบถ้วน (แต่อาจมีปัญหา balance sync)

### ⚠️ ส่วนที่มีปัญหา:
1. **Balance Sync Trigger** - ทำงานซ้ำซ้อนกับ API (ต้องแก้ไขด่วน!)

### 🔧 การแก้ไขที่ต้องทำ:
1. ✅ **ระยะสั้น**: ปิดทริกเกอร์ `trg_sync_inventory_ledger_to_balance`
2. ✅ **ระยะยาว**: เพิ่ม flag `skip_balance_sync` และแก้ไขทริกเกอร์

---

**หมายเหตุ:** เอกสารนี้จะต้องอัปเดตเมื่อมีการเปลี่ยนแปลง API หรือทริกเกอร์
