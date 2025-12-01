# ระบบการจองและการย้ายสต็อกของ Picklist

## 📋 สรุปภาพรวม

ระบบ Picklist มีกระบวนการจัดการสต็อก 2 ขั้นตอนหลัก:
1. **การจองสต็อก (Stock Reservation)** - เมื่อสร้าง Picklist
2. **การย้ายสต็อก (Stock Movement)** - เมื่อหยิบสินค้าจริง

---

## 🔄 Flow ทั้งหมด

```
1. สร้าง Picklist
   ↓
2. จองสต็อกตาม FEFO/FIFO
   ↓
3. หยิบสินค้า (Mobile Pick)
   ↓
4. ย้ายสต็อกจาก Preparation Area → Dispatch
   ↓
5. โหลดสินค้า (Mobile Loading)
   ↓
6. ย้ายสต็อกจาก Dispatch → Delivery-In-Progress
```

---

## 📍 ตาราง Database ที่เกี่ยวข้อง

### 1. **picklists**
- เก็บข้อมูลหัวใบหยิบ
- Fields: `id`, `picklist_code`, `status`, `trip_id`, `plan_id`, `checker_employee_ids`, `picker_employee_ids`

### 2. **picklist_items**
- เก็บรายการสินค้าในใบหยิบ
- Fields: `id`, `picklist_id`, `sku_id`, `quantity_to_pick`, `quantity_picked`, `source_location_id`, `status`

### 3. **picklist_item_reservations** ⭐
- เก็บข้อมูลการจองสต็อก (ใหม่)
- Fields: `reservation_id`, `picklist_item_id`, `balance_id`, `reserved_piece_qty`, `reserved_pack_qty`, `status`, `picked_at`

### 4. **wms_inventory_balances**
- เก็บยอดสต็อคปัจจุบัน
- Fields: `balance_id`, `warehouse_id`, `location_id`, `sku_id`, `total_piece_qty`, `reserved_piece_qty`, `production_date`, `expiry_date`, `lot_no`

### 5. **wms_inventory_ledger**
- เก็บประวัติการเคลื่อนไหวสต็อค
- Fields: `ledger_id`, `movement_at`, `transaction_type`, `direction`, `warehouse_id`, `location_id`, `sku_id`, `piece_qty`, `reference_no`

### 6. **master_sku**
- เก็บข้อมูลสินค้า
- Fields: `sku_id`, `sku_name`, `default_location` (preparation area), `qty_per_pack`

### 7. **preparation_area**
- เก็บข้อมูลพื้นที่เตรียมสินค้า
- Fields: `area_code`, `area_name`, `zone`

### 8. **master_location**
- เก็บข้อมูล location ทั้งหมด
- Fields: `location_id`, `location_code`, `zone`, `warehouse_id`

---

## 🎯 ขั้นตอนที่ 1: การสร้าง Picklist และจองสต็อก

### API: `POST /api/picklists/create-from-trip`

### Workflow:

#### 1.1 **Validation ก่อนสร้าง**
```typescript
// ✅ ตรวจสอบว่า SKU มี default_location (preparation area) หรือไม่
if (!sku.default_location) {
  return error('SKU does not have preparation area configured');
}
```

#### 1.2 **Map Preparation Area → Locations**
```typescript
// Step 1: ดึง zone จาก preparation_area
const { data: prepArea } = await supabase
  .from('preparation_area')
  .select('zone')
  .eq('area_code', sku.default_location)  // เช่น 'PK001'
  .maybeSingle();

// Step 2: ดึง location_ids ทั้งหมดใน zone นั้น
const { data: locationsInZone } = await supabase
  .from('master_location')
  .select('location_id')
  .eq('zone', prepArea.zone);  // เช่น 'Picking Zone A'

// ผลลัพธ์: ['A-01-01-01', 'A-01-01-02', 'A-01-02-01', ...]
```

#### 1.3 **ตรวจสอบสต็อคว่าพอหรือไม่**
```typescript
// Query สต็อคที่มีอยู่ใน zone
const { data: balances } = await supabase
  .from('wms_inventory_balances')
  .select('balance_id, location_id, total_piece_qty, reserved_piece_qty')
  .eq('warehouse_id', warehouseId)
  .in('location_id', locationIdsToCheck)  // ทุก location ใน zone
  .eq('sku_id', item.sku_id)
  .order('expiry_date', { ascending: true, nullsFirst: false })  // FEFO
  .order('production_date', { ascending: true, nullsFirst: false })  // FIFO
  .order('created_at', { ascending: true });

// คำนวณสต็อคที่ใช้ได้
const totalAvailable = balances.reduce((sum, b) => {
  return sum + ((b.total_piece_qty || 0) - (b.reserved_piece_qty || 0));
}, 0);

// ❌ FAIL ถ้าสต็อคไม่พอ
if (totalAvailable < item.quantity_to_pick) {
  return error('Insufficient stock');
}
```

#### 1.4 **สร้าง Picklist และ Items**
```typescript
// สร้าง picklist header
const picklist = await supabase
  .from('picklists')
  .insert({
    picklist_code: 'PL-20251201-001',
    trip_id: trip_id,
    status: 'pending',
    total_lines: items.length,
    total_quantity: totalQty
  })
  .select()
  .single();

// สร้าง picklist items
const picklistItems = await supabase
  .from('picklist_items')
  .insert(items.map(item => ({
    picklist_id: picklist.id,
    sku_id: item.sku_id,
    quantity_to_pick: item.quantity,
    source_location_id: item.source_location_id,  // area_code เช่น 'PK001'
    status: 'pending'
  })))
  .select();
```

#### 1.5 **จองสต็อคตาม FEFO/FIFO** ⭐
```typescript
for (const item of picklistItems) {
  // Query balances ตาม FEFO/FIFO
  const { data: balances } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, total_piece_qty, reserved_piece_qty, expiry_date, production_date')
    .eq('warehouse_id', warehouseId)
    .in('location_id', locationIdsInZone)
    .eq('sku_id', item.sku_id)
    .gt('total_piece_qty', 0)
    .order('expiry_date', { ascending: true, nullsFirst: false })  // FEFO
    .order('production_date', { ascending: true, nullsFirst: false })  // FIFO
    .order('created_at', { ascending: true });

  let remainingQty = item.quantity_to_pick;
  const reservations = [];

  // จองสต็อคจาก balance แต่ละตัว
  for (const balance of balances) {
    if (remainingQty <= 0) break;

    const availableQty = balance.total_piece_qty - balance.reserved_piece_qty;
    if (availableQty <= 0) continue;

    const qtyToReserve = Math.min(availableQty, remainingQty);
    const packToReserve = qtyToReserve / qtyPerPack;

    // 1. อัปเดต reserved_piece_qty ใน wms_inventory_balances
    await supabase
      .from('wms_inventory_balances')
      .update({
        reserved_piece_qty: balance.reserved_piece_qty + qtyToReserve,
        reserved_pack_qty: balance.reserved_pack_qty + packToReserve
      })
      .eq('balance_id', balance.balance_id);

    // 2. บันทึกการจองใน picklist_item_reservations
    reservations.push({
      picklist_item_id: item.id,
      balance_id: balance.balance_id,  // ⭐ เก็บ balance_id ที่จองไว้
      reserved_piece_qty: qtyToReserve,
      reserved_pack_qty: packToReserve,
      status: 'reserved'
    });

    remainingQty -= qtyToReserve;
  }

  // Insert reservations
  await supabase
    .from('picklist_item_reservations')
    .insert(reservations);
}
```

### ผลลัพธ์:
- ✅ Picklist ถูกสร้าง (status: `pending`)
- ✅ สต็อคถูกจอง (`reserved_piece_qty` เพิ่มขึ้น)
- ✅ บันทึกการจองใน `picklist_item_reservations` (เก็บ `balance_id` ที่จองไว้)

---

## 🎯 ขั้นตอนที่ 2: การเปลี่ยนสถานะเป็น "มอบหมายแล้ว"

### API: `PATCH /api/picklists/[id]`

### Workflow:

```typescript
// เช็คว่ามีการจองสต็อกไปแล้วหรือยัง
const { data: existingReservations } = await supabase
  .from('picklist_item_reservations')
  .select('picklist_item_id')
  .in('picklist_item_id', picklistItems.map(item => item.id))
  .limit(1);

if (existingReservations && existingReservations.length > 0) {
  console.log('✅ Stock already reserved - skipping reservation');
  // ไม่จองซ้ำ
} else {
  // จองสต็อคใหม่ (สำหรับ picklist เก่าที่ยังไม่มี reservation system)
  // ... (logic เดียวกับตอนสร้าง)
}

// อัปเดตสถานะ picklist
await supabase
  .from('picklists')
  .update({ status: 'assigned' })
  .eq('id', picklist_id);
```

### ผลลัพธ์:
- ✅ Picklist status: `pending` → `assigned`
- ✅ ไม่มีการจองสต็อกซ้ำ (ถ้ามี reservations อยู่แล้ว)

---

## 🎯 ขั้นตอนที่ 3: การหยิบสินค้า (Mobile Pick)

### API: `POST /api/mobile/pick/scan`

### Workflow:

#### 3.1 **ดึงข้อมูลการจอง**
```typescript
// ดึง reservations ที่สร้างไว้ตอน create picklist
const { data: reservations } = await supabase
  .from('picklist_item_reservations')
  .select('reservation_id, balance_id, reserved_piece_qty, reserved_pack_qty')
  .eq('picklist_item_id', item_id)
  .eq('status', 'reserved')
  .order('reservation_id', { ascending: true });  // ใช้ลำดับเดิม
```

#### 3.2 **ย้ายสต็อคจาก Preparation Area → Dispatch**
```typescript
let remainingQty = quantity_picked;
const ledgerEntries = [];

for (const reservation of reservations) {
  if (remainingQty <= 0) break;

  const qtyToDeduct = Math.min(reservation.reserved_piece_qty, remainingQty);
  const packToDeduct = qtyToDeduct / qtyPerPack;

  // 1. ดึงข้อมูล balance (รวมวันที่)
  const { data: balance } = await supabase
    .from('wms_inventory_balances')
    .select('balance_id, location_id, total_piece_qty, reserved_piece_qty, production_date, expiry_date, lot_no')
    .eq('balance_id', reservation.balance_id)  // ⭐ ใช้ balance_id ที่จองไว้
    .single();

  // 2. ลดยอดจองและสต็อคจริง
  await supabase
    .from('wms_inventory_balances')
    .update({
      reserved_piece_qty: balance.reserved_piece_qty - qtyToDeduct,  // ลดยอดจอง
      reserved_pack_qty: balance.reserved_pack_qty - packToDeduct,
      total_piece_qty: balance.total_piece_qty - qtyToDeduct,  // ลดสต็อคจริง
      total_pack_qty: balance.total_pack_qty - packToDeduct
    })
    .eq('balance_id', balance.balance_id);

  // 3. บันทึก Ledger: OUT จาก Preparation Area
  ledgerEntries.push({
    movement_at: now,
    transaction_type: 'pick',
    direction: 'out',
    warehouse_id: warehouseId,
    location_id: balance.location_id,  // location จริงที่หยิบ
    sku_id: item.sku_id,
    piece_qty: qtyToDeduct,
    pack_qty: packToDeduct,
    reference_no: picklist.picklist_code,
    reference_doc_type: 'picklist',
    remarks: `หยิบจาก ${balance.location_id}`
  });

  remainingQty -= qtyToDeduct;
}
```

#### 3.3 **เพิ่มสต็อคที่ Dispatch**
```typescript
// ดึง Dispatch location
const { data: dispatchLocation } = await supabase
  .from('master_location')
  .select('location_id')
  .eq('location_code', 'Dispatch')
  .single();

// หา balance ที่ Dispatch (ต้อง match production_date, expiry_date, lot_no)
const { data: dispatchBalance } = await supabase
  .from('wms_inventory_balances')
  .select('balance_id, total_piece_qty, total_pack_qty')
  .eq('warehouse_id', warehouseId)
  .eq('location_id', dispatchLocation.location_id)
  .eq('sku_id', item.sku_id)
  .eq('production_date', sourceProductionDate || null)
  .eq('expiry_date', sourceExpiryDate || null)
  .eq('lot_no', sourceLotNo || null)
  .maybeSingle();

if (dispatchBalance) {
  // อัปเดตยอดที่มีอยู่
  await supabase
    .from('wms_inventory_balances')
    .update({
      total_piece_qty: dispatchBalance.total_piece_qty + quantity_picked,
      total_pack_qty: dispatchBalance.total_pack_qty + packQty
    })
    .eq('balance_id', dispatchBalance.balance_id);
} else {
  // สร้างใหม่ (รวมวันที่)
  await supabase
    .from('wms_inventory_balances')
    .insert({
      warehouse_id: warehouseId,
      location_id: dispatchLocation.location_id,
      sku_id: item.sku_id,
      total_piece_qty: quantity_picked,
      total_pack_qty: packQty,
      production_date: sourceProductionDate,  // ⭐ copy จาก source
      expiry_date: sourceExpiryDate,  // ⭐ copy จาก source
      lot_no: sourceLotNo  // ⭐ copy จาก source
    });
}

// บันทึก Ledger: IN ไปยัง Dispatch
ledgerEntries.push({
  movement_at: now,
  transaction_type: 'pick',
  direction: 'in',
  warehouse_id: warehouseId,
  location_id: dispatchLocation.location_id,
  sku_id: item.sku_id,
  piece_qty: quantity_picked,
  pack_qty: packQty,
  reference_no: picklist.picklist_code,
  reference_doc_type: 'picklist',
  remarks: `ย้ายไป Dispatch`
});

// Insert ledger entries
await supabase
  .from('wms_inventory_ledger')
  .insert(ledgerEntries);
```

#### 3.4 **อัปเดตสถานะ**
```typescript
// อัปเดต picklist_item
await supabase
  .from('picklist_items')
  .update({
    quantity_picked: quantity_picked,
    status: 'picked',
    picked_at: now
  })
  .eq('id', item_id);

// อัปเดต reservation status
await supabase
  .from('picklist_item_reservations')
  .update({
    status: 'picked',
    picked_at: now
  })
  .in('reservation_id', processedReservations);

// เช็คว่าหยิบครบทุก item หรือยัง
const allPicked = allItems.every(i => i.status === 'picked');

// อัปเดต picklist status
await supabase
  .from('picklists')
  .update({
    status: allPicked ? 'completed' : 'picking',
    ...(allPicked && {
      picking_completed_at: now,
      checker_employee_ids: checker_ids,  // ⭐ บันทึกพนักงานเช็ค
      picker_employee_ids: picker_ids  // ⭐ บันทึกพนักงานจัดสินค้า
    })
  })
  .eq('id', picklist_id);
```

### ผลลัพธ์:
- ✅ สต็อคลดจาก Preparation Area
- ✅ สต็อคเพิ่มที่ Dispatch (พร้อมวันผลิต/วันหมดอายุ)
- ✅ บันทึก Ledger (OUT + IN)
- ✅ Picklist status: `assigned` → `picking` → `completed`
- ✅ บันทึกข้อมูลพนักงานเช็คและจัดสินค้า

---

## 🎯 ขั้นตอนที่ 4: การโหลดสินค้า (Mobile Loading)

### API: `POST /api/mobile/loading/complete`

### Workflow:

```typescript
// ย้ายสต็อคจาก Dispatch → Delivery-In-Progress
const { data: dispatchBalance } = await supabase
  .from('wms_inventory_balances')
  .select('balance_id, total_piece_qty, production_date, expiry_date, lot_no')
  .eq('warehouse_id', 'WH001')
  .eq('location_id', dispatchLocation.location_id)
  .eq('sku_id', item.sku_id)
  .maybeSingle();

// ลดสต็อคที่ Dispatch
await supabase
  .from('wms_inventory_balances')
  .update({
    total_piece_qty: dispatchBalance.total_piece_qty - qty
  })
  .eq('balance_id', dispatchBalance.balance_id);

// เพิ่มสต็อคที่ Delivery-In-Progress (match วันที่)
const { data: deliveryBalance } = await supabase
  .from('wms_inventory_balances')
  .select('balance_id')
  .eq('warehouse_id', 'WH001')
  .eq('location_id', deliveryLocation.location_id)
  .eq('sku_id', item.sku_id)
  .eq('production_date', dispatchBalance.production_date || null)
  .eq('expiry_date', dispatchBalance.expiry_date || null)
  .eq('lot_no', dispatchBalance.lot_no || null)
  .maybeSingle();

if (deliveryBalance) {
  // อัปเดต
  await supabase
    .from('wms_inventory_balances')
    .update({ total_piece_qty: deliveryBalance.total_piece_qty + qty })
    .eq('balance_id', deliveryBalance.balance_id);
} else {
  // สร้างใหม่ (copy วันที่)
  await supabase
    .from('wms_inventory_balances')
    .insert({
      warehouse_id: 'WH001',
      location_id: deliveryLocation.location_id,
      sku_id: item.sku_id,
      total_piece_qty: qty,
      production_date: dispatchBalance.production_date,  // ⭐ copy
      expiry_date: dispatchBalance.expiry_date,  // ⭐ copy
      lot_no: dispatchBalance.lot_no  // ⭐ copy
    });
}
```

### ผลลัพธ์:
- ✅ สต็อคลดจาก Dispatch
- ✅ สต็อคเพิ่มที่ Delivery-In-Progress (พร้อมวันผลิต/วันหมดอายุ)
- ✅ Loadlist status: `pending` → `loaded`

---

## 📊 สรุป Key Points

### 1. **การจองสต็อค (Reservation)**
- ✅ จองตอนสร้าง Picklist
- ✅ ใช้ FEFO (First Expired First Out) + FIFO (First In First Out)
- ✅ บันทึกใน `picklist_item_reservations` (เก็บ `balance_id`)
- ✅ อัปเดต `reserved_piece_qty` ใน `wms_inventory_balances`

### 2. **การย้ายสต็อค (Movement)**
- ✅ ใช้ `balance_id` ที่จองไว้ (ไม่ query FEFO/FIFO ใหม่)
- ✅ ย้ายจาก Preparation Area → Dispatch → Delivery-In-Progress
- ✅ Copy `production_date`, `expiry_date`, `lot_no` ไปด้วย
- ✅ บันทึก Ledger ทุกครั้ง (OUT + IN)

### 3. **การ Match Balance**
- ✅ Match ด้วย: `sku_id`, `production_date`, `expiry_date`, `lot_no`
- ✅ ไม่ผสมสินค้าคนละ lot/วันผลิต/วันหมดอายุ

### 4. **Preparation Area Mapping**
- ✅ `master_sku.default_location` → `preparation_area.area_code`
- ✅ `preparation_area.zone` → `master_location.zone`
- ✅ Query สต็อคจากทุก location ใน zone

---

## 🔗 หน้าที่ได้รับผลกระทบ

### 1. **Frontend Pages**
- `/receiving/picklists` - แสดงรายการ picklists
- `/receiving/picklists/[id]` - รายละเอียด picklist
- `/mobile/pick/[id]` - หน้าหยิบสินค้า
- `/mobile/loading/[code]` - หน้าโหลดสินค้า
- `/warehouse/inventory-balances` - แสดงยอดสต็อค

### 2. **API Endpoints**
- `POST /api/picklists/create-from-trip` - สร้าง picklist + จองสต็อค
- `PATCH /api/picklists/[id]` - เปลี่ยนสถานะ (ไม่จองซ้ำ)
- `POST /api/mobile/pick/scan` - หยิบสินค้า + ย้ายสต็อค
- `POST /api/mobile/loading/complete` - โหลดสินค้า + ย้ายสต็อค
- `GET /api/picklists` - ดึงรายการ picklists (รวมข้อมูลพนักงาน)

### 3. **Database Tables**
- `picklists` - เพิ่ม `checker_employee_ids`, `picker_employee_ids`
- `picklist_items` - เก็บ `source_location_id`, `status`, `picked_at`
- `picklist_item_reservations` - ⭐ ตารางใหม่สำหรับจองสต็อค
- `wms_inventory_balances` - อัปเดต `reserved_piece_qty`, `total_piece_qty`
- `wms_inventory_ledger` - บันทึกทุกการเคลื่อนไหว

---

## 🎯 สิ่งที่ต้องทำสำหรับ Face Sheets

Face Sheets จะใช้ logic เดียวกันทุกอย่าง แต่แทนที่จะเป็น:
- `picklists` → `face_sheets`
- `picklist_items` → `face_sheet_items`
- `picklist_item_reservations` → `face_sheet_item_reservations`

และจะมีการย้ายสต็อคเหมือนกัน:
1. สร้าง Face Sheet → จองสต็อค
2. หยิบสินค้า → ย้ายจาก Preparation Area → Dispatch
3. โหลดสินค้า → ย้ายจาก Dispatch → Delivery-In-Progress

---

## 📝 Notes

- ⚠️ ต้องมี `default_location` ใน `master_sku` ก่อนสร้าง picklist
- ⚠️ ต้องมี `preparation_area` และ `master_location` ที่ match กัน
- ⚠️ ต้องมีสต็อคเพียงพอก่อนสร้าง picklist (ไม่อนุญาตให้จองบางส่วน)
- ✅ รองรับ picklist เก่าที่ไม่มี reservations (fallback ไป FEFO/FIFO)
- ✅ ป้องกันการจองซ้ำเมื่อเปลี่ยนสถานะ
