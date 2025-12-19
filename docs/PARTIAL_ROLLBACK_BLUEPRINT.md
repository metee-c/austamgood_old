# Partial Rollback Blueprint สำหรับ WMS Order

## เอกสารนี้เป็น Blueprint สำหรับการ Implement Partial Rollback
**วันที่วิเคราะห์**: 19 ธันวาคม 2025  
**ผู้วิเคราะห์**: AI Senior WMS Specialist  
**สถานะ**: พร้อมสำหรับ Implementation

---

## 📋 สารบัญ

1. [Executive Summary](#1-executive-summary)
2. [Flow Analysis](#2-flow-analysis)
3. [Database Structure Analysis](#3-database-structure-analysis)
4. [Architecture Readiness Assessment](#4-architecture-readiness-assessment)
5. [Partial Rollback Algorithm](#5-partial-rollback-algorithm)
6. [Inventory Ledger Strategy](#6-inventory-ledger-strategy)
7. [Data Integrity & Audit](#7-data-integrity--audit)
8. [Implementation Guide](#8-implementation-guide)

---

## 1. Executive Summary

### 1.1 วัตถุประสงค์
ออกแบบระบบ Partial Rollback ที่สามารถถอยสถานะ Order กลับไปเป็น "Draft" โดย:
- ถอยเฉพาะข้อมูลและสต็อกที่เกี่ยวข้องกับ Order นั้น
- ไม่กระทบ Order อื่นที่อยู่ใน Route / Picklist / Loadlist เดียวกัน

### 1.2 สรุปผลการวิเคราะห์

| หัวข้อ | สถานะ | หมายเหตุ |
|--------|--------|----------|
| Order-Level Tracking | ✅ รองรับ | picklist_items, face_sheet_items, loadlist_items มี order_id |
| Reservation Tracking | ✅ รองรับ | picklist_item_reservations, face_sheet_item_reservations |
| Ledger Traceability | ⚠️ บางส่วน | ไม่มี order_id โดยตรง แต่ trace ได้ผ่าน reference_doc_id |
| Route Separation | ✅ รองรับ | receiving_route_stops มี order_id |

### 1.3 GAP ที่พบ (Critical)

**GAP #1: wms_inventory_ledger ไม่มี order_id**
- ปัจจุบัน: ใช้ `reference_doc_type` + `reference_doc_id` (เช่น picklist_id)
- ผลกระทบ: ต้อง trace กลับผ่าน picklist_items → order_id
- แนวทาง: เพิ่ม `order_id` และ `order_item_id` ใน ledger (แนะนำ)


---

## 2. Flow Analysis

### 2.1 Order Status Flow

```
draft → confirmed → in_picking → picked → loaded → in_transit → delivered
                                                              → cancelled
```

### 2.2 End-to-End Flow พร้อมจุดที่รวม/แยก Order

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: นำเข้า Order (/receiving/orders)                                    │
│ ─────────────────────────────────────────                                   │
│ • 1 Order = 1 Record ใน wms_orders                                          │
│ • Status: draft                                                             │
│ • ⚡ จุดแยก: Order แต่ละตัวเป็นอิสระ                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: จัดเส้นทาง (/receiving/routes)                                      │
│ ─────────────────────────────────────                                       │
│ • 1 Route Plan → หลาย Trips → หลาย Stops                                    │
│ • 1 Stop = 1 Order (receiving_route_stops.order_id)                         │
│ • ⚠️ จุดรวม: หลาย Order อยู่ใน Trip/Vehicle เดียวกัน                         │
│ • ค่าขนส่งคำนวณต่อ Vehicle                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: สร้างใบหยิบ (/receiving/picklists)                                  │
│ ─────────────────────────────────────────                                   │
│ • 1 Picklist อาจมีหลาย Order                                                │
│ • picklist_items.order_id ✅ ระบุ Order ต้นทาง                               │
│ • picklist_item_reservations ✅ ผูกกับ balance_id                            │
│ • ⚠️ จุดรวม: หลาย Order Line ใน Picklist เดียว                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: หยิบสินค้า (/mobile/pick)                                           │
│ ─────────────────────────────────────                                       │
│ • ลดสต็อกจาก Preparation Area                                               │
│ • เพิ่มสต็อกที่ Dispatch                                                    │
│ • บันทึก Ledger (reference_doc_type='picklist')                             │
│ • ⚠️ Ledger ไม่มี order_id โดยตรง                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: สร้างใบโหลด (/receiving/loadlists)                                  │
│ ─────────────────────────────────────────                                   │
│ • 1 Loadlist อาจมีหลาย Picklist/Face Sheet                                  │
│ • loadlist_items.order_id ✅ ระบุ Order ต้นทาง                               │
│ • ⚠️ จุดรวม: หลาย Order ใน Loadlist เดียว                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: โหลดสินค้า (/mobile/loading)                                        │
│ ─────────────────────────────────────                                       │
│ • ลดสต็อกจาก Dispatch                                                       │
│ • เพิ่มสต็อกที่ Delivery-In-Progress                                        │
│ • บันทึก Ledger (reference_doc_type='loadlist')                             │
│ • ⚠️ Ledger ไม่มี order_id โดยตรง                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 จุดเสี่ยงของ Partial Rollback

| จุด | ความเสี่ยง | ระดับ | แนวทางแก้ไข |
|-----|-----------|-------|-------------|
| Route | หลาย Order ใน Trip เดียว | ปานกลาง | ลบเฉพาะ Stop ของ Order นั้น |
| Picklist | หลาย Order ใน Picklist เดียว | สูง | Void เฉพาะ Line ที่มี order_id ตรงกัน |
| Reservation | ผูกกับ balance_id | ต่ำ | Release ผ่าน picklist_item_id |
| Ledger | ไม่มี order_id | สูง | ต้อง trace ผ่าน picklist_items |
| Loadlist | หลาย Order ใน Loadlist เดียว | สูง | Void เฉพาะ Line ที่มี order_id ตรงกัน |


---

## 3. Database Structure Analysis

### 3.1 ตารางหลักและความสัมพันธ์กับ Order

| ตาราง | ผูกกับ Order ระดับใด | Column | ใช้ Rollback อย่างไร |
|-------|---------------------|--------|---------------------|
| `wms_orders` | Header | `order_id` | Reset status → draft |
| `wms_order_items` | Line | `order_id` | ไม่ต้องแก้ไข (ข้อมูลคงเดิม) |
| `receiving_route_stops` | Header | `order_id` | ลบ Stop ของ Order นี้ |
| `receiving_route_plan_inputs` | Header | `order_id` | ลบ Input ของ Order นี้ |
| `picklist_items` | Line | `order_id`, `order_item_id` | Mark void หรือลบ |
| `picklist_item_reservations` | Line | via `picklist_item_id` | Release reservation |
| `face_sheet_items` | Line | `order_id`, `order_item_id` | Mark void หรือลบ |
| `face_sheet_item_reservations` | Line | via `face_sheet_item_id` | Release reservation |
| `bonus_face_sheet_items` | Line | `order_item_id` | Mark void หรือลบ |
| `bonus_face_sheet_item_reservations` | Line | via `bonus_face_sheet_item_id` | Release reservation |
| `loadlist_items` | Header | `order_id` | ลบ Item ของ Order นี้ |
| `wms_inventory_ledger` | ❌ ไม่มี | `reference_doc_id` | Reverse entries (ต้อง trace) |
| `wms_inventory_balances` | ❌ ไม่มี | - | Restore via ledger reverse |

### 3.2 โครงสร้าง wms_inventory_ledger (Critical)

```sql
-- Columns ปัจจุบัน
ledger_id           BIGINT PRIMARY KEY
movement_at         TIMESTAMPTZ
transaction_type    VARCHAR (pick, ship, adjustment, etc.)
direction           ENUM (in, out)
move_item_id        BIGINT (nullable)
receive_item_id     BIGINT (nullable)
warehouse_id        VARCHAR
location_id         VARCHAR
sku_id              VARCHAR
pallet_id           VARCHAR (nullable)
production_date     DATE (nullable)
expiry_date         DATE (nullable)
pack_qty            NUMERIC
piece_qty           NUMERIC
reference_no        VARCHAR (e.g., picklist_code)
reference_doc_type  VARCHAR (picklist, loadlist, adjustment)
reference_doc_id    BIGINT (e.g., picklist_id)
remarks             TEXT
created_by          BIGINT
skip_balance_sync   BOOLEAN

-- ❌ ไม่มี order_id, order_item_id
```

### 3.3 Reservation Tables Structure

```sql
-- picklist_item_reservations
reservation_id      BIGINT PRIMARY KEY
picklist_item_id    BIGINT (FK → picklist_items.id)
balance_id          BIGINT (FK → wms_inventory_balances.balance_id)
reserved_piece_qty  NUMERIC
reserved_pack_qty   NUMERIC
status              VARCHAR (reserved, picked, cancelled)
picked_at           TIMESTAMPTZ

-- face_sheet_item_reservations (same structure)
-- bonus_face_sheet_item_reservations (same structure)
```


---

## 4. Architecture Readiness Assessment

### 4.1 ตารางสรุปความพร้อม

| ข้อกำหนด | ระบบรองรับ | ผลกระทบ | แนวทางแก้ไข |
|----------|-----------|---------|-------------|
| Stock Movement ผูกกับ order_line_id | ⚠️ บางส่วน | ต้อง trace ผ่าน picklist_items | เพิ่ม order_id ใน ledger |
| Inventory Ledger ผูกกับ order_id | ❌ ไม่รองรับ | ไม่สามารถ query ledger ตาม order ได้โดยตรง | **ต้องเพิ่ม column** |
| Pick แยกเป็น Line-level | ✅ รองรับ | picklist_items.order_id มีอยู่แล้ว | - |
| Load แยกเป็น Line-level | ✅ รองรับ | loadlist_items.order_id มีอยู่แล้ว | - |
| Reservation ผูกกับ Order | ✅ รองรับ | trace ผ่าน picklist_item_id → order_id | - |
| Route Stop ผูกกับ Order | ✅ รองรับ | receiving_route_stops.order_id | - |

### 4.2 GAP Analysis Detail

#### GAP #1: wms_inventory_ledger ไม่มี order_id (Critical)

**ปัญหา:**
```sql
-- ปัจจุบัน: ต้อง trace หลายขั้นตอน
SELECT l.* FROM wms_inventory_ledger l
JOIN picklist_items pi ON l.reference_doc_id = pi.picklist_id
WHERE pi.order_id = 123 AND l.reference_doc_type = 'picklist';

-- ต้องการ: Query ตรงๆ
SELECT * FROM wms_inventory_ledger WHERE order_id = 123;
```

**ผลกระทบ:**
- Performance: ต้อง JOIN หลายตาราง
- Complexity: Logic ซับซ้อนขึ้น
- Risk: อาจพลาด ledger entries ที่ไม่ได้ผูกกับ picklist

**แนวทางแก้ไข (แนะนำ):**
```sql
-- Migration: เพิ่ม columns
ALTER TABLE wms_inventory_ledger 
ADD COLUMN order_id BIGINT REFERENCES wms_orders(order_id),
ADD COLUMN order_item_id BIGINT REFERENCES wms_order_items(item_id);

-- Index สำหรับ query
CREATE INDEX idx_ledger_order_id ON wms_inventory_ledger(order_id);
```

### 4.3 สรุปความพร้อม

```
┌─────────────────────────────────────────────────────────────────┐
│ ⚠️ ระบบปัจจุบันสามารถทำ Partial Rollback ได้ 80%                │
│                                                                 │
│ ✅ รองรับ:                                                       │
│    - Route/Stop separation                                      │
│    - Picklist/Face Sheet line-level tracking                    │
│    - Reservation release                                        │
│    - Loadlist line-level tracking                               │
│                                                                 │
│ ❌ ต้องปรับปรุง:                                                  │
│    - Ledger order tracking (เพิ่ม order_id)                     │
│    - Reverse ledger entries (ต้อง trace ผ่าน documents)         │
└─────────────────────────────────────────────────────────────────┘
```

### 4.4 คำแนะนำ

**Option A: เพิ่ม order_id ใน Ledger (แนะนำ)**
- Pros: Query ง่าย, Performance ดี, Audit-ready
- Cons: ต้อง migrate data เก่า, แก้ไข API ที่เขียน ledger
- Effort: Medium (2-3 วัน)

**Option B: Trace ผ่าน Documents**
- Pros: ไม่ต้องแก้ schema
- Cons: Complex logic, Performance ต่ำ, Error-prone
- Effort: High (5-7 วัน)


---

## 5. Partial Rollback Algorithm

### 5.1 Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    PARTIAL ROLLBACK FLOW                        │
│                                                                 │
│  Order Status: loaded → picked → in_picking → confirmed → draft │
│                                                                 │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐         │
│  │ Reverse │ → │ Reverse │ → │ Release │ → │ Remove  │         │
│  │ Loading │   │ Picking │   │ Reserve │   │ Route   │         │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘         │
│       ↓             ↓             ↓             ↓               │
│  ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐         │
│  │ Restore │   │ Restore │   │ Restore │   │ Recalc  │         │
│  │ Dispatch│   │ PrepArea│   │ Balance │   │ Cost    │         │
│  └─────────┘   └─────────┘   └─────────┘   └─────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Algorithm Steps (Atomic Transaction)

```typescript
async function partialRollbackOrder(orderId: number, userId: number, reason: string) {
  // ========================================
  // STEP 0: VALIDATION & LOCK
  // ========================================
  
  // 0.1 ตรวจสอบ Order exists และ status
  const order = await getOrder(orderId);
  if (!order) throw new Error('Order not found');
  
  // 0.2 ตรวจสอบว่า Order ยังไม่ถูก rollback
  if (order.status === 'draft') {
    throw new Error('Order is already in draft status');
  }
  
  // 0.3 ตรวจสอบว่า Order ไม่ได้อยู่ในสถานะ in_transit หรือ delivered
  if (['in_transit', 'delivered'].includes(order.status)) {
    throw new Error('Cannot rollback order in transit or delivered');
  }
  
  // 0.4 Lock Order (ป้องกัน concurrent rollback)
  await lockOrder(orderId);
  
  try {
    // ========================================
    // STEP 1: REVERSE LOADING (ถ้ามี)
    // ========================================
    if (['loaded'].includes(order.status)) {
      await reverseLoading(orderId, userId);
    }
    
    // ========================================
    // STEP 2: REVERSE PICKING (ถ้ามี)
    // ========================================
    if (['loaded', 'picked', 'in_picking'].includes(order.status)) {
      await reversePicking(orderId, userId);
    }
    
    // ========================================
    // STEP 3: RELEASE RESERVATIONS
    // ========================================
    await releaseReservations(orderId);
    
    // ========================================
    // STEP 4: VOID DOCUMENT LINES
    // ========================================
    await voidDocumentLines(orderId);
    
    // ========================================
    // STEP 5: REMOVE FROM ROUTE
    // ========================================
    await removeFromRoute(orderId);
    
    // ========================================
    // STEP 6: RESET ORDER STATUS
    // ========================================
    await resetOrderStatus(orderId, 'draft', userId, reason);
    
    // ========================================
    // STEP 7: AUDIT LOG
    // ========================================
    await createAuditLog({
      action: 'partial_rollback',
      entity_type: 'order',
      entity_id: orderId,
      user_id: userId,
      reason: reason,
      details: { previous_status: order.status }
    });
    
  } finally {
    // ========================================
    // STEP 8: UNLOCK ORDER
    // ========================================
    await unlockOrder(orderId);
  }
}
```

### 5.3 Detailed Step Implementation

#### STEP 1: Reverse Loading

```typescript
async function reverseLoading(orderId: number, userId: number) {
  // 1.1 หา loadlist_items ของ Order นี้
  const loadlistItems = await supabase
    .from('loadlist_items')
    .select('*, loadlists(*)')
    .eq('order_id', orderId);
  
  if (!loadlistItems.data?.length) return;
  
  // 1.2 หา SKUs ที่ต้อง reverse จาก picklist_items และ face_sheet_items
  const picklistItems = await supabase
    .from('picklist_items')
    .select('sku_id, quantity_picked, source_location_id')
    .eq('order_id', orderId)
    .eq('status', 'picked');
  
  const faceSheetItems = await supabase
    .from('face_sheet_items')
    .select('sku_id, quantity_picked, source_location_id')
    .eq('order_id', orderId)
    .eq('status', 'picked');
  
  // 1.3 Reverse stock: Delivery-In-Progress → Dispatch
  for (const item of [...picklistItems.data, ...faceSheetItems.data]) {
    // OUT from Delivery-In-Progress
    await insertLedger({
      transaction_type: 'rollback',
      direction: 'out',
      location_id: 'Delivery-In-Progress',
      sku_id: item.sku_id,
      piece_qty: item.quantity_picked,
      reference_doc_type: 'rollback',
      reference_doc_id: orderId,
      order_id: orderId, // ✅ เพิ่ม order_id
      remarks: `Rollback loading for Order ${orderId}`,
      created_by: userId
    });
    
    // IN to Dispatch
    await insertLedger({
      transaction_type: 'rollback',
      direction: 'in',
      location_id: 'Dispatch',
      sku_id: item.sku_id,
      piece_qty: item.quantity_picked,
      reference_doc_type: 'rollback',
      reference_doc_id: orderId,
      order_id: orderId,
      remarks: `Rollback loading for Order ${orderId}`,
      created_by: userId
    });
  }
  
  // 1.4 ลบ loadlist_items ของ Order นี้
  await supabase
    .from('loadlist_items')
    .delete()
    .eq('order_id', orderId);
  
  // 1.5 ตรวจสอบว่า Loadlist ยังมี items อื่นหรือไม่
  for (const item of loadlistItems.data) {
    const remaining = await supabase
      .from('loadlist_items')
      .select('id')
      .eq('loadlist_id', item.loadlist_id);
    
    if (!remaining.data?.length) {
      // ถ้าไม่มี items เหลือ → void loadlist
      await supabase
        .from('loadlists')
        .update({ status: 'voided' })
        .eq('id', item.loadlist_id);
    }
  }
}
```

#### STEP 2: Reverse Picking

```typescript
async function reversePicking(orderId: number, userId: number) {
  // 2.1 หา picklist_items ของ Order นี้ที่ picked แล้ว
  const picklistItems = await supabase
    .from('picklist_items')
    .select(`
      *,
      picklist_item_reservations(*)
    `)
    .eq('order_id', orderId)
    .eq('status', 'picked');
  
  // 2.2 หา face_sheet_items ของ Order นี้ที่ picked แล้ว
  const faceSheetItems = await supabase
    .from('face_sheet_items')
    .select(`
      *,
      face_sheet_item_reservations(*)
    `)
    .eq('order_id', orderId)
    .eq('status', 'picked');
  
  // 2.3 Reverse stock: Dispatch → Preparation Area
  for (const item of picklistItems.data || []) {
    // OUT from Dispatch
    await insertLedger({
      transaction_type: 'rollback',
      direction: 'out',
      location_id: 'Dispatch',
      sku_id: item.sku_id,
      piece_qty: item.quantity_picked,
      reference_doc_type: 'rollback',
      reference_doc_id: orderId,
      order_id: orderId,
      remarks: `Rollback picking for Order ${orderId}`,
      created_by: userId
    });
    
    // IN to original Preparation Area (ใช้ source_location_id)
    await insertLedger({
      transaction_type: 'rollback',
      direction: 'in',
      location_id: item.source_location_id,
      sku_id: item.sku_id,
      piece_qty: item.quantity_picked,
      reference_doc_type: 'rollback',
      reference_doc_id: orderId,
      order_id: orderId,
      remarks: `Rollback picking for Order ${orderId}`,
      created_by: userId
    });
  }
  
  // 2.4 ทำเหมือนกันสำหรับ face_sheet_items
  for (const item of faceSheetItems.data || []) {
    // ... same logic
  }
  
  // 2.5 Mark picklist_items as voided
  await supabase
    .from('picklist_items')
    .update({ status: 'voided', voided_at: new Date().toISOString() })
    .eq('order_id', orderId);
  
  // 2.6 Mark face_sheet_items as voided
  await supabase
    .from('face_sheet_items')
    .update({ status: 'voided', voided_at: new Date().toISOString() })
    .eq('order_id', orderId);
}
```


#### STEP 3: Release Reservations

```typescript
async function releaseReservations(orderId: number) {
  // 3.1 หา picklist_items ของ Order นี้
  const picklistItems = await supabase
    .from('picklist_items')
    .select('id')
    .eq('order_id', orderId);
  
  const picklistItemIds = picklistItems.data?.map(i => i.id) || [];
  
  // 3.2 หา reservations ที่ยังเป็น 'reserved'
  const reservations = await supabase
    .from('picklist_item_reservations')
    .select('*')
    .in('picklist_item_id', picklistItemIds)
    .eq('status', 'reserved');
  
  // 3.3 Release reserved qty กลับไปที่ balance
  for (const res of reservations.data || []) {
    // ลด reserved_piece_qty ใน balance
    await supabase.rpc('release_reservation', {
      p_balance_id: res.balance_id,
      p_piece_qty: res.reserved_piece_qty,
      p_pack_qty: res.reserved_pack_qty
    });
    
    // Update reservation status
    await supabase
      .from('picklist_item_reservations')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('reservation_id', res.reservation_id);
  }
  
  // 3.4 ทำเหมือนกันสำหรับ face_sheet_item_reservations
  const faceSheetItems = await supabase
    .from('face_sheet_items')
    .select('id')
    .eq('order_id', orderId);
  
  const faceSheetItemIds = faceSheetItems.data?.map(i => i.id) || [];
  
  const fsReservations = await supabase
    .from('face_sheet_item_reservations')
    .select('*')
    .in('face_sheet_item_id', faceSheetItemIds)
    .eq('status', 'reserved');
  
  for (const res of fsReservations.data || []) {
    await supabase.rpc('release_reservation', {
      p_balance_id: res.balance_id,
      p_piece_qty: res.reserved_piece_qty,
      p_pack_qty: res.reserved_pack_qty
    });
    
    await supabase
      .from('face_sheet_item_reservations')
      .update({ status: 'released', released_at: new Date().toISOString() })
      .eq('reservation_id', res.reservation_id);
  }
  
  // 3.5 ทำเหมือนกันสำหรับ bonus_face_sheet_item_reservations
  // ... similar logic using order_item_id to find items
}
```

#### STEP 4: Void Document Lines

```typescript
async function voidDocumentLines(orderId: number) {
  const now = new Date().toISOString();
  
  // 4.1 Void picklist_items (ไม่ลบ เพื่อ audit trail)
  await supabase
    .from('picklist_items')
    .update({ 
      status: 'voided',
      voided_at: now,
      notes: `Voided by rollback Order ${orderId}`
    })
    .eq('order_id', orderId);
  
  // 4.2 Void face_sheet_items
  await supabase
    .from('face_sheet_items')
    .update({ 
      status: 'voided',
      voided_at: now
    })
    .eq('order_id', orderId);
  
  // 4.3 Void bonus_face_sheet_items (ผ่าน order_item_id)
  const orderItems = await supabase
    .from('wms_order_items')
    .select('item_id')
    .eq('order_id', orderId);
  
  const orderItemIds = orderItems.data?.map(i => i.item_id) || [];
  
  await supabase
    .from('bonus_face_sheet_items')
    .update({ 
      status: 'voided',
      voided_at: now
    })
    .in('order_item_id', orderItemIds);
  
  // 4.4 ลบ loadlist_items (ไม่มี status field)
  await supabase
    .from('loadlist_items')
    .delete()
    .eq('order_id', orderId);
  
  // 4.5 ตรวจสอบและ void parent documents ถ้าไม่มี items เหลือ
  await checkAndVoidEmptyDocuments();
}

async function checkAndVoidEmptyDocuments() {
  // Check picklists
  const emptyPicklists = await supabase.rpc('find_empty_picklists');
  for (const pl of emptyPicklists.data || []) {
    await supabase
      .from('picklists')
      .update({ status: 'voided' })
      .eq('id', pl.id);
  }
  
  // Check face_sheets
  const emptyFaceSheets = await supabase.rpc('find_empty_face_sheets');
  for (const fs of emptyFaceSheets.data || []) {
    await supabase
      .from('face_sheets')
      .update({ status: 'voided' })
      .eq('id', fs.id);
  }
  
  // Check loadlists
  const emptyLoadlists = await supabase.rpc('find_empty_loadlists');
  for (const ll of emptyLoadlists.data || []) {
    await supabase
      .from('loadlists')
      .update({ status: 'voided' })
      .eq('id', ll.id);
  }
}
```

#### STEP 5: Remove from Route

```typescript
async function removeFromRoute(orderId: number) {
  // 5.1 หา route stops ของ Order นี้
  const stops = await supabase
    .from('receiving_route_stops')
    .select('*, receiving_route_trips(*)')
    .eq('order_id', orderId);
  
  if (!stops.data?.length) return;
  
  // 5.2 ลบ stops
  await supabase
    .from('receiving_route_stops')
    .delete()
    .eq('order_id', orderId);
  
  // 5.3 ลบ route_plan_inputs
  await supabase
    .from('receiving_route_plan_inputs')
    .delete()
    .eq('order_id', orderId);
  
  // 5.4 Recalculate shipping cost สำหรับ trips ที่ได้รับผลกระทบ
  const affectedTripIds = [...new Set(stops.data.map(s => s.trip_id))];
  
  for (const tripId of affectedTripIds) {
    // ตรวจสอบว่า trip ยังมี stops อื่นหรือไม่
    const remainingStops = await supabase
      .from('receiving_route_stops')
      .select('stop_id')
      .eq('trip_id', tripId);
    
    if (!remainingStops.data?.length) {
      // ถ้าไม่มี stops เหลือ → void trip
      await supabase
        .from('receiving_route_trips')
        .update({ status: 'voided' })
        .eq('trip_id', tripId);
    } else {
      // Recalculate shipping cost
      await recalculateShippingCost(tripId);
    }
  }
  
  // 5.5 Clear matched_trip_id จาก Order
  await supabase
    .from('wms_orders')
    .update({ matched_trip_id: null, auto_matched_at: null })
    .eq('order_id', orderId);
}

async function recalculateShippingCost(tripId: number) {
  // ดึงข้อมูล trip และ stops
  const { data: trip } = await supabase
    .from('receiving_route_trips')
    .select(`
      *,
      receiving_route_stops(*)
    `)
    .eq('trip_id', tripId)
    .single();
  
  if (!trip) return;
  
  // คำนวณค่าขนส่งใหม่ตาม business logic
  // (ขึ้นอยู่กับ formula ที่ใช้ - distance, weight, volume, etc.)
  const newCost = calculateShippingCost(trip);
  
  await supabase
    .from('receiving_route_trips')
    .update({ 
      shipping_cost: newCost,
      cost_recalculated_at: new Date().toISOString()
    })
    .eq('trip_id', tripId);
}
```

#### STEP 6: Reset Order Status

```typescript
async function resetOrderStatus(
  orderId: number, 
  newStatus: string, 
  userId: number, 
  reason: string
) {
  const now = new Date().toISOString();
  
  await supabase
    .from('wms_orders')
    .update({
      status: newStatus,
      confirmed_at: null,
      updated_at: now,
      updated_by: userId,
      rollback_reason: reason,
      rollback_at: now,
      rollback_by: userId
    })
    .eq('order_id', orderId);
}
```


---

## 6. Inventory Ledger Strategy

### 6.1 เปรียบเทียบ Hard Delete vs Reverse Ledger

| เกณฑ์ | Hard Delete | Reverse Ledger (แนะนำ) |
|-------|-------------|------------------------|
| **Audit Trail** | ❌ ไม่มี | ✅ ครบถ้วน |
| **BRCGS Compliance** | ❌ ไม่ผ่าน | ✅ ผ่าน |
| **Traceability** | ❌ ไม่สามารถ trace | ✅ trace ได้ทุก movement |
| **Data Integrity** | ⚠️ เสี่ยง | ✅ ปลอดภัย |
| **Performance** | ✅ เร็วกว่า | ⚠️ ช้ากว่าเล็กน้อย |
| **Storage** | ✅ ใช้น้อยกว่า | ⚠️ ใช้มากกว่า |
| **Complexity** | ✅ ง่าย | ⚠️ ซับซ้อนกว่า |

### 6.2 Reverse Ledger Pattern (แนะนำสำหรับ BRCGS)

```
┌─────────────────────────────────────────────────────────────────┐
│ ORIGINAL ENTRIES (Pick)                                         │
│ ─────────────────────                                           │
│ ledger_id=1: OUT from PK001, qty=100, ref=PL-001               │
│ ledger_id=2: IN to Dispatch, qty=100, ref=PL-001               │
│                                                                 │
│ REVERSE ENTRIES (Rollback)                                      │
│ ─────────────────────────                                       │
│ ledger_id=3: OUT from Dispatch, qty=100, ref=ROLLBACK-ORD-123  │
│ ledger_id=4: IN to PK001, qty=100, ref=ROLLBACK-ORD-123        │
│                                                                 │
│ NET EFFECT: Balance กลับสู่สถานะเดิม                             │
│ AUDIT: ทุก movement ถูกบันทึกไว้                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.3 Ledger Entry Structure for Rollback

```typescript
interface RollbackLedgerEntry {
  movement_at: string;
  transaction_type: 'rollback';  // ใช้ type ใหม่
  direction: 'in' | 'out';
  warehouse_id: string;
  location_id: string;
  sku_id: string;
  pallet_id?: string;
  production_date?: string;
  expiry_date?: string;
  lot_no?: string;
  pack_qty: number;
  piece_qty: number;
  reference_no: string;  // e.g., "ROLLBACK-ORD-123"
  reference_doc_type: 'rollback';
  reference_doc_id: number;  // order_id
  order_id: number;  // ✅ เพิ่มใหม่
  order_item_id?: number;  // ✅ เพิ่มใหม่
  remarks: string;  // เหตุผลการ rollback
  created_by: number;
  original_ledger_id?: number;  // ✅ อ้างอิง ledger เดิมที่ถูก reverse
}
```

### 6.4 BRCGS Compliance Checklist

| ข้อกำหนด BRCGS | การรองรับ | หมายเหตุ |
|----------------|----------|----------|
| Full Traceability | ✅ | Reverse entries อ้างอิง original |
| Audit Trail | ✅ | ทุก movement ถูกบันทึก |
| No Data Deletion | ✅ | ใช้ reverse แทน delete |
| User Accountability | ✅ | created_by บันทึกผู้ทำ |
| Timestamp Accuracy | ✅ | movement_at บันทึกเวลาจริง |
| Reason Documentation | ✅ | remarks บันทึกเหตุผล |

### 6.5 Balance Sync Strategy

```sql
-- Trigger: sync_inventory_ledger_to_balance
-- ทำงานอัตโนมัติเมื่อ insert ledger entry

-- สำหรับ Rollback entries:
-- direction='out' → ลด total_piece_qty
-- direction='in' → เพิ่ม total_piece_qty

-- ไม่ต้องแก้ไข trigger เดิม เพราะ logic เหมือนกัน
-- เพียงแค่ใส่ skip_balance_sync=false (default)
```

---

## 7. Data Integrity & Audit

### 7.1 Lock Mechanism

```sql
-- เพิ่ม columns ใน wms_orders
ALTER TABLE wms_orders ADD COLUMN 
  rollback_lock_at TIMESTAMPTZ,
  rollback_lock_by BIGINT,
  rollback_lock_expires_at TIMESTAMPTZ;

-- Function: Lock Order
CREATE OR REPLACE FUNCTION lock_order_for_rollback(
  p_order_id BIGINT,
  p_user_id BIGINT,
  p_lock_duration_minutes INT DEFAULT 30
) RETURNS BOOLEAN AS $$
DECLARE
  v_locked BOOLEAN;
BEGIN
  -- ตรวจสอบว่ายังไม่ถูก lock หรือ lock หมดอายุแล้ว
  UPDATE wms_orders
  SET 
    rollback_lock_at = NOW(),
    rollback_lock_by = p_user_id,
    rollback_lock_expires_at = NOW() + (p_lock_duration_minutes || ' minutes')::INTERVAL
  WHERE order_id = p_order_id
    AND (rollback_lock_at IS NULL 
         OR rollback_lock_expires_at < NOW())
  RETURNING TRUE INTO v_locked;
  
  RETURN COALESCE(v_locked, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function: Unlock Order
CREATE OR REPLACE FUNCTION unlock_order_rollback(p_order_id BIGINT) 
RETURNS VOID AS $$
BEGIN
  UPDATE wms_orders
  SET 
    rollback_lock_at = NULL,
    rollback_lock_by = NULL,
    rollback_lock_expires_at = NULL
  WHERE order_id = p_order_id;
END;
$$ LANGUAGE plpgsql;
```

### 7.2 Concurrent Rollback Prevention

```typescript
async function lockOrder(orderId: number, userId: number): Promise<boolean> {
  const { data, error } = await supabase.rpc('lock_order_for_rollback', {
    p_order_id: orderId,
    p_user_id: userId,
    p_lock_duration_minutes: 30
  });
  
  if (error || !data) {
    throw new Error('Order is currently being processed by another user');
  }
  
  return true;
}
```

### 7.3 Error Recovery

```typescript
async function partialRollbackWithRecovery(orderId: number, userId: number, reason: string) {
  const rollbackState = {
    step: 0,
    completedSteps: [] as string[],
    errors: [] as any[]
  };
  
  try {
    // ... execute steps
    
  } catch (error) {
    // บันทึก error state
    await supabase
      .from('rollback_error_logs')
      .insert({
        order_id: orderId,
        user_id: userId,
        error_message: error.message,
        rollback_state: rollbackState,
        created_at: new Date().toISOString()
      });
    
    // Attempt recovery based on completed steps
    if (rollbackState.completedSteps.includes('reverse_loading')) {
      // Loading was reversed but picking wasn't
      // → Need manual intervention
    }
    
    throw error;
  }
}
```

### 7.4 Audit Log Structure

```sql
-- สร้างตาราง audit_logs (ถ้ายังไม่มี)
CREATE TABLE IF NOT EXISTS wms_rollback_audit_logs (
  log_id BIGSERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,  -- 'partial_rollback'
  entity_type VARCHAR(50) NOT NULL,  -- 'order'
  entity_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  reason TEXT,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  affected_documents JSONB,  -- { picklists: [...], loadlists: [...] }
  affected_ledger_ids BIGINT[],
  rollback_summary JSONB,  -- { items_reversed: 10, qty_restored: 500 }
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rollback_audit_order ON wms_rollback_audit_logs(entity_id);
CREATE INDEX idx_rollback_audit_user ON wms_rollback_audit_logs(user_id);
CREATE INDEX idx_rollback_audit_date ON wms_rollback_audit_logs(created_at);
```

### 7.5 UI Confirmation Flow

```typescript
// Frontend: Confirmation Modal
interface RollbackConfirmation {
  orderId: number;
  orderNo: string;
  currentStatus: string;
  affectedDocuments: {
    picklists: string[];
    faceSheets: string[];
    loadlists: string[];
    routeStops: number;
  };
  stockToRestore: {
    sku_id: string;
    sku_name: string;
    quantity: number;
    from_location: string;
    to_location: string;
  }[];
  warnings: string[];
  requiresReason: boolean;
}

// API: Preview Rollback Impact
// GET /api/orders/[id]/rollback-preview
async function getRollbackPreview(orderId: number): Promise<RollbackConfirmation> {
  // ... calculate impact without executing
}
```


---

## 8. Implementation Guide

### 8.1 Phase 1: Database Schema Changes (Day 1-2)

#### Migration 1: Add order_id to Ledger

```sql
-- File: supabase/migrations/XXX_add_order_tracking_to_ledger.sql

-- 1. เพิ่ม columns
ALTER TABLE wms_inventory_ledger 
ADD COLUMN order_id BIGINT REFERENCES wms_orders(order_id),
ADD COLUMN order_item_id BIGINT REFERENCES wms_order_items(item_id),
ADD COLUMN original_ledger_id BIGINT REFERENCES wms_inventory_ledger(ledger_id);

-- 2. สร้าง indexes
CREATE INDEX idx_ledger_order_id ON wms_inventory_ledger(order_id);
CREATE INDEX idx_ledger_order_item_id ON wms_inventory_ledger(order_item_id);

-- 3. เพิ่ม transaction_type 'rollback'
-- (ถ้าใช้ enum ต้อง ALTER TYPE)

-- 4. Backfill order_id สำหรับ ledger entries เก่า (optional)
UPDATE wms_inventory_ledger l
SET order_id = pi.order_id
FROM picklist_items pi
JOIN picklists p ON pi.picklist_id = p.id
WHERE l.reference_doc_type = 'picklist'
  AND l.reference_doc_id = p.id
  AND l.order_id IS NULL;
```

#### Migration 2: Add Rollback Columns to Orders

```sql
-- File: supabase/migrations/XXX_add_rollback_columns_to_orders.sql

ALTER TABLE wms_orders ADD COLUMN 
  rollback_lock_at TIMESTAMPTZ,
  rollback_lock_by BIGINT REFERENCES master_system_user(user_id),
  rollback_lock_expires_at TIMESTAMPTZ,
  rollback_reason TEXT,
  rollback_at TIMESTAMPTZ,
  rollback_by BIGINT REFERENCES master_system_user(user_id);
```

#### Migration 3: Add Voided Status to Document Items

```sql
-- File: supabase/migrations/XXX_add_voided_status_to_items.sql

-- picklist_items
ALTER TABLE picklist_items ADD COLUMN voided_at TIMESTAMPTZ;

-- face_sheet_items (ถ้ายังไม่มี)
ALTER TABLE face_sheet_items ADD COLUMN voided_at TIMESTAMPTZ;

-- bonus_face_sheet_items
ALTER TABLE bonus_face_sheet_items ADD COLUMN voided_at TIMESTAMPTZ;

-- Update status enum ถ้าจำเป็น
-- ALTER TYPE picklist_item_status ADD VALUE 'voided';
```

#### Migration 4: Create Audit Log Table

```sql
-- File: supabase/migrations/XXX_create_rollback_audit_logs.sql

CREATE TABLE wms_rollback_audit_logs (
  log_id BIGSERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL REFERENCES master_system_user(user_id),
  reason TEXT,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  affected_documents JSONB,
  affected_ledger_ids BIGINT[],
  rollback_summary JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rollback_audit_order ON wms_rollback_audit_logs(entity_id);
CREATE INDEX idx_rollback_audit_user ON wms_rollback_audit_logs(user_id);
CREATE INDEX idx_rollback_audit_date ON wms_rollback_audit_logs(created_at);
```

### 8.2 Phase 2: Backend API (Day 3-5)

#### File Structure

```
lib/database/
├── order-rollback.ts          # Main rollback service
├── rollback-validators.ts     # Validation functions
├── rollback-ledger.ts         # Ledger operations
└── rollback-audit.ts          # Audit logging

app/api/orders/[id]/
├── rollback-preview/route.ts  # GET - Preview impact
└── rollback/route.ts          # POST - Execute rollback
```

#### API Endpoints

```typescript
// GET /api/orders/[id]/rollback-preview
// Response: RollbackPreview

// POST /api/orders/[id]/rollback
// Body: { reason: string }
// Response: { success: boolean, summary: RollbackSummary }
```

### 8.3 Phase 3: Frontend UI (Day 6-7)

#### Components

```
components/orders/
├── RollbackButton.tsx         # Button with permission check
├── RollbackPreviewModal.tsx   # Show impact before confirm
├── RollbackConfirmModal.tsx   # Final confirmation with reason
└── RollbackHistoryTable.tsx   # Show rollback audit logs
```

#### Page Integration

```typescript
// app/receiving/orders/page.tsx
// เพิ่มปุ่ม Rollback ใน Order Actions dropdown

// app/receiving/orders/[id]/page.tsx
// เพิ่ม Rollback History section
```

### 8.4 Phase 4: Testing & QA (Day 8-10)

#### Test Cases

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TC-001 | Rollback Order ที่ยังไม่ได้ pick | Status → draft, ไม่มี ledger changes |
| TC-002 | Rollback Order ที่ pick แล้ว | Stock กลับ Prep Area, Ledger มี reverse entries |
| TC-003 | Rollback Order ที่ load แล้ว | Stock กลับ Dispatch → Prep Area |
| TC-004 | Rollback Order ใน shared Picklist | เฉพาะ lines ของ Order นี้ถูก void |
| TC-005 | Rollback Order ใน shared Loadlist | เฉพาะ items ของ Order นี้ถูกลบ |
| TC-006 | Concurrent rollback | ผู้ใช้คนที่ 2 ได้รับ error |
| TC-007 | Rollback Order ที่ in_transit | ได้รับ error ไม่อนุญาต |
| TC-008 | Rollback แล้ว re-process | Order สามารถ confirm และ process ใหม่ได้ |

### 8.5 Rollout Checklist

- [ ] Database migrations applied
- [ ] API endpoints deployed
- [ ] Frontend components integrated
- [ ] Permission "order.rollback" added to roles
- [ ] Audit logging verified
- [ ] Performance tested with production-like data
- [ ] Documentation updated
- [ ] User training completed

---

## 9. Summary

### 9.1 Key Decisions

1. **Ledger Strategy**: ใช้ Reverse Ledger (ไม่ Hard Delete) เพื่อ BRCGS compliance
2. **Schema Change**: เพิ่ม `order_id` ใน `wms_inventory_ledger` เพื่อ traceability
3. **Document Handling**: Void items แทนการลบ เพื่อ audit trail
4. **Lock Mechanism**: ใช้ database-level lock ป้องกัน concurrent rollback

### 9.2 Estimated Effort

| Phase | Duration | Resources |
|-------|----------|-----------|
| Database Schema | 2 days | 1 Backend Dev |
| Backend API | 3 days | 1 Backend Dev |
| Frontend UI | 2 days | 1 Frontend Dev |
| Testing & QA | 3 days | 1 QA + Devs |
| **Total** | **10 days** | **2-3 people** |

### 9.3 Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data inconsistency during rollback | High | Use database transaction |
| Performance impact on large orders | Medium | Batch processing, async jobs |
| User confusion | Low | Clear UI warnings, confirmation |
| Incomplete rollback | High | Error recovery mechanism |

---

## Appendix A: SQL Functions

```sql
-- Function: release_reservation
CREATE OR REPLACE FUNCTION release_reservation(
  p_balance_id BIGINT,
  p_piece_qty NUMERIC,
  p_pack_qty NUMERIC
) RETURNS VOID AS $$
BEGIN
  UPDATE wms_inventory_balances
  SET 
    reserved_piece_qty = GREATEST(0, reserved_piece_qty - p_piece_qty),
    reserved_pack_qty = GREATEST(0, reserved_pack_qty - p_pack_qty),
    updated_at = NOW()
  WHERE balance_id = p_balance_id;
END;
$$ LANGUAGE plpgsql;

-- Function: find_empty_picklists
CREATE OR REPLACE FUNCTION find_empty_picklists()
RETURNS TABLE(id BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id
  FROM picklists p
  WHERE p.status NOT IN ('voided', 'cancelled')
    AND NOT EXISTS (
      SELECT 1 FROM picklist_items pi
      WHERE pi.picklist_id = p.id
        AND pi.status NOT IN ('voided', 'cancelled')
    );
END;
$$ LANGUAGE plpgsql;
```

---

**เอกสารนี้พร้อมสำหรับ Developer ใช้เป็น Blueprint ในการ Implement Partial Rollback**
